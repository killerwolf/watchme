use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use serde::{Deserialize, Serialize};
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

const TRAY_ICON: &[u8] = include_bytes!("../../misc/tray-icon.png");

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cmd: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    pub auto_launch: bool,
    pub prefilter_regex: String,
    pub desktop_notifications: bool,
    pub notification_sound: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            auto_launch: false,
            prefilter_regex: String::new(),
            desktop_notifications: true,
            notification_sound: true,
        }
    }
}

impl Preferences {
    pub fn with_defaults(stored: Option<Self>) -> Self {
        stored.unwrap_or_default()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencePatch {
    pub auto_launch: Option<bool>,
    pub prefilter_regex: Option<String>,
    pub desktop_notifications: Option<bool>,
    pub notification_sound: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePreferencesResult {
    pub login_item_success: bool,
}

pub struct AppState {
    pub preferences: Mutex<Preferences>,
    pub quitting: AtomicBool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            preferences: Mutex::new(Preferences::default()),
            quitting: AtomicBool::new(false),
        }
    }
}

pub fn tray_badge(count: usize) -> String {
    match count {
        0 => String::new(),
        1..=99 => count.to_string(),
        _ => "99+".to_string(),
    }
}

pub fn tray_tooltip(count: usize) -> String {
    format!(
        "WatchMe - Monitoring {count} process{}",
        if count == 1 { "" } else { "es" }
    )
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join("preferences.json"))
        .map_err(|error| error.to_string())
}

fn load_preferences(app: &AppHandle) -> Preferences {
    let mut candidates = Vec::new();
    if let Ok(path) = preferences_path(app) {
        candidates.push(path);
    }
    // The previous runtime used a config.json in the app's data directory.
    // Read that shape once so existing users do not lose their preferences
    // on the first Tauri launch.
    if let Ok(directory) = app.path().app_data_dir() {
        candidates.push(directory.join("config.json"));
    }
    if let Ok(directory) = app.path().app_config_dir() {
        candidates.push(directory.join("config.json"));
    }
    #[cfg(target_os = "macos")]
    if let Ok(home) = app.path().home_dir() {
        candidates.push(
            home.join("Library")
                .join("Application Support")
                .join("watchme")
                .join("config.json"),
        );
    }

    for path in candidates {
        let Ok(contents) = fs::read_to_string(path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&contents) else {
            continue;
        };
        let stored = value.get("preferences").cloned().unwrap_or(value);
        if let Ok(preferences) = serde_json::from_value(stored) {
            return preferences;
        }
    }
    Preferences::default()
}

fn persist_preferences(app: &AppHandle, preferences: &Preferences) -> Result<(), String> {
    let path = preferences_path(app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "preference path has no parent".to_string())?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let contents = serde_json::to_string_pretty(preferences).map_err(|error| error.to_string())?;
    fs::write(path, format!("{contents}\n")).map_err(|error| error.to_string())
}

fn apply_autostart(app: &AppHandle, enabled: bool) -> bool {
    let result = if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    };
    result.is_ok()
}

#[tauri::command]
fn get_processes() -> Result<Vec<ProcessInfo>, String> {
    let mut system = System::new_all();
    system.refresh_all();

    Ok(system
        .processes()
        .iter()
        .map(|(pid, process)| ProcessInfo {
            pid: pid.as_u32(),
            name: process.name().to_string_lossy().into_owned(),
            cmd: process
                .cmd()
                .iter()
                .map(|part| part.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" "),
        })
        .collect())
}

#[tauri::command]
fn get_preferences(state: State<'_, AppState>) -> Result<Preferences, String> {
    state
        .preferences
        .lock()
        .map(|preferences| preferences.clone())
        .map_err(|_| "preferences lock poisoned".to_string())
}

#[tauri::command]
fn save_preferences(
    app: AppHandle,
    state: State<'_, AppState>,
    new_preferences: PreferencePatch,
) -> Result<SavePreferencesResult, String> {
    let mut preferences = state
        .preferences
        .lock()
        .map_err(|_| "preferences lock poisoned".to_string())?;

    if let Some(value) = new_preferences.auto_launch {
        preferences.auto_launch = value;
    }
    if let Some(value) = new_preferences.prefilter_regex {
        preferences.prefilter_regex = value;
    }
    if let Some(value) = new_preferences.desktop_notifications {
        preferences.desktop_notifications = value;
    }
    if let Some(value) = new_preferences.notification_sound {
        preferences.notification_sound = value;
    }

    persist_preferences(&app, &preferences)?;
    let login_item_success = apply_autostart(&app, preferences.auto_launch);
    Ok(SavePreferencesResult {
        login_item_success,
    })
}

#[tauri::command]
fn update_tray_tooltip(app: AppHandle, num_processes: usize) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main") else {
        return Err("tray icon is not available".to_string());
    };
    tray.set_tooltip(Some(&tray_tooltip(num_processes)))
        .map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    tray.set_title(Some(&tray_badge(num_processes)))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle, state: State<'_, AppState>) {
    state.quitting.store(true, Ordering::Relaxed);
    app.exit(0);
}

fn toggle_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let state = app.state::<AppState>();
            let preferences = load_preferences(app.handle());
            apply_autostart(app.handle(), preferences.auto_launch);
            *state
                .preferences
                .lock()
                .map_err(|_| std::io::Error::other("preferences lock poisoned"))? = preferences;

            let quit = MenuItem::with_id(app, "quit", "Quit WatchMe", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;
            let icon = tauri::image::Image::from_bytes(TRAY_ICON)?;
            TrayIconBuilder::with_id("main")
                .icon(icon)
                .icon_as_template(true)
                .tooltip(tray_tooltip(0))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id() == "quit" {
                        if let Some(state) = app.try_state::<AppState>() {
                            state.quitting.store(true, Ordering::Relaxed);
                        }
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        let should_quit = app_handle
                            .try_state::<AppState>()
                            .map(|state| state.quitting.load(Ordering::Relaxed))
                            .unwrap_or(false);
                        if !should_quit {
                            api.prevent_close();
                            let _ = app_handle
                                .get_webview_window("main")
                                .and_then(|window| window.hide().ok());
                        }
                    }
                    WindowEvent::Focused(false) => {
                        let _ = app_handle
                            .get_webview_window("main")
                            .and_then(|window| window.hide().ok());
                    }
                    _ => {}
                });
            }

            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_processes,
            get_preferences,
            save_preferences,
            update_tray_tooltip,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running WatchMe");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preferences_default_to_the_historical_behavior() {
        assert_eq!(
            Preferences::default(),
            Preferences {
                auto_launch: false,
                prefilter_regex: String::new(),
                desktop_notifications: true,
                notification_sound: true,
            }
        );
    }

    #[test]
    fn tray_badges_are_bounded() {
        assert_eq!(tray_badge(0), "");
        assert_eq!(tray_badge(3), "3");
        assert_eq!(tray_badge(100), "99+");
    }

    #[test]
    fn tray_tooltip_pluralises() {
        assert_eq!(tray_tooltip(1), "WatchMe - Monitoring 1 process");
        assert_eq!(tray_tooltip(2), "WatchMe - Monitoring 2 processes");
    }
}
