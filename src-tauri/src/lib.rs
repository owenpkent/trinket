use tauri::Manager;

/// Pin the window above everything else.
///
/// This is the one thing the desktop build offers that the web build cannot:
/// a fidget toy is meant to sit in a corner of the screen while you think, and
/// that only works if it stays visible.
#[tauri::command]
fn set_always_on_top(window: tauri::Window, value: bool) -> Result<(), String> {
    window.set_always_on_top(value).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_always_on_top])
        .setup(|app| {
            // The window is created hidden in tauri.conf.json and shown here, so
            // the first frame the user sees is the rendered shelf rather than a
            // white rectangle.
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Trinket failed to start");
}
