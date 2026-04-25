use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Config {
    provider: String,
    #[serde(rename = "apiKey")]
    api_key: String,
    model: String,
    #[serde(rename = "apiEndpoint")]
    api_endpoint: String,
    #[serde(rename = "authHeaderName")]
    auth_header_name: String,
    #[serde(rename = "authHeaderValuePrefix")]
    auth_header_value_prefix: String,
    #[serde(rename = "websocketPort")]
    websocket_port: u16,
}

struct AppState {
    hermes_process: Mutex<Option<Child>>,
    openclaw_process: Mutex<Option<Child>>,
}

fn kill_all_processes(state: &AppState) {
    if let Ok(mut guard) = state.hermes_process.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
    if let Ok(mut guard) = state.openclaw_process.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
}

// Start Hermes backend service
#[tauri::command]
async fn start_hermes(app_handle: tauri::AppHandle) -> Result<String, String> {
    let state = app_handle.state::<Arc<AppState>>();
    let mut process_guard = state.hermes_process.lock().unwrap();

    if process_guard.is_some() {
        return Ok("Hermes already running".to_string());
    }

    let resource_dir = app_handle.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let hermes_bin = resource_dir.join("binaries").join(if cfg!(target_os = "windows") {
        "hermes.exe"
    } else {
        "hermes"
    });

    if !hermes_bin.exists() {
        return Err(format!("Hermes binary not found at: {:?}", hermes_bin));
    }

    let config_dir = get_config_dir();
    let env_config_dir = config_dir.to_string_lossy().to_string();

    match Command::new(&hermes_bin)
        .env("CLAWMIND_DIR", &env_config_dir)
        .spawn()
    {
        Ok(child) => {
            *process_guard = Some(child);
            Ok(format!("Hermes started successfully from {:?}", hermes_bin))
        }
        Err(e) => Err(format!("Failed to start Hermes: {}", e)),
    }
}

// Start OpenClaw backend service
#[tauri::command]
async fn start_openclaw(app_handle: tauri::AppHandle) -> Result<String, String> {
    let state = app_handle.state::<Arc<AppState>>();
    let mut process_guard = state.openclaw_process.lock().unwrap();

    if process_guard.is_some() {
        return Ok("OpenClaw already running".to_string());
    }

    let resource_dir = app_handle.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let openclaw_bin = resource_dir.join("binaries").join(if cfg!(target_os = "windows") {
        "openclaw.exe"
    } else {
        "openclaw"
    });

    if !openclaw_bin.exists() {
        return Err(format!("OpenClaw binary not found at: {:?}", openclaw_bin));
    }

    let child = Command::new(&openclaw_bin)
        .spawn()
        .map_err(|e| format!("Failed to start OpenClaw: {}", e))?;

    *process_guard = Some(child);
    Ok(format!("OpenClaw started successfully from {:?}", openclaw_bin))
}

// Stop all backend services
#[tauri::command]
async fn stop_services(app_handle: tauri::AppHandle) -> Result<String, String> {
    let state = app_handle.state::<Arc<AppState>>();
    kill_all_processes(state.inner());
    Ok("All services stopped".to_string())
}

// Get service status
#[tauri::command]
async fn get_service_status(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<Arc<AppState>>();
    let hermes_guard = state.hermes_process.lock().unwrap();
    let openclaw_guard = state.openclaw_process.lock().unwrap();

    Ok(serde_json::json!({
        "hermes": hermes_guard.is_some(),
        "openclaw": openclaw_guard.is_some(),
    }))
}

fn get_config_dir() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("ClawMind");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

// Save configuration
#[tauri::command]
async fn save_config(config: Config) -> Result<String, String> {
    let config_dir = get_config_dir();
    let config_file = config_dir.join("config.json");

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_file, json)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(format!("Configuration saved to {:?}", config_file))
}

// Load configuration
#[tauri::command]
async fn load_config() -> Result<Config, String> {
    let config_dir = get_config_dir();
    let config_file = config_dir.join("config.json");

    if !config_file.exists() {
        return Err("Configuration file not found".to_string());
    }

    let json = fs::read_to_string(&config_file)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let config: Config = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(config)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared_state = Arc::new(AppState {
        hermes_process: Mutex::new(None),
        openclaw_process: Mutex::new(None),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(shared_state.clone())
        .invoke_handler(tauri::generate_handler![
            start_hermes,
            start_openclaw,
            stop_services,
            get_service_status,
            save_config,
            load_config
        ])
        .setup(move |app| {
            // Auto-start services on app launch
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                let _ = start_hermes(handle.clone()).await;
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                let _ = start_openclaw(handle).await;
            });

            // Kill child processes when the main window closes
            let cleanup_state = shared_state.clone();
            let window = app.get_webview_window("main").expect("main window not found");
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    kill_all_processes(&cleanup_state);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
