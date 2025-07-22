use tempfile::TempDir;
use std::fs;
use std::path::PathBuf;

pub fn create_test_env_file(content: &str) -> (TempDir, PathBuf) {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join(".env");
    fs::write(&file_path, content).unwrap();
    (temp_dir, file_path)
}

pub fn create_git_repo() -> TempDir {
    let temp_dir = TempDir::new().unwrap();
    let repo = git2::Repository::init(temp_dir.path()).unwrap();
    
    // Add a dummy remote
    repo.remote("origin", "https://github.com/test/repo.git").unwrap();
    
    temp_dir
}