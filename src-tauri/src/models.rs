use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredModelFile {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub is_valid_gguf: bool,
    pub last_modified: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModelValidationResult {
    pub is_valid: bool,
    pub file_size_bytes: u64,
    pub format: String,
    pub error: Option<String>,
}

pub fn scan_directory(dir_path_str: &str) -> Result<Vec<DiscoveredModelFile>, String> {
    let dir_path = PathBuf::from(dir_path_str);
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path_str));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path_str));
    }

    let entries = fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut discovered = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext == "gguf" {
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                let metadata = entry.metadata().ok();
                let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let last_modified = metadata
                    .and_then(|m| m.modified().ok())
                    .map(|t| format!("{:?}", t));

                let is_valid_gguf = validate_gguf_magic(&path);

                discovered.push(DiscoveredModelFile {
                    file_name,
                    path: path.to_string_lossy().to_string(),
                    size_bytes,
                    is_valid_gguf,
                    last_modified,
                });
            }
        }
    }

    Ok(discovered)
}

pub fn validate_file(file_path_str: &str) -> ModelValidationResult {
    let path = Path::new(file_path_str);
    if !path.exists() {
        return ModelValidationResult {
            is_valid: false,
            file_size_bytes: 0,
            format: "Unknown".to_string(),
            error: Some("File does not exist".to_string()),
        };
    }

    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(e) => {
            return ModelValidationResult {
                is_valid: false,
                file_size_bytes: 0,
                format: "Unknown".to_string(),
                error: Some(format!("Cannot read file metadata: {}", e)),
            };
        }
    };

    if !metadata.is_file() {
        return ModelValidationResult {
            is_valid: false,
            file_size_bytes: 0,
            format: "Unknown".to_string(),
            error: Some("Path is not a file".to_string()),
        };
    }

    let size = metadata.len();
    if size < 4 {
        return ModelValidationResult {
            is_valid: false,
            file_size_bytes: size,
            format: "Unknown".to_string(),
            error: Some("File is too small to be a valid GGUF model".to_string()),
        };
    }

    if validate_gguf_magic(path) {
        ModelValidationResult {
            is_valid: true,
            file_size_bytes: size,
            format: "GGUF".to_string(),
            error: None,
        }
    } else {
        ModelValidationResult {
            is_valid: false,
            file_size_bytes: size,
            format: "Invalid".to_string(),
            error: Some("File header does not match GGUF magic bytes (0x46554747)".to_string()),
        }
    }
}

fn validate_gguf_magic(path: &Path) -> bool {
    if let Ok(mut file) = File::open(path) {
        let mut magic = [0u8; 4];
        if file.read_exact(&mut magic).is_ok() {
            return &magic == b"GGUF";
        }
    }
    false
}
