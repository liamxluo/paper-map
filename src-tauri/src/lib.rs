//! The few native things the Mac app needs: reading and writing your library in a real folder
//! (in iCloud Drive or in Documents), saving exported files to Downloads, and opening web links.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;

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

/// Secrets (the GitHub token) live in the macOS Keychain, under "Paper Map", never in a file.
const KEYCHAIN_SERVICE: &str = "Paper Map";

#[tauri::command]
fn secret_set(key: String, value: String) -> Result<(), String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, &key)
        .and_then(|e| e.set_password(&value))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(key: String) -> Result<Option<String>, String> {
    match keyring::Entry::new(KEYCHAIN_SERVICE, &key).and_then(|e| e.get_password()) {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secret_delete(key: String) -> Result<(), String> {
    match keyring::Entry::new(KEYCHAIN_SERVICE, &key).and_then(|e| e.delete_credential()) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// What a new version says about itself, for the app's own prompt.
#[derive(Serialize)]
struct UpdateInfo {
    version: String,
    notes: Option<String>,
    date: Option<String>,
}

/// Is there a newer Paper Map? It asks GitHub Releases for latest.json; the update's signature is checked against the
/// public key built into this app before anything is installed.
#[tauri::command]
async fn update_check(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(u)) => Ok(Some(UpdateInfo { version: u.version.clone(), notes: u.body.clone(), date: u.date.map(|d| d.to_string()) })),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Download the new version, verify it, put it in place of this app (only the app: your library lives elsewhere) and restart.
/// If the download is cut short nothing is replaced, and this version keeps running.
#[tauri::command]
async fn update_install(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else { return Ok(()) };
    let progress = app.clone();
    let mut got: u64 = 0;
    update
        .download_and_install(
            move |chunk, total| {
                got += chunk as u64;
                let _ = progress.emit("update-progress", (got, total));
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

/// Fetches a file the way the system does, outside the web page's cross-site rules: Zotero hands its PDFs over from a
/// storage service that a page may not read directly. Uses the Mac's own curl, follows redirects, returns the bytes.
#[tauri::command]
fn fetch_bytes(url: String, headers: Vec<(String, String)>) -> Result<tauri::ipc::Response, String> {
    if !url.starts_with("https://") { return Err("only https".into()); }
    let mut cmd = std::process::Command::new("/usr/bin/curl");
    cmd.arg("-sSL").arg("--fail").arg("--max-time").arg("300");
    for (k, v) in headers { cmd.arg("-H").arg(format!("{}: {}", k, v)); }
    cmd.arg(&url);
    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).trim().to_string()); }
    Ok(tauri::ipc::Response::new(out.stdout))
}

/// Sends a file to GitHub the way the system does: GitHub's upload address does not let a web page post across sites.
/// The bytes come in raw; the address and the key in two headers. Uses the Mac's own curl; returns GitHub's answer.
#[tauri::command]
fn upload_bytes(request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let data = match request.body() { tauri::ipc::InvokeBody::Raw(d) => d.clone(), _ => return Err("no data".into()) };
    let h = request.headers();
    let url = h.get("x-url").and_then(|v| v.to_str().ok()).ok_or("no url")?.to_string();
    if !url.starts_with("https://uploads.github.com/") { return Err("only GitHub uploads".into()); }
    let auth = h.get("x-auth").and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
    let tmp = std::env::temp_dir().join(format!("pm-upload-{}-{}", std::process::id(), data.len()));
    std::fs::write(&tmp, &data).map_err(|e| e.to_string())?;
    let out = std::process::Command::new("/usr/bin/curl")
        .arg("-sS").arg("--max-time").arg("3600").arg("-w").arg("\n%{http_code}")
        .arg("-X").arg("POST")
        .arg("-H").arg(format!("Authorization: {}", auth))
        .arg("-H").arg("Accept: application/vnd.github+json")
        .arg("-H").arg("Content-Type: application/octet-stream")
        .arg("--data-binary").arg(format!("@{}", tmp.display()))
        .arg(&url).output().map_err(|e| e.to_string());
    let _ = std::fs::remove_file(&tmp);
    let out = out?;
    let text = String::from_utf8_lossy(&out.stdout).to_string();
    let (body, code) = match text.rfind('\n') { Some(i) => (text[..i].to_string(), text[i + 1..].trim().to_string()), None => (text.clone(), String::new()) };
    if !code.starts_with('2') { return Err(format!("GitHub said {}: {}", code, body.chars().take(200).collect::<String>())); }
    Ok(body)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_bytes,
            upload_bytes,
            fs_stat,
            fs_read,
            fs_write,
            fs_mkdir,
            fs_remove,
            fs_list,
            storage_places,
            save_download,
            open_url,
            secret_set,
            secret_get,
            secret_delete,
            update_check,
            update_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running Paper Map");
}
