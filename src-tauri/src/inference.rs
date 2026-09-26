use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;

static SERVER_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static SERVER_PORT: Mutex<u16> = Mutex::new(8088);
static LOADED_MODEL: Mutex<Option<String>> = Mutex::new(None);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlamaEngineInfo {
    pub is_available: bool,
    pub binary_path: Option<String>,
    pub version: Option<String>,
    pub details: String,
    pub is_server_available: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlamaServerStatus {
    pub is_running: bool,
    pub port: u16,
    pub loaded_model_path: Option<String>,
}

fn find_binary(base_name: &str) -> Option<String> {
    let mut names = vec![base_name.to_string()];
    if cfg!(target_os = "windows") && !base_name.ends_with(".exe") {
        names.push(format!("{}.exe", base_name));
    }

    let mut candidate_paths = Vec::new();

    // 1. Check relative to current working directory
    for name in &names {
        candidate_paths.push(std::path::PathBuf::from(name));
        candidate_paths.push(std::path::PathBuf::from("bin").join(name));
        candidate_paths.push(std::path::PathBuf::from("./bin").join(name));
        candidate_paths.push(std::path::PathBuf::from("../bin").join(name));
        candidate_paths.push(std::path::PathBuf::from("models/bin").join(name));
        candidate_paths.push(std::path::PathBuf::from("../models/bin").join(name));
    }

    // 2. Check relative to executable location
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            for name in &names {
                candidate_paths.push(exe_dir.join(name));
                candidate_paths.push(exe_dir.join("bin").join(name));
                if let Some(p1) = exe_dir.parent() {
                    candidate_paths.push(p1.join(name));
                    candidate_paths.push(p1.join("bin").join(name));
                    if let Some(p2) = p1.parent() {
                        candidate_paths.push(p2.join(name));
                        candidate_paths.push(p2.join("bin").join(name));
                    }
                }
            }
        }
    }

    // Check if any candidate path exists as a file on disk
    for path in candidate_paths {
        if path.is_file() {
            if let Ok(canon) = path.canonicalize() {
                let s = canon.to_string_lossy().to_string();
                return Some(s.strip_prefix(r"\\?\").unwrap_or(&s).to_string());
            }
            return Some(path.to_string_lossy().to_string());
        }
    }

    // 3. Fallback: check if available in system PATH
    for name in &names {
        let output = if cfg!(target_os = "windows") {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            Command::new(name)
                .creation_flags(CREATE_NO_WINDOW)
                .arg("--version")
                .output()
        } else {
            Command::new(name).arg("--version").output()
        };

        if let Ok(out) = output {
            if out.status.success() {
                return Some(name.clone());
            }
        }
    }

    None
}

pub fn find_llama_server() -> Option<String> {
    find_binary("llama-server")
}

pub fn find_llama_cli() -> Option<String> {
    find_binary("llama-cli")
}

fn resolve_model_path(model_path: &str) -> String {
    let mut model_path_buf = std::path::PathBuf::from(model_path);
    if !model_path_buf.exists() && (model_path.starts_with("./") || (!model_path.starts_with('/') && !model_path.contains(':'))) {
        let rel = model_path.strip_prefix("./").unwrap_or(model_path);
        let alt = std::path::PathBuf::from(format!("../{}", rel));
        if alt.exists() {
            model_path_buf = alt;
        }
    }
    model_path_buf
        .canonicalize()
        .map(|p| {
            let s = p.to_string_lossy().to_string();
            s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
        })
        .unwrap_or_else(|_| model_path_buf.to_string_lossy().to_string())
}

pub fn check_llama_engine() -> LlamaEngineInfo {
    let srv = find_llama_server();
    let cli = find_llama_cli();

    let binary = srv.clone().or_else(|| cli.clone());
    let is_server = srv.is_some();

    if let Some(ref bin_path) = binary {
        let mut cmd = Command::new(bin_path);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        if let Some(parent) = Path::new(bin_path).parent() {
            if parent.exists() {
                cmd.current_dir(parent);
            }
        }

        let output = cmd.arg("--version").output();

        let ver = output.as_ref().ok().and_then(|out| {
            // Some llama.cpp builds return non-zero exit for --version while still
            // outputting version info to stderr. Accept version from either stream.
            let out_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let err_str = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let combined = if !out_str.is_empty() { out_str } else { err_str };
            // Check if the output contains a recognizable version string
            if combined.contains("version") || combined.contains("build") || combined.contains("llama") {
                Some(combined)
            } else if !combined.is_empty() && out.status.success() {
                Some(combined)
            } else {
                None
            }
        });

        if let Some(version_str) = ver {
            LlamaEngineInfo {
                is_available: true,
                binary_path: Some(bin_path.clone()),
                version: Some(version_str),
                details: format!("Found local llama.cpp engine: {}", bin_path),
                is_server_available: is_server,
            }
        } else {
            let err_details = match output {
                Ok(out) => format!("exit code {:?}, stdout: '{}', stderr: '{}'", out.status.code(), String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)),
                Err(e) => format!("exec error: {}", e),
            };
            LlamaEngineInfo {
                is_available: false,
                binary_path: None,
                version: None,
                details: format!("Found candidate at {} but failed verification: {}", bin_path, err_details),
                is_server_available: false,
            }
        }
    } else {
        LlamaEngineInfo {
            is_available: false,
            binary_path: None,
            version: None,
            details: "No local llama.cpp binary (llama-server / llama-cli) found in system PATH or ./bin. Fallback to MockAIProvider is active.".to_string(),
            is_server_available: false,
        }
    }
}

