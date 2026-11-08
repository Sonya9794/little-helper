use crate::storage::{self, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    pub id: u64,
    pub text: String,
    pub created_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct History {
    version: u32,
    next_id: u64,
    pub records: Vec<Record>,
}
#[derive(Debug, Serialize)]
pub struct Summary {
    pub latest: Option<String>,
    pub most_common: Option<String>,
    pub count: usize,
}
impl Default for History {
    fn default() -> Self {
        Self {
            version: 1,
            next_id: 1,
            records: vec![],
        }
    }
}
pub fn normalize(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
impl History {
    fn validate(&self) -> Result<()> {
        let mut ids = HashSet::new();
        if self.version != 1 || self.records.len() > 100 || self.next_id == 0 {
            return Err(
                "Unsupported or invalid prompt-history structure; data was not changed.".into(),
            );
        }
        for record in &self.records {
            if record.id == 0
                || record.id >= self.next_id
                || !ids.insert(record.id)
                || normalize(&record.text).is_empty()
                || chrono::DateTime::parse_from_rfc3339(&record.created_at).is_err()
            {
                return Err("Invalid prompt-history record; data was not changed.".into());
            }
        }
        Ok(())
    }
    pub fn load(path: &Path) -> Result<Self> {
        let history: Self = storage::read(path)?.unwrap_or_default();
        history
            .validate()
            .map_err(|e| format!("{}: {e}", path.display()))?;
        Ok(history)
    }
    pub fn append(&mut self, text: String, timestamp: String) -> Result<()> {
        if normalize(&text).is_empty() {
            return Err("Enter a non-empty prompt.".into());
        }
        let next = self
            .next_id
            .checked_add(1)
            .ok_or("Prompt identifiers exhausted")?;
        self.records.push(Record {
            id: self.next_id,
            text,
            created_at: timestamp,
        });
        self.next_id = next;
        if self.records.len() > 100 {
            self.records.drain(..self.records.len() - 100);
        }
        Ok(())
    }
    pub fn submit(path: &Path, text: String) -> Result<Self> {
        // Read and validate on every mutation. Never overwrite a corrupt/unreadable file.
        let mut history = Self::load(path)?;
        history.append(text, chrono::Utc::now().to_rfc3339())?;
        storage::write(path, &history)?;
        Ok(history)
    }
    pub fn summary(&self) -> Summary {
        let mut counts: HashMap<String, (usize, usize)> = HashMap::new();
        for (index, record) in self.records.iter().enumerate() {
            let entry = counts.entry(normalize(&record.text)).or_default();
            entry.0 += 1;
            entry.1 = index;
        }
        let most_common = counts
            .values()
            .max_by_key(|&&(count, index)| (count, index))
            .map(|&(_, index)| self.records[index].text.clone());
        Summary {
            latest: self.records.last().map(|r| r.text.clone()),
            most_common,
            count: self.records.len(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn add(h: &mut History, text: &str) {
        h.append(text.into(), "2026-11-08T12:00:00Z".into())
            .unwrap();
    }
    #[test]
    fn retains_only_latest_100_in_submission_order() {
        let mut h = History::default();
        for i in 0..125 {
            add(&mut h, &format!("prompt {i}"));
        }
        assert_eq!(h.records.len(), 100);
        assert_eq!(h.records[0].text, "prompt 25");
        assert_eq!(h.records[99].text, "prompt 124");
        assert_eq!(h.records[99].id, 125);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.json");
        storage::write(&path, &h).unwrap();
        let saved = History::load(&path).unwrap();
        assert_eq!(saved.records.len(), 100);
        assert_eq!(saved.records[0].text, "prompt 25");
    }
    #[test]
    fn normalizes_whitespace_case_and_preserves_original_display() {
        let mut h = History::default();
        add(&mut h, "Read  A\n Book");
        add(&mut h, "different");
        add(&mut h, "  read a\tbook  ");
        assert_eq!(normalize(" \nREAD\t A   BOOK "), "read a book");
        assert_eq!(h.summary().most_common.as_deref(), Some("  read a\tbook  "));
        assert_eq!(h.records[0].text, "Read  A\n Book");
    }
    #[test]
    fn frequency_wins_then_most_recent_breaks_ties() {
        let mut h = History::default();
        add(&mut h, "a");
        add(&mut h, "a");
        add(&mut h, "b");
        assert_eq!(h.summary().most_common.as_deref(), Some("a"));
        assert_eq!(h.summary().latest.as_deref(), Some("b"));
        add(&mut h, "b");
        assert_eq!(h.summary().most_common.as_deref(), Some("b"));
        add(&mut h, "A");
        assert_eq!(h.summary().most_common.as_deref(), Some("A"));
    }
    #[test]
    fn empty_rejected_and_empty_history_has_no_values() {
        let mut h = History::default();
        assert!(h.append(" \n\t ".into(), String::new()).is_err());
        assert!(h.summary().latest.is_none());
        assert!(h.summary().most_common.is_none());
    }
    #[test]
    fn malformed_file_is_reported_and_preserved() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.json");
        std::fs::write(&path, b"{broken").unwrap();
        assert!(History::submit(&path, "new".into())
            .unwrap_err()
            .contains("Invalid JSON"));
        assert_eq!(std::fs::read(&path).unwrap(), b"{broken");
    }
    #[test]
    fn saved_prompts_can_be_selected_again() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.json");
        History::submit(&path, "a".into()).unwrap();
        let second = History::submit(&path, "a".into()).unwrap();
        assert_eq!(History::load(&path).unwrap().records.len(), 2);
        assert_eq!(second.summary().most_common.as_deref(), Some("a"));
    }
}
