// Offline Study AI - Rust Core Backend (Phase 0)

#[tauri::command]
fn get_system_info() -> String {
    format!("Offline Study AI Core v0.1.0 - Operating in local mode")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_system_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
