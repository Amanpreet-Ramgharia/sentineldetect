#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                tauri::WebviewWindowBuilder::new(
                    app, "main",
                    tauri::WebviewUrl::External("https://smartswingalerts.com".parse().unwrap()),
                )
                .title("SentinelDetect")
                .inner_size(1400.0, 900.0)
                .min_inner_size(1000.0, 650.0)
                .build()?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running SentinelDetect")
}
