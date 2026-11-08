//! Future provider boundary. The pilot only records local submissions.
use crate::{history::History, storage::Result};
use std::path::PathBuf;

pub trait PromptSubmission {
    fn submit(&self, text: String) -> Result<History>;
}
pub struct LocalHistoryOnly(pub PathBuf);
impl PromptSubmission for LocalHistoryOnly {
    fn submit(&self, text: String) -> Result<History> {
        History::submit(&self.0, text)
    }
}
