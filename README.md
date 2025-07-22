# lpop

A CLI tool for managing environment variables securely in the system keychain. Organizes variables by git repository and environment.

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Install globally (optional)
npm install -g .
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

## Security

- Variables are stored securely in your system keychain
- Uses native keychain APIs (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)
- No variables are stored in plain text files or logs
- Git repository context prevents accidental cross-project variable sharing

## Requirements

- Node.js 24+
- pnpm (recommended) or npm