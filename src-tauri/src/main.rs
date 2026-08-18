// Hide the console window on Windows release builds. Debug builds keep it so
// panics and log output are visible.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    trinket_lib::run()
}
