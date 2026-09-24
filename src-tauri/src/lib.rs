// Offline Study AI - Rust Core Backend (Phase 2B)

mod hardware;
mod inference;
mod models;

use hardware::{detect_hardware, HardwareProfile};
use inference::{
    check_llama_engine, get_llama_server_status, run_inference, start_llama_server,
    stop_llama_server, LlamaEngineInfo, LlamaServerStatus,
};
use models::{scan_directory, validate_file, DiscoveredModelFile, ModelValidationResult};

#[tauri::command]
fn get_system_info() -> String {
    format!("Offline Study AI Core v0.1.0 - Operating in local mode")
}

#[tauri::command]
fn get_hardware_profile() -> HardwareProfile {
    detect_hardware()
}

#[tauri::command]
fn scan_model_directory(directory_path: String) -> Result<Vec<DiscoveredModelFile>, String> {
    scan_directory(&directory_path)
}

#[tauri::command]
fn validate_model_file(file_path: String) -> ModelValidationResult {
    validate_file(&file_path)
}

#[tauri::command]
fn get_llama_engine_info() -> LlamaEngineInfo {
    check_llama_engine()
}

#[tauri::command]
fn start_local_llama_server(
    model_path: String,
    port: Option<u16>,
    threads: Option<u32>,
    gpu_layers: Option<u32>,
) -> Result<u16, String> {
    start_llama_server(&model_path, port, threads, gpu_layers)
}

#[tauri::command]
fn stop_local_llama_server() -> Result<(), String> {
    stop_llama_server()
}

#[tauri::command]
fn get_local_llama_server_status() -> LlamaServerStatus {
    get_llama_server_status()
}

#[tauri::command]
fn run_local_inference(
    model_path: String,
    prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> Result<String, String> {
    run_inference(&model_path, &prompt, max_tokens, temperature)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_hardware_profile,
            scan_model_directory,
            validate_model_file,
            get_llama_engine_info,
            start_local_llama_server,
            stop_local_llama_server,
            get_local_llama_server_status,
            run_local_inference
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
