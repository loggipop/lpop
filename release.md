# 🍭 lpop v0.1.0 - First Release!

> **Securely manage your environment variables with style** 🔐✨

We're excited to introduce **lpop** - a CLI tool that stores your environment variables in your system's keychain, making them secure, organized, and easy to manage across all your projects. Once stored, you can remove the local repo, and reclone knowing that you can restore all your secrets simply and easily. This makes it easy to create multiple clones of repostitories or use git worktrees when vibe coding, or working on multiple branches at once.

## 🎯 What is lpop?

lpop automatically detects your git repository and stores environment variables in your system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).

## ✨ Key Features

🧠 **Smart Command Interface** - One command does it all! `lpop` intelligently figures out what you want to do  
🔐 **Secure Storage** - Variables stored in your OS keychain, never in plain text  
🌍 **Multi-Environment** - Easy switching between development, staging, and production  
📁 **Git-Aware** - Automatically organizes variables by repository  
🔄 **Seamless Migration** - Import your existing `.env` files with one command

## 🚀 Quick Start

```bash
# Install globally
npm install -g lpop

# Store variables from a .env file
lpop .env.local

# Get all variables for current repo - yep it's the same
lpop .env.local

# Add a single variable
lpop API_KEY=secret123
```

## 🎨 What Makes This Special?

- **Cross-project isolation** - Variables are scoped to each repository
- **Zero configuration** - Just run it and it works

## 🧪 Early Release - Try It Out!

This is our first release, so we'd love your feedback! lpop is perfect for:

- Engineers who use AI alot - working on multiple copies of the same repo
- Anyone who values security, simplicity, and peace of mind

## 🐛 Found a Bug or Have Ideas?

We're actively improving lpop! Please [open an issue](https://github.com/loggipop/lpop/issues) or contribute to make it even better.

---

**Ready to secure your environment variables?** Give lpop a try and let us know what you think! 🎉
