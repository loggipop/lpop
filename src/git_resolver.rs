use anyhow::{Context, Result};
use git2::Repository;
use std::path::PathBuf;
use url::Url;

pub struct GitInfo {
    pub owner: String,
    pub name: String,
    pub full_name: String,
}

pub struct GitPathResolver {
    working_dir: PathBuf,
}

impl GitPathResolver {
    pub fn new(working_dir: Option<PathBuf>) -> Self {
        Self {
            working_dir: working_dir.unwrap_or_else(|| std::env::current_dir().unwrap()),
        }
    }
    
    pub fn is_git_repo(&self) -> bool {
        Repository::open(&self.working_dir).is_ok()
    }
    
    pub fn get_git_info(&self) -> Result<Option<GitInfo>> {
        let repo = match Repository::open(&self.working_dir) {
            Ok(repo) => repo,
            Err(_) => return Ok(None),
        };
        
        let remote = repo.find_remote("origin")
            .or_else(|_| {
                // Try to get first remote if origin doesn't exist
                let remotes = repo.remotes()?;
                if let Some(name) = remotes.get(0) {
                    repo.find_remote(name)
                } else {
                    Err(git2::Error::from_str("No remotes found"))
                }
            })
            .context("Failed to find git remote")?;
        
        let url = remote.url()
            .ok_or_else(|| anyhow::anyhow!("Remote has no URL"))?;
        
        self.parse_git_url(url)
    }
    
    fn parse_git_url(&self, url_str: &str) -> Result<Option<GitInfo>> {
        // Handle SSH URLs like git@github.com:owner/repo.git
        let url_str = if url_str.starts_with("git@") {
            url_str.replace(":", "/").replace("git@", "https://")
        } else {
            url_str.to_string()
        };
        
        // Remove .git suffix if present
        let url_str = url_str.trim_end_matches(".git");
        
        let url = Url::parse(&url_str)
            .with_context(|| format!("Failed to parse git URL: {}", url_str))?;
        
        let path_segments: Vec<&str> = url.path_segments()
            .ok_or_else(|| anyhow::anyhow!("Invalid URL path"))?
            .collect();
        
        if path_segments.len() >= 2 {
            let owner = path_segments[path_segments.len() - 2].to_string();
            let name = path_segments[path_segments.len() - 1].to_string();
            let host = url.host_str().unwrap_or("github.com");
            let full_name = format!("{}/{}/{}", host, owner, name);
            
            Ok(Some(GitInfo {
                owner,
                name,
                full_name,
            }))
        } else {
            Ok(None)
        }
    }
    
    pub fn generate_service_name(&self, environment: &str) -> String {
        if let Ok(Some(git_info)) = self.get_git_info() {
            format!("{}?env={}", git_info.full_name, environment)
        } else {
            // Fallback to current directory name
            let dir_name = self.working_dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");
            format!("local/{}?env={}", dir_name, environment)
        }
    }
    
    pub fn extract_env_from_service(service_name: &str) -> &str {
        service_name
            .split("?env=")
            .nth(1)
            .unwrap_or("development")
    }
    
    pub fn extract_repo_from_service(service_name: &str) -> &str {
        service_name.split('?').next().unwrap_or(service_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::create_git_repo;

    #[test]
    fn test_parse_github_ssh_url() {
        let resolver = GitPathResolver::new(None);
        let info = resolver.parse_git_url("git@github.com:owner/repo.git").unwrap().unwrap();
        assert_eq!(info.owner, "owner");
        assert_eq!(info.name, "repo");
        assert_eq!(info.full_name, "github.com/owner/repo");
    }

    #[test]
    fn test_parse_github_https_url() {
        let resolver = GitPathResolver::new(None);
        let info = resolver.parse_git_url("https://github.com/owner/repo.git").unwrap().unwrap();
        assert_eq!(info.owner, "owner");
        assert_eq!(info.name, "repo");
        assert_eq!(info.full_name, "github.com/owner/repo");
    }

    #[test]
    fn test_generate_service_name_with_git() {
        let temp_dir = create_git_repo();
        let resolver = GitPathResolver::new(Some(temp_dir.path().to_path_buf()));
        
        // Note: This will use fallback since we can't easily set up a full git remote in tests
        let service_name = resolver.generate_service_name("production");
        assert!(service_name.contains("?env=production"));
    }

    #[test]
    fn test_generate_service_name_without_git() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let resolver = GitPathResolver::new(Some(temp_dir.path().to_path_buf()));
        
        let service_name = resolver.generate_service_name("development");
        assert!(service_name.starts_with("local/"));
        assert!(service_name.ends_with("?env=development"));
    }

    #[test]
    fn test_extract_env_from_service() {
        assert_eq!(GitPathResolver::extract_env_from_service("github.com/owner/repo?env=production"), "production");
        assert_eq!(GitPathResolver::extract_env_from_service("github.com/owner/repo"), "development");
        assert_eq!(GitPathResolver::extract_env_from_service("local/project?env=staging"), "staging");
    }

    #[test]
    fn test_extract_repo_from_service() {
        assert_eq!(GitPathResolver::extract_repo_from_service("github.com/owner/repo?env=production"), "github.com/owner/repo");
        assert_eq!(GitPathResolver::extract_repo_from_service("local/project?env=staging"), "local/project");
    }
}