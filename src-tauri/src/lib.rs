//! The few native things the Mac app needs: reading and writing your library in a real folder
//! (in iCloud Drive or in Documents), saving exported files to Downloads, and opening web links.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Serialize)]
struct Stat {
    dir: bool,
    size: u64,
    mtime: u64,
}

#[derive(Serialize)]
struct Entry {
    name: String,
    dir: bool,
}

#[derive(Serialize)]
struct Places {
    home: Option<String>,
    documents: Option<String>,
    downloads: Option<String>,
    icloud: Option<String>,
}

fn err(e: std::io::Error) -> String {
    if e.kind() == std::io::ErrorKind::NotFound {
        "NotFound".to_string()
    } else {
        e.to_string()
    }
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn text(p: PathBuf) -> String {
    p.to_string_lossy().to_string()
}

#[tauri::command]
fn fs_stat(path: String) -> Result<Option<Stat>, String> {
    match fs::metadata(&path) {
        Ok(m) => {
            let mtime = m
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            Ok(Some(Stat { dir: m.is_dir(), size: m.len(), mtime }))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn fs_read(path: String) -> Result<String, String> {
    fs::read(&path).map(|b| STANDARD.encode(b)).map_err(err)
}

/// Writes the whole file at once: first beside it, then moved into place, so iCloud never sees half a file.
#[tauri::command]
fn fs_write(path: String, data: String) -> Result<(), String> {
    let bytes = STANDARD.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    let target = PathBuf::from(&path);
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir).map_err(err)?;
    }
    let tmp = PathBuf::from(format!("{}.pmtmp", path));
    fs::write(&tmp, &bytes).map_err(err)?;
    fs::rename(&tmp, &target).map_err(err)
}

#[tauri::command]
fn fs_mkdir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(err)
}

#[tauri::command]
fn fs_remove(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(err)
    } else {
        fs::remove_file(p).map_err(err)
    }
}

#[tauri::command]
fn fs_list(path: String) -> Result<Vec<Entry>, String> {
    let mut out = Vec::new();
    for item in fs::read_dir(&path).map_err(err)? {
        let item = item.map_err(err)?;
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name.ends_with(".pmtmp") || name.ends_with(".icloud") {
            continue;
        }
        let dir = item.file_type().map(|t| t.is_dir()).unwrap_or(false);
        out.push(Entry { name, dir });
    }
    Ok(out)
}

#[tauri::command]
fn storage_places() -> Places {
    let h = home();
    let icloud = h
        .as_ref()
        .map(|h| h.join("Library/Mobile Documents/com~apple~CloudDocs"))
        .filter(|p| p.is_dir())
        .map(text);
    Places {
        home: h.clone().map(text),
        documents: h.as_ref().map(|h| h.join("Documents")).map(text),
        downloads: h.as_ref().map(|h| h.join("Downloads")).map(text),
        icloud,
    }
}

/// Saves an exported file in Downloads (never over another file) and shows it in Finder.
#[tauri::command]
fn save_download(name: String, data: String) -> Result<String, String> {
    let bytes = STANDARD.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    let dir = home()
        .map(|h| h.join("Downloads"))
        .ok_or_else(|| "No home folder".to_string())?;
    fs::create_dir_all(&dir).map_err(err)?;
    let clean: String = name
        .chars()
        .map(|c| if c == '/' || c == ':' { '-' } else { c })
        .collect();
    let (stem, ext) = match clean.rfind('.') {
        Some(i) if i > 0 => (clean[..i].to_string(), clean[i..].to_string()),
        _ => (clean.clone(), String::new()),
    };
    let mut target = dir.join(&clean);
    let mut k = 2;
    while target.exists() {
        target = dir.join(format!("{} {}{}", stem, k, ext));
        k += 1;
    }
    fs::write(&target, bytes).map_err(err)?;
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg("-R").arg(&target).spawn();
    }
    Ok(text(target))
}

/// Opens a web link in your browser rather than inside the app.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://") || url.starts_with("mailto:")) {
        return Err("Not a web link".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fs_stat,
            fs_read,
            fs_write,
            fs_mkdir,
            fs_remove,
            fs_list,
            storage_places,
            save_download,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running Paper Map");
}
