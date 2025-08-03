# 🍭 lpop

> **Securely manage environment variables in your system keychain** 🔐

lpop stores your environment variables in the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service), making them secure and easy to manage across projects.

## 🚀 Installation

```bash
# Install globally with npm
npm install -g lpop

# Or using pnpm
pnpm add -g lpop

# Or using yarn
yarn global add lpop
```

## 📖 How It Works

lpop automatically detects your git repository and organizes variables by project and environment. For example:

```
🔐 System Keychain
├── 📁 lpop://user/project
│   ├── 🔑 API_KEY - repo level api key
│   └── 🔑 SECRET_TOKEN - repo level token
├── 📁 lpop://user/project
│   ├── 🔑 DATABASE_URL?env=development - development database
└── 📁 lpop://user/project
    ├── 🔑 DATABASE_URL?env=production - production database

```

## 🎯 Quick Start

### 1️⃣ Store your environment variables

```bash
# From a .env file.
# if it exists, variables will be synced to the system keychain
lpop .env.local

# Or add a single variable
lpop API_KEY=secret123
```

### 2️⃣ Retrieve your variables

```bash
# Get all variables for current repo
lpop

# Sync from the system keychain to a file if it does not exist
# Run the same command to read or write.
# This makes it super easy to clone or use git worktrees to work in parallel using AI
lpop .env.local
```

### 3️⃣ Use different environments

```bash
bun dev
```

Or build and run:
# Store production variables
lpop .env.production --env production

# Retrieve staging variables
lpop --env staging
```

## 🎨 Visual Examples

### 📥 Adding Variables

```bash
bun build
./lpop
```

### MacOS Keychain Note:

Running the CLI via bun registers the keys in macOS Keychain with 'bun' rather than 'lpop' binary so if you swap between the methods you will be prompted for password entry on the second method you use e.g. if you first use `bun dev` then running `./lpop` on the same repo will prompt for password every time.

## Installation
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

### 📤 Getting Variables

```bash
$ lpop
```

```
🔐 Repository: github.com/acme/app
🌍 Environment: development

DATABASE_URL=postgresql://localhost:5432/myapp
API_KEY=sk_live_abc123xyz
JWT_SECRET=super-secret-key-here
```

### 🔄 Switching Environments

```bash
$ lpop --env production
```

```
🔐 Repository: github.com/acme/app
🌍 Environment: production

DATABASE_URL=postgresql://prod.db.com:5432/app
API_KEY=sk_prod_xyz789abc
JWT_SECRET=production-secret-key
```

## 📚 Command Reference

### 🧠 Smart Command (Recommended)

lpop intelligently determines what you want to do:

| Command           | What it does                       |
| ----------------- | ---------------------------------- |
| `lpop`            | Get all variables for current repo |
| `lpop .env`       | Add/update variables from file     |
| `lpop KEY=value`  | Add/update a single variable       |
| `lpop output.env` | Export variables to file           |

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
lpop get                         # All variables
lpop get API_KEY                 # Specific variable
lpop get -o backup.env           # Export to file
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

</details>

## 🎯 Common Use Cases

### 🔧 Development Workflow

```bash
# 1. Clone a project
git clone https://github.com/acme/project.git
cd project

# 2. Get the development environment variables
lpop .env.local

# 3. Start developing!
npm run dev
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

lpop stores variables locally in your keychain. To share with your team:

1. Export variables: `lpop .env.share`
2. Share the file securely (encrypted email, password manager, etc.)
3. Team members import: `lpop .env.share`
</details>

<details>
<summary><strong>How do I migrate from .env files?</strong></summary>

Simply run `lpop .env` in each project directory. Your existing .env files will be imported into the secure keychain.

</details>

## 🛠️ Troubleshooting

### 🍎 macOS Keychain Prompts

When switching between `pnpm dev` and the installed binary, macOS may prompt for keychain access. This is normal - the system sees them as different applications.

### 🔑 Permission Denied

If you get permission errors, make sure you have access to your system's keychain/credential manager.

## 🤝 Contributing

We love contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

**tl;dr**: Fork the repo, make your changes, and submit a pull request! 🎉

## 📄 License

MIT © Tom Beckenham

---

<p align="center">Made with 🍭 by the Loggipop team</p>
