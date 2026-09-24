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

pub fn check_llama_engine() -> LlamaEngineInfo {
    // Check common local llama.cpp executable names & relative directories
    let candidates = if cfg!(target_os = "windows") {
        vec![
            "llama-server.exe",
            "llama-cli.exe",
            "./bin/llama-server.exe",
            "./bin/llama-cli.exe",
            "models/bin/llama-server.exe",
            "models/bin/llama-cli.exe",
            "llama-server",
            "llama-cli",
        ]
    } else {
        vec![
            "llama-server",
            "llama-cli",
            "./bin/llama-server",
            "./bin/llama-cli",
            "models/bin/llama-server",
            "models/bin/llama-cli",
        ]
    };

    let mut found_binary = None;
    let mut found_version = None;
    let mut is_server = false;

    for binary in candidates {
        // If relative path, check existence first
        if binary.contains('/') || binary.contains('\\') {
            if !Path::new(binary).exists() {
                continue;
            }
        }

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
                found_binary = Some(binary.to_string());
                if !ver_str.is_empty() {
                    found_version = Some(ver_str);
                }
                if binary.contains("server") {
                    is_server = true;
                }
                break;
            }
        }
    }

    if let Some(binary) = found_binary {
        LlamaEngineInfo {
            is_available: true,
            binary_path: Some(binary.clone()),
            version: found_version,
            details: format!("Found local llama.cpp engine: {}", binary),
            is_server_available: is_server,
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
                        if cur_model == model_path && *port_guard == target_port {
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

    let engine = check_llama_engine();
    if !engine.is_available {
        return Err("Cannot start llama-server: local engine binary not found.".to_string());
    }

    let binary = engine.binary_path.unwrap();
    if !binary.contains("server") {
        return Err(format!("Binary '{}' is not llama-server. CLI one-shot execution will be used.", binary));
    }

    let th = threads.unwrap_or(4).to_string();
    let ngl = gpu_layers.unwrap_or(0).to_string();
    let port_str = target_port.to_string();

    let mut cmd = Command::new(&binary);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.args([
        "-m", model_path,
        "--port", &port_str,
        "--host", "127.0.0.1",
        "-t", &th,
        "-ngl", &ngl,
    ]);

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn llama-server: {}", e))?;

    {
        let mut proc_guard = SERVER_PROCESS.lock().map_err(|e| e.to_string())?;
        let mut model_guard = LOADED_MODEL.lock().map_err(|e| e.to_string())?;
        let mut port_guard = SERVER_PORT.lock().map_err(|e| e.to_string())?;

        *proc_guard = Some(child);
        *model_guard = Some(model_path.to_string());
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
