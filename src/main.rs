mod cli;
mod env_parser;
mod git_resolver;
mod keychain;

use anyhow::Result;
use clap::Parser;
use cli::{Cli, Commands};

fn main() -> Result<()> {
    let cli = Cli::parse();
    
    match cli.command {
        Some(Commands::Get { key, env, all }) => {
            cli::handle_get(key, env, all)?;
        }
        Some(Commands::Set { key, value, env, file }) => {
            cli::handle_set(key, value, env, file)?;
        }
        Some(Commands::Delete { key, env, all }) => {
            cli::handle_delete(key, env, all)?;
        }
        Some(Commands::List { env }) => {
            cli::handle_list(env)?;
        }
        None => {
            // Smart command inference
            if let Some(input) = cli.input {
                cli::handle_smart_command(input)?;
            } else {
                cli::handle_get(None, Some(cli.env), false)?;
            }
        }
    }
    
    Ok(())
}