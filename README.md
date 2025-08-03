# lpop

A CLI tool for managing environment variables in the system keychain

## Building as Binary Executable

This CLI is be built as a standalone binary executable

#### Prerequisites

- [Bun](https://bun.sh/) installed on your system

#### Build Steps

1. **Build the binary:**
   ```bash
   bun build
   ```

This will create a `lpop` binary file in your project root that can be distributed and run without Node.js or Bun installed.

### Build Process

The Bun build process consists of:

1. **Bun compilation** with minification and optimization
2. **Binary creation** with proper naming and permissions
3. **Symlink creation** for easy access

### Usage

After building, you can run the binary directly:

```bash
./lpop --help
```

Or copy it to a location in your PATH:

```bash
sudo cp lpop /usr/local/bin/
lpop --help
```

## Development

For development, you can run the CLI directly:

```bash
bun dev
```

Or build and run:

```bash
bun build
./lpop
```

### MacOS Keychain Note:

Running the CLI via bun registers the keys in macOS Keychain with 'bun' rather than 'lpop' binary so if you swap between the methods you will be prompted for password entry on the second method you use e.g. if you first use `bun dev` then running `./lpop` on the same repo will prompt for password every time.

## Installation

```bash
# Install dependencies
bun install

# Build the project
bun build

```

## Usage

### Smart Commands

The main command intelligently determines what to do based on your input:

```bash
# Get all variables for current repo
lpop

# Add/update from .env file
lpop .env

# Add/update single variable
lpop API_KEY=secret123

# Export to file (if variables exist)
lpop output.env
```

### Explicit Commands

```bash
# Add variables
lpop add .env                    # From file
lpop add "DB_URL=postgres://..."  # Single variable

# Get variables
lpop get                         # All variables
lpop get API_KEY                 # Specific variable
lpop get -o backup.env           # Export to file

# Update (same as add)
lpop update .env
lpop update "API_KEY=newsecret"

# Remove variables
lpop remove API_KEY              # Single variable
lpop clear --confirm             # All variables

# Different environments
lpop add .env --env production
lpop get --env staging
```

## How It Works

Variables are stored in your system keychain using service names like:

- `github.com/user/repo?env=development`
- `local/directory?env=production`

The tool automatically detects your git repository context, or falls back to the current directory name.

### Environment-Specific Variables

lpop supports two types of variable storage:

**Default Variables (No Environment)**

- Variables added without `--env` are stored as default values
- These variables are loaded for **every environment** in the repository
- Use these for shared configuration that applies across all environments

**Environment-Specific Variables**

- Variables added with `--env` override default values for that specific environment
- These variables are **only loaded** when the same environment is specified
- Use these for environment-specific configuration (e.g., different API keys per environment)

**Priority System:**

1. Environment-specific variables take precedence over default variables
2. If no environment-specific variable exists, the default variable is used
3. This allows you to have shared defaults with environment-specific overrides

## Environment Variables

The `.env` file format is fully supported with comment preservation:

```bash
# Database configuration
DATABASE_URL=postgresql://localhost:5432/myapp
API_KEY=secret123  # Your API key here

# Redis settings
REDIS_URL=redis://localhost:6379
```

## Examples

### Basic Usage

```bash
# Store development variables
lpop add .env.development

# Get production variables
lpop get --env production

# Copy variables between environments
lpop get --env production -o .env.staging
lpop add .env.staging --env staging

# Quick variable updates
lpop "DEBUG=true"
lpop "PORT=3000"
```

### Environment-Specific Examples

```bash
# Add default variables (shared across all environments)
lpop add "APP_NAME=myapp"
lpop add "DEBUG=false"
lpop add "PORT=3000"

# Add environment-specific variables (override defaults)
lpop add "DATABASE_URL=postgres://prod-db:5432/myapp" --env production
lpop add "DATABASE_URL=postgres://dev-db:5432/myapp" --env development
lpop add "API_KEY=prod-secret-key" --env production
lpop add "API_KEY=dev-secret-key" --env development

# Retrieve variables (environment-specific takes precedence)
lpop get --env production
# Returns: APP_NAME=myapp, DEBUG=false, PORT=3000, DATABASE_URL=postgres://prod-db:5432/myapp, API_KEY=prod-secret-key

lpop get --env development
# Returns: APP_NAME=myapp, DEBUG=false, PORT=3000, DATABASE_URL=postgres://dev-db:5432/myapp, API_KEY=dev-secret-key

lpop get  # No environment specified
# Returns: APP_NAME=myapp, DEBUG=false, PORT=3000 (no environment-specific variables)
```

## Security

- Variables are stored securely in your system keychain
- Uses native keychain APIs (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)
- No variables are stored in plain text files or logs
- Git repository context prevents accidental cross-project variable sharing

## Requirements

- Node.js 24+
- bun (recommended) or npm
