use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlamaEngineInfo {
    pub is_available: bool,
    pub binary_path: Option<String>,
    pub version: Option<String>,
    pub details: String,
}

pub fn check_llama_engine() -> LlamaEngineInfo {
    // Check common local llama.cpp executable names
    let candidates = if cfg!(target_os = "windows") {
        vec!["llama-cli.exe", "llama-server.exe", "llama-cli", "llama-server"]
    } else {
        vec!["llama-cli", "llama-server"]
    };

    for binary in candidates {
        let output = if cfg!(target_os = "windows") {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            Command::new(binary)
                .creation_flags(CREATE_NO_WINDOW)
                .arg("--version")
                .output()
        } else {
            Command::new(binary).arg("--version").output()
        };

        if let Ok(out) = output {
            if out.status.success() {
                let ver_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                return LlamaEngineInfo {
                    is_available: true,
                    binary_path: Some(binary.to_string()),
                    version: if ver_str.is_empty() { None } else { Some(ver_str) },
                    details: format!("Found local llama.cpp engine: {}", binary),
                };
            }
        }
    }

    LlamaEngineInfo {
        is_available: false,
        binary_path: None,
        version: None,
        details: "No local llama.cpp binary (llama-cli / llama-server) found in system PATH. Fallback to MockAIProvider is active.".to_string(),
    }
}

pub fn run_inference(
    model_path: &str,
    prompt: &str,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> Result<String, String> {
    let engine_info = check_llama_engine();
    if !engine_info.is_available {
        return Err("Local llama.cpp inference engine is not installed or available on this system.".to_string());
    }

    let binary = engine_info.binary_path.unwrap();
    let tokens = max_tokens.unwrap_or(256).to_string();
    let temp = temperature.unwrap_or(0.7).to_string();

    let mut cmd = Command::new(&binary);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.args([
        "-m",
        model_path,
        "-p",
        prompt,
        "-n",
        &tokens,
        "--temp",
        &temp,
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
