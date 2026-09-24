use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HardwareProfile {
    pub os: String,
    pub architecture: String,
    pub cpu: String,
    pub logical_cores: usize,
    pub physical_cores: Option<usize>,
    pub total_ram_bytes: u64,
    pub available_ram_bytes: Option<u64>,
    pub gpu: String,
    pub gpu_vendor: Option<String>,
    pub vram_bytes: Option<u64>,
}

pub fn detect_hardware() -> HardwareProfile {
    let mut sys = System::new_all();
    sys.refresh_all();

    // Operating System & Architecture
    let os_name = System::name().unwrap_or_else(|| std::env::consts::OS.to_string());
    let os_ver = System::os_version().unwrap_or_default();
    let os = if os_ver.is_empty() {
        os_name
    } else {
        format!("{} {}", os_name, os_ver)
    };
    let architecture = std::env::consts::ARCH.to_string();

    // CPU Info
    let cpus = sys.cpus();
    let cpu = cpus
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let logical_cores = cpus.len();
    let physical_cores = System::physical_core_count();

    // RAM Info
    let total_ram_bytes = sys.total_memory();
    let available_ram_bytes = Some(sys.available_memory());

    // GPU Detection
    let (gpu, gpu_vendor, vram_bytes) = detect_gpu();

    HardwareProfile {
        os,
        architecture,
        cpu,
        logical_cores,
        physical_cores,
        total_ram_bytes,
        available_ram_bytes,
        gpu,
        gpu_vendor,
        vram_bytes,
    }
}

#[cfg(target_os = "windows")]
fn detect_gpu() -> (String, Option<String>, Option<u64>) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // Use PowerShell with CREATE_NO_WINDOW flag (0x08000000) to query Win32_VideoController
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterCompatibility, AdapterRAM | ConvertTo-Json",
        ])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                // Could be an array of GPUs or a single GPU object
                let target_obj = if val.is_array() {
                    val.as_array().and_then(|arr| arr.first())
                } else if val.is_object() {
                    Some(&val)
                } else {
                    None
                };

                if let Some(gpu_info) = target_obj {
                    let name = gpu_info
                        .get("Name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    let vendor = gpu_info
                        .get("AdapterCompatibility")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let vram = gpu_info
                        .get("AdapterRAM")
                        .and_then(|r| r.as_u64());

                    if name != "Unknown" && !name.is_empty() {
                        return (name, vendor, vram);
                    }
                }
            }
        }
    }

    ("Unknown".to_string(), None, None)
}

#[cfg(target_os = "linux")]
fn detect_gpu() -> (String, Option<String>, Option<u64>) {
    use std::process::Command;

    // Try lspci first for Linux/Manjaro
    if let Ok(output) = Command::new("lspci").output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if line.contains("VGA compatible controller") || line.contains("3D controller") {
                    let parts: Vec<&str> = line.split(':').collect();
                    if parts.len() >= 3 {
                        let gpu_name = parts[2].trim().to_string();
                        let vendor = if gpu_name.contains("NVIDIA") {
                            Some("NVIDIA".to_string())
                        } else if gpu_name.contains("AMD") || gpu_name.contains("Advanced Micro Devices") {
                            Some("AMD".to_string())
                        } else if gpu_name.contains("Intel") {
                            Some("Intel".to_string())
                        } else {
                            None
                        };
                        return (gpu_name, vendor, None);
                    }
                }
            }
        }
    }

    ("Unknown".to_string(), None, None)
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn detect_gpu() -> (String, Option<String>, Option<u64>) {
    ("Unknown".to_string(), None, None)
}
