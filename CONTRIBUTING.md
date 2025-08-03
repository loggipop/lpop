# 🤝 Contributing to lpop

First off, thanks for taking the time to contribute! 🎉

## 🚀 Getting Started

### 1. Fork the Repository

1. Visit [https://github.com/loggipop/lpop](https://github.com/loggipop/lpop)
2. Click the "Fork" button in the top right
3. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/lpop.git
   cd lpop
   ```

### 2. Set Up Development Environment

```bash
# Install dependencies
bun install

# Run in development mode
bun dev

# Or build and test the binary
bun build
./lpop --help
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

## 📋 Development Workflow

### 🏗️ Project Structure

```
lpop/
├── src/
│   ├── index.ts          # Entry point
│   ├── cli.ts            # CLI command handling
│   ├── keychain-manager.ts   # Keychain operations
│   ├── git-path-resolver.ts  # Git repository detection
│   └── env-file-parser.ts    # .env file parsing
├── scripts/
│   └── build-binary.sh   # Binary build script
└── package.json
```

### 🛠️ Available Commands

```bash
bun dev              # Run in development mode
bun build:binaries   # Build binary executable
bun build:js         # Build TypeScript only
bun watch            # Watch for changes
```

### 📝 Code Style

- We use TypeScript with ESNext features
- Follow existing code patterns
- Keep functions small and focused
- Add comments for complex logic

### ✅ Testing Your Changes

Before submitting:

1. **Test the CLI commands**:

   ```bash
   # Test basic operations
   bun dev add TEST_VAR=value
   bun dev get TEST_VAR
   bun dev remove TEST_VAR
   ```

2. **Build and test the binary**:

   ```bash
   bun build
   ./lpop --help
   ```

3. **Test on different environments** (if possible):
   - Different git repositories
   - Non-git directories
   - Multiple environment names

## 🎯 What to Contribute

### 💡 Ideas for Contributions

- **Features**: New commands or options
- **Bug fixes**: Found something broken? Fix it!
- **Documentation**: Improve README, add examples
- **Performance**: Make lpop faster
- **Cross-platform**: Improve Windows/Linux support
- **Security**: Enhance secure storage methods

### 🐛 Reporting Issues

1. Check if the issue already exists
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version)

## 📤 Submitting Changes

### 1. Commit Your Changes

```bash
git add .
git commit -m "feat: add amazing new feature"
# or
git commit -m "fix: resolve issue with env parsing"
```

**Commit Message Format**:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build process or auxiliary tool changes

### 2. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 3. Create a Pull Request

1. Go to your fork on GitHub
2. Click "Pull Request"
3. Provide a clear description:
   - What does this PR do?
   - Why is it needed?
   - How did you test it?

### 4. PR Guidelines

- **Keep PRs focused**: One feature/fix per PR
- **Update documentation**: If you change functionality
- **Be responsive**: Reply to feedback promptly
- **Be patient**: Maintainers review PRs as time permits

## 🏆 Recognition

Contributors will be:

- Listed in our Contributors section
- Thanked in release notes
- Given credit in commit messages

## 💬 Questions?

- Open an issue for questions
- Tag it with the `question` label
- Be clear and specific

## 🎨 Development Tips

### Using Bun vs Node

- Development uses Bun for speed
- Binary builds use Bun's compilation
- Make sure changes work with both `bun dev` and the built binary

### Keychain Notes

- macOS: Test with Keychain Access app
- Windows: Check Credential Manager
- Linux: Varies by distribution

### Git Detection

- Test in various git configurations
- Handle edge cases (no remotes, multiple remotes)
- Fallback gracefully for non-git directories

## 📜 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help make lpop better for everyone

---

Thank you for contributing to lpop! 🍭
