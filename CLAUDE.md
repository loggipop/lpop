# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

lpop is a CLI tool for managing environment variables securely in the system keychain. It uses git repository context to organize variables by repo and environment.

## Development Commands

```bash
# Install dependencies
bun install

# Build the project
bun build

# Run in development mode
bun dev

# Clean build artifacts
bun clean

# Watch for changes during development
bun watch

# Run the built CLI
bun start
```

## Architecture

### Core Components

- **PasswordManager** (`src/password-storage.ts`) - Storage layer for storing passwords/secrets.
- **GitPathResolver** (`src/git-path-resolver.ts`) - Generates service names from git remotes in format `owner/repo?env=environment`
- **EnvFileParser** (`src/env-file-parser.ts`) - Parses .env files while preserving comments and formatting
- **LpopCLI** (`src/cli.ts`) - Main CLI interface with smart command inference

### Service Name Format

Variables are stored in keychain using service names like:

- `github.com/user/repo?env=development`
- `local/dirname?env=production` (fallback for non-git directories)

### Smart Command Inference

The main command `lpop <input>` intelligently determines the operation:

- File exists locally → add/update variables
- Contains `=` → single variable assignment
- No input → get current repo's variables
- Otherwise → attempt to restore to specified path

## Technology Stack

- **Node 24+** with native TypeScript support
- **ESM modules** throughout
- **@napi-rs/keyring** for secure keychain storage (modern replacement for keytar)
- **commander.js** for CLI parsing
- **simple-git** for git operations
- **chalk** for colored output
- **git-url-parse** for parsing git remote URLs

## Key Files

- `src/index.ts` - CLI entry point with main() function
- `package.json` - ESM module configuration with Node 24+ requirement
- `tsconfig.json` - TypeScript config for ESNext/ESM compilation

## Important Notes

- Uses `@napi-rs/keyring` for password management
- The `findCredentials()` function works natively with @napi-rs/keyring
- Service names follow URL-like format for consistent organization
- Smart CLI inference reduces the need for explicit commands

## Development Guidelines

- Use bun to build and install libraries don't use pnpm or npm
