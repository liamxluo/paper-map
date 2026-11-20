// Paper Map for Mac: the same app as the web version, in its own window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    paper_map_lib::run()
}
