use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::*;
use std::path::{Path, PathBuf};

use crate::{
    env_parser::EnvFileParser,
    git_resolver::GitPathResolver,
    keychain::KeychainManager,
};

#[derive(Parser)]
#[command(name = "lpop")]
#[command(about = "Secure environment variable manager using system keychain")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
    
    /// Input for smart command inference
    pub input: Option<String>,
    
    /// Environment name
    #[arg(short, long, default_value = "development")]
    pub env: String,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Get environment variable(s)
    Get {
        /// Variable name (omit to get all)
        key: Option<String>,
        
        /// Environment name
        #[arg(short, long)]
        env: Option<String>,
        
        /// Get all environments for this repo
        #[arg(short, long)]
        all: bool,
    },
    
    /// Set environment variable(s)
    Set {
        /// Variable name
        key: Option<String>,
        
        /// Variable value
        value: Option<String>,
        
        /// Environment name
        #[arg(short, long)]
        env: Option<String>,
        
        /// Read from .env file
        #[arg(short, long)]
        file: Option<PathBuf>,
    },
    
    /// Delete environment variable(s)
    Delete {
        /// Variable name (omit to delete all)
        key: Option<String>,
        
        /// Environment name
        #[arg(short, long)]
        env: Option<String>,
        
        /// Delete all variables for this environment
        #[arg(short, long)]
        all: bool,
    },
    
    /// List all environments for current repo
    List {
        /// Filter by environment
        #[arg(short, long)]
        env: Option<String>,
    },
}

pub fn handle_get(key: Option<String>, env: Option<String>, _all: bool) -> Result<()> {
    let git_resolver = GitPathResolver::new(None);
    let env = env.unwrap_or_else(|| "development".to_string());
    let service_name = git_resolver.generate_service_name(&env);
    let keychain = KeychainManager::new(service_name.clone());
    
    if let Some(key) = key {
        // Get single variable
        match keychain.get_var(&key)? {
            Some(value) => {
                println!("{}", value);
            }
            None => {
                eprintln!("{} Variable '{}' not found in {} environment", 
                    "✗".red(), key, env);
                std::process::exit(1);
            }
        }
    } else {
        // Get all variables
        println!("{} {}", "Repository:".bright_blue(), 
            GitPathResolver::extract_repo_from_service(&service_name));
        println!("{} {}\n", "Environment:".bright_blue(), env);
        
        // Note: This is a limitation of the keyring crate
        // In real implementation, we'd need to track keys separately
        println!("{}", "Note: Listing all variables not yet implemented".yellow());
    }
    
    Ok(())
}

pub fn handle_set(
    key: Option<String>,
    value: Option<String>,
    env: Option<String>,
    file: Option<PathBuf>,
) -> Result<()> {
    let git_resolver = GitPathResolver::new(None);
    let env = env.unwrap_or_else(|| "development".to_string());
    let service_name = git_resolver.generate_service_name(&env);
    let keychain = KeychainManager::new(service_name);
    
    if let Some(file_path) = file {
        // Set from file
        let vars = EnvFileParser::parse_file(&file_path)?;
        keychain.set_vars(vars.clone())?;
        
        println!("{} Set {} variables from {} in {} environment",
            "✓".green(),
            vars.len(),
            file_path.display(),
            env
        );
    } else if let (Some(key), Some(value)) = (key, value) {
        // Set single variable
        keychain.set_var(&key, &value)?;
        println!("{} Set {} in {} environment", "✓".green(), key, env);
    } else {
        eprintln!("{} Must provide either key/value or --file", "✗".red());
        std::process::exit(1);
    }
    
    Ok(())
}

pub fn handle_delete(key: Option<String>, env: Option<String>, all: bool) -> Result<()> {
    let git_resolver = GitPathResolver::new(None);
    let env = env.unwrap_or_else(|| "development".to_string());
    let service_name = git_resolver.generate_service_name(&env);
    let keychain = KeychainManager::new(service_name);
    
    if all {
        keychain.clear_all()?;
        println!("{} Deleted all variables in {} environment", "✓".green(), env);
    } else if let Some(key) = key {
        if keychain.delete_var(&key)? {
            println!("{} Deleted {} from {} environment", "✓".green(), key, env);
        } else {
            eprintln!("{} Variable '{}' not found in {} environment",
                "✗".red(), key, env);
            std::process::exit(1);
        }
    } else {
        eprintln!("{} Must provide either key or --all", "✗".red());
        std::process::exit(1);
    }
    
    Ok(())
}

pub fn handle_list(_env: Option<String>) -> Result<()> {
    let _git_resolver = GitPathResolver::new(None);
    
    // This would list all environments, but requires tracking them
    println!("{}", "Listing environments not yet implemented".yellow());
    
    Ok(())
}

pub fn handle_smart_command(input: String) -> Result<()> {
    let path = Path::new(&input);
    
    if path.exists() {
        // It's a file - set variables from it
        handle_set(None, None, None, Some(path.to_path_buf()))?;
    } else if input.contains('=') {
        // It's a key=value pair
        let parts: Vec<&str> = input.splitn(2, '=').collect();
        if parts.len() == 2 {
            handle_set(
                Some(parts[0].to_string()),
                Some(parts[1].to_string()),
                None,
                None,
            )?;
        } else {
            eprintln!("{} Invalid key=value format", "✗".red());
            std::process::exit(1);
        }
    } else if input.ends_with(".env") || input.contains('/') {
        // Looks like a file path - try to restore to it
        let git_resolver = GitPathResolver::new(None);
        let service_name = git_resolver.generate_service_name("development");
        let _keychain = KeychainManager::new(service_name);
        
        // Would get vars and write to file
        println!("{} Would restore variables to: {}", "→".blue(), input);
        println!("{}", "Restore functionality not yet implemented".yellow());
    } else {
        // Treat as variable name to get
        handle_get(Some(input), None, false)?;
    }
    
    Ok(())
}