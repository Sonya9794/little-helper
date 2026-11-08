use serde::{de::DeserializeOwned, Serialize};
use std::{fs, io::Write, path::Path};

pub type Result<T> = std::result::Result<T, String>;

pub fn read<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|e| {
            format!("Invalid JSON in {}: {e}. The file was not changed. Repair it or move it aside manually.", path.display())
        }),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Cannot read {}: {e}. The file was not changed.", path.display())),
    }
}

// A same-directory temporary file is flushed and atomically replaces the destination.
// Failure leaves the old destination intact; tempfile cleans up incomplete writes.
pub fn write<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let save = || -> std::result::Result<(), Box<dyn std::error::Error>> {
        let parent = path.parent().ok_or("Missing storage directory")?;
        fs::create_dir_all(parent)?;
        let mut file = tempfile::NamedTempFile::new_in(parent)?;
        serde_json::to_writer_pretty(&mut file, value)?;
        file.write_all(b"\n")?;
        file.as_file().sync_all()?;
        file.persist(path)?;
        #[cfg(unix)]
        fs::File::open(parent)?.sync_all()?;
        Ok(())
    };
    save().map_err(|e| format!("Cannot safely save {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_is_normal_and_unreadable_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read::<serde_json::Value>(&dir.path().join("missing"))
            .unwrap()
            .is_none());
        assert!(read::<serde_json::Value>(dir.path()).is_err());
    }
    #[test]
    fn replacement_is_readable_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("state.json");
        write(&path, &vec![true]).unwrap();
        write(&path, &vec![false]).unwrap();
        assert_eq!(read::<Vec<bool>>(&path).unwrap().unwrap(), vec![false]);
    }
}
