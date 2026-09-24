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

pub fn find_llama_server() -> Option<String> {
    let candidates = if cfg!(target_os = "windows") {
        vec![
            "llama-server.exe",
            "./bin/llama-server.exe",
            "../bin/llama-server.exe",
            "models/bin/llama-server.exe",
            "../models/bin/llama-server.exe",
            "llama-server",
        ]
    } else {
        vec![
            "llama-server",
            "./bin/llama-server",
            "../bin/llama-server",
            "models/bin/llama-server",
            "../models/bin/llama-server",
        ]
    };

    for binary in candidates {
        if binary.contains('/') || binary.contains('\\') {
            if !Path::new(binary).exists() {
                continue;
            }
        }
        return Some(binary.to_string());
    }
    None
}

pub fn find_llama_cli() -> Option<String> {
    let candidates = if cfg!(target_os = "windows") {
        vec![
            "llama-cli.exe",
            "./bin/llama-cli.exe",
            "../bin/llama-cli.exe",
            "models/bin/llama-cli.exe",
            "../models/bin/llama-cli.exe",
            "llama-cli",
        ]
    } else {
        vec![
            "llama-cli",
            "./bin/llama-cli",
            "../bin/llama-cli",
            "models/bin/llama-cli",
            "../models/bin/llama-cli",
        ]
    };

    for binary in candidates {
        if binary.contains('/') || binary.contains('\\') {
            if !Path::new(binary).exists() {
                continue;
            }
        }
        return Some(binary.to_string());
    }
    None
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
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| model_path_buf.to_string_lossy().to_string())
}

pub fn check_llama_engine() -> LlamaEngineInfo {
    let srv = find_llama_server();
    let cli = find_llama_cli();

    let binary = srv.clone().or_else(|| cli.clone());
    let is_server = srv.is_some();

    if let Some(ref bin_path) = binary {
        let output = if cfg!(target_os = "windows") {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            Command::new(bin_path)
                .creation_flags(CREATE_NO_WINDOW)
                .arg("--version")
                .output()
        } else {
            Command::new(bin_path).arg("--version").output()
        };

        let ver = output.ok().and_then(|out| {
            if out.status.success() {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if v.is_empty() { None } else { Some(v) }
            } else {
                None
            }
        });

        LlamaEngineInfo {
            is_available: true,
            binary_path: Some(bin_path.clone()),
            version: ver,
            details: format!("Found local llama.cpp engine: {}", bin_path),
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
        }
    }

    cmd.args([
        "-m", &resolved_path,
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