pub fn start_llama_server(
    model_path: &str,
    port: Option<u16>,
    threads: Option<u32>,
    gpu_layers: Option<u32>,
) -> Result<u16, String> {
    let target_port = port.unwrap_or(8088);
    let resolved_path = resolve_model_path(model_path);

    // Check if server is already running with same model
    {
        let mut proc_guard = SERVER_PROCESS.lock().map_err(|e| e.to_string())?;
        let model_guard = LOADED_MODEL.lock().map_err(|e| e.to_string())?;
        let port_guard = SERVER_PORT.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut child) = *proc_guard {
            match child.try_wait() {
                Ok(None) => {
                    // Still running
                    if let Some(ref cur_model) = *model_guard {
                        if (cur_model == model_path || cur_model == &resolved_path) && *port_guard == target_port {
                            return Ok(target_port);
                        }
                    }
                    // Different model or port, kill old process
                    let _ = child.kill();
                }
                _ => {
                    // Exited
                    *proc_guard = None;
                }
            }
        }
    }

    let server_bin = find_llama_server()
        .ok_or_else(|| "Cannot start llama-server: llama-server executable not found.".to_string())?;

    let th = threads.unwrap_or(4).to_string();
    let ngl = gpu_layers.unwrap_or(0).to_string();
    let port_str = target_port.to_string();

    let mut cmd = Command::new(&server_bin);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(parent) = Path::new(&server_bin).parent() {
        if parent.exists() {
            cmd.current_dir(parent);
            if let Ok(current_path) = std::env::var("PATH") {
                let sep = if cfg!(target_os = "windows") { ";" } else { ":" };
                let new_path = format!("{}{}{}", parent.display(), sep, current_path);
                cmd.env("PATH", new_path);
            }
        }
    }

    cmd.args([
        "-m", &resolved_path,
        "--port", &port_str,
        "--host", "127.0.0.1",
        "-t", &th,
        "-ngl", &ngl,
        "-c", "2048",
    ]);

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn llama-server: {}", e))?;

    {
        let mut proc_guard = SERVER_PROCESS.lock().map_err(|e| e.to_string())?;
        let mut model_guard = LOADED_MODEL.lock().map_err(|e| e.to_string())?;
        let mut port_guard = SERVER_PORT.lock().map_err(|e| e.to_string())?;

        *proc_guard = Some(child);
        *model_guard = Some(resolved_path);
        *port_guard = target_port;
    }

    Ok(target_port)
}

pub fn stop_llama_server() -> Result<(), String> {
    let mut proc_guard = SERVER_PROCESS.lock().map_err(|e| e.to_string())?;
    let mut model_guard = LOADED_MODEL.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *proc_guard {
        let _ = child.kill();
    }
    *proc_guard = None;
    *model_guard = None;

    Ok(())
}

pub fn get_llama_server_status() -> LlamaServerStatus {
    let is_running = if let Ok(mut proc_guard) = SERVER_PROCESS.lock() {
        if let Some(ref mut child) = *proc_guard {
            matches!(child.try_wait(), Ok(None))
        } else {
            false
        }
    } else {
        false
    };

    let port = SERVER_PORT.lock().map(|p| *p).unwrap_or(8088);
    let loaded_model_path = LOADED_MODEL.lock().ok().and_then(|m| m.clone());

    LlamaServerStatus {
        is_running,
        port,
        loaded_model_path,
    }
}

pub fn run_inference(
    model_path: &str,
    prompt: &str,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> Result<String, String> {
    let cli_bin = find_llama_cli()
        .ok_or_else(|| "Local CLI inference requires llama-cli binary which was not found. Please use llama-server streaming.".to_string())?;

    let resolved_path = resolve_model_path(model_path);
    let tokens = max_tokens.unwrap_or(256).to_string();
    let temp = temperature.unwrap_or(0.7).to_string();

    let mut cmd = Command::new(&cli_bin);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(parent) = Path::new(&cli_bin).parent() {
        if parent.exists() {
            cmd.current_dir(parent);
            if let Ok(current_path) = std::env::var("PATH") {
                let sep = if cfg!(target_os = "windows") { ";" } else { ":" };
                let new_path = format!("{}{}{}", parent.display(), sep, current_path);
                cmd.env("PATH", new_path);
            }
        }
    }

    cmd.args([
        "-m",
        &resolved_path,
        "-p",
        prompt,
        "-n",
        &tokens,
        "--temp",
        &temp,
        "-t", "4",
        "-c", "2048",
        "--no-display-prompt",
    ]);

    let output = cmd.output().map_err(|e| format!("Failed to execute local llama.cpp process: {}", e))?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("llama.cpp execution failed: {}", stderr.trim()))
    }
}


