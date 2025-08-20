# 🍭 lpop

> **Securely manage environment variables in your system keychain** 🔐

lpop stores your environment variables in the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service), making them secure and easy to manage.

1. Never lose your secrets - Call `lpop .env.local` to store all your secrets from an existing file
2. Delete your repos - when you clone again, just call `lpop .env.local` to get your secrets back
3. Clone multiple times or use git trees - call `lpop .env.local` and your secrets appear
4. Use with AI Coding tools - run Claude, or Cursor on 20 different copies of the repo, without ever giving it access to secrets
5. **Skip .env files entirely** - Use `lpop env -- npm start` to run commands with variables directly from keychain

## 🚀 Installation

```bash
# Install globally with npm
npm install -g @loggipop/lpop
```

## 📖 How It Works

lpop automatically detects your git repository and organizes variables by project and environment:

```
🔐 System Keychain
├── 📁 lpop://user/project
│   ├── 🔑 API_KEY - repo level api key
│   └── 🔑 SECRET_TOKEN - repo level token
├── 📁 lpop://user/project?env=development
│   └── 🔑 DATABASE_URL - development database
└── 📁 lpop://user/project?env=production
    └── 🔑 DATABASE_URL - production database
```

## 🎯 Quick Start

### 1️⃣ Store your environment variables

```bash
# From a .env file
lpop .env.local

# Or add a single variable
lpop API_KEY=secret123
```

### 2️⃣ Retrieve your variables

```bash
# Get all variables and write to .env.local file
# Uses .env.example as template if available
lpop

# Or specify a different output file
lpop .env.dev
```

### 3️⃣ Use different environments

```bash
# Store production variables
lpop .env.production --env production

# Retrieve staging variables
lpop --env staging
```

### 4️⃣ Run commands without .env files

```bash
# Run any command with keychain variables loaded
lpop env -- npm start
lpop env -- node server.js
lpop env -- bun dev

# Use with specific environments
lpop env --env production -- npm run build
```

## 🎨 Visual Examples

### 📥 Adding Variables

```bash
$ lpop .env
```

```
📂 Reading .env file...
🔐 Storing in: lpop://acme/app

✅ Added 3 variables:
• DATABASE_URL
• API_KEY
• JWT_SECRET
```

### 📤 Getting Variables with .env.example Template

When you have a `.env.example` file, lpop uses it as a template:

**`.env.example`:**

```env
# Database configuration
DATABASE_URL=
DB_PASSWORD=

# API configuration
API_KEY=
API_SECRET=
```

**Running `lpop` produces `.env.local`:**

```env
# Database configuration
DATABASE_URL=postgres://localhost:5432/mydb
DB_PASSWORD=

# API configuration
API_KEY=sk-1234567890abcdef
API_SECRET=

# Additional variables from keychain
EXTRA_VAR=some_value
```

### 🔄 Switching Environments

```bash
$ lpop --env production
```

```
🔐 Repository: github.com/acme/app
🌍 Environment: production

✅ 3 variables written to .env.local using .env.example template
```

### 🚀 Running Commands with Keychain Variables

```bash
$ lpop env -- npm start
```

```
Running "npm start" with 3 variables from lpop://acme/app

> my-app@1.0.0 start
> node server.js

🚀 Server running on port 3000 with API_KEY loaded from keychain
```

## 📚 Command Reference

### 🧠 Smart Command (Recommended)

lpop intelligently determines what you want to do:

| Command          | What it does                              |
| ---------------- | ----------------------------------------- |
| `lpop`           | Get all variables and write to .env.local |
| `lpop .env`      | Add/update variables from file            |
| `lpop KEY=value` | Add/update a single variable              |
| `lpop .env.dev`  | Export variables to specific file         |
| `lpop env -- <cmd>` | Run command with keychain variables    |

### 📝 Explicit Commands

<details>
<summary>Click to see all commands</summary>

#### ➕ Add Variables

```bash
lpop add .env                    # From file
lpop add "DB_URL=postgres://..." # Single variable
lpop add .env --env production   # To specific environment
```

#### 📖 Get Variables

```bash
lpop get                         # All variables to .env.local
lpop get API_KEY                 # Specific variable
lpop get --env staging           # From specific environment
```

#### 🔄 Update Variables

```bash
lpop update .env                 # From file
lpop update "API_KEY=newsecret"  # Single variable
```

#### 🗑️ Remove Variables

```bash
lpop remove API_KEY              # Single variable
lpop clear --confirm             # All variables (with confirmation)
```

#### 📋 List Stored Repos

```bash
lpop list                        # Show all stored repositories
```

#### 🚀 Run Commands

```bash
lpop env                         # Show variables that would be loaded
lpop env -- npm start            # Run with keychain variables
lpop env --env prod -- bun build # Use specific environment
```

</details>

## 🎯 Common Use Cases

### 🔧 Development Workflow

```bash
# 1. Clone a project
git clone https://github.com/acme/project.git
cd project

# 2. Get the development environment variables
lpop

# 3. Start developing!
npm run dev
```

### 🛡️ Security-First Development (No .env files)

```bash
# 1. Store your secrets once in keychain
lpop API_KEY=sk-secret123
lpop DATABASE_URL=postgres://localhost:5432/mydb

# 2. Delete .env files completely
rm .env .env.local .env.development

# 3. Run any command with variables from keychain
lpop env -- npm start
lpop env -- bun dev
lpop env -- python app.py

# Variables are loaded securely without ever touching disk!
```

### 🚢 Managing Multiple Environments

```bash
# Store different configs for each environment
lpop .env.development --env development
lpop .env.staging --env staging
lpop .env.production --env production

# Switch between them easily
lpop --env development  # When developing
lpop --env staging      # When testing
lpop --env production   # When debugging prod
```

## 🔒 Security Features

- ✅ **Encrypted Storage**: Variables are stored in your system's secure keychain
- ✅ **No Plain Text**: Never stored in files or logs
- ✅ **Git-Aware**: Automatically scoped to prevent cross-project leaks
- ✅ **Access Control**: Protected by your system's authentication

## 🤔 FAQs

<details>
<summary><strong>Where are my variables stored?</strong></summary>

Variables are stored in your operating system's secure credential storage:

- 🍎 **macOS**: Keychain Access
- 🪟 **Windows**: Credential Manager
- 🐧 **Linux**: Secret Service API (gnome-keyring, KWallet, etc.)
</details>

<details>
<summary><strong>What happens if I'm not in a git repository?</strong></summary>

lpop will use the current directory name as the project identifier. Your variables will be stored as `local/dirname?env=development`.

</details>

<details>
<summary><strong>Can I share variables with my team?</strong></summary>

A share feature is coming real soon. For now, to share with your team:

1. Export variables: `lpop .env.share`
2. Share the file securely (encrypted email, password manager, etc.)
3. Team members import: `lpop .env.share`
</details>

<details>
<summary><strong>How do I migrate from .env files?</strong></summary>

Simply run `lpop .env` in each project directory. Your existing .env files will be imported into the secure keychain.

</details>

<details>
<summary><strong>How does the .env.example template work?</strong></summary>

When you run `lpop` and a `.env.example` file exists:

1. **Template Structure**: Maintains organization and comments from `.env.example`
2. **Variable Matching**: Keychain variables matching template keys get values inserted
3. **Additional Variables**: Extra keychain variables are added at the end in alphabetical order
4. **Fallback**: If `.env.example` doesn't exist, uses standard format

</details>

<details>
<summary><strong>What's the difference between `lpop` and `lpop env`?</strong></summary>

- **`lpop`**: Exports variables to a `.env.local` file on disk (traditional approach)
- **`lpop env -- <command>`**: Runs commands with variables loaded directly from keychain (no files created)

Use `lpop env` when you want maximum security - no secrets ever touch disk. Perfect for security-conscious teams or when working with sensitive production data.

</details>

## 🛠️ Troubleshooting

### 🍎 macOS Keychain Prompts

When switching between `bun dev` and the installed binary, macOS may prompt for keychain access. This is normal - the system sees them as different applications.

### 🔑 Permission Denied

If you get permission errors, make sure you have access to your system's keychain/credential manager.

## 🤝 Contributing

We love contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

**tl;dr**: Fork the repo, make your changes, and submit a pull request! 🎉

## 📄 License

MIT © Tom Beckenham

---

<p align="center">Made with 🍭 by the Loggipop team</p>
