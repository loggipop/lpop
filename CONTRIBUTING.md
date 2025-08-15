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
bun run build:binaries
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
bun dev                  # Run in development mode
bun run build:binaries   # Build binary executables for all platforms
bun run prepare-packages # Copy binaries to platform packages and sync versions
bun run clean           # Clean build artifacts
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
   bun run build:binaries
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

## 🚀 CI/CD Pipeline

### Release Process

lpop uses a Sentry-style binary distribution strategy with automated CI/CD that builds and signs binaries for all platforms when a GitHub release is created.

#### **Workflow Overview:**

1. **Manual Release Creation**: Create a GitHub release (e.g., `v0.1.1`)
2. **CI Trigger**: Workflow triggers on release creation
3. **Certificate Check**: Verifies if signing certificates are available for each platform
4. **Platform Builds**: Separate jobs for macOS, Windows, and Linux with conditional execution
5. **Code Signing**: 
   - **macOS**: Developer ID Application signing + Apple notarization
   - **Windows**: Authenticode signing with timestamping
   - **Linux**: GPG detached signatures
6. **Binary Upload**: Uploads signed binaries to the GitHub release
7. **Platform Package Publishing**: Publishes platform-specific npm packages (`lpop-linux-x64`, etc.)
8. **Main Package Publishing**: Publishes main package with correct optionalDependencies

#### **Distribution Strategy:**

- **Platform-specific packages**: Each platform gets its own npm package with just the signed binary
- **Optional dependencies**: Main package references platform packages as optional dependencies
- **Binary replacement**: Postinstall replaces Node.js wrapper with native binary for zero startup overhead
- **Fallback download**: Downloads from GitHub releases if optional dependencies fail

#### **Required Secrets for Full CI/CD:**

Key secrets include:

- **macOS**: `MACOS_CERTIFICATE`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_APP_PASSWORD`, `APPLE_TEAM_ID`
- **Windows**: `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`  
- **Linux**: `LINUX_CERTIFICATE` (GPG private key)
- **NPM**: `NPM_TOKEN`

#### **Platform Support Matrix:**

| Platform | With Certificates | Without Certificates |
|----------|------------------|--------------------|
| macOS | ✅ Signed + Notarized + npm package | ❌ Not distributed |
| Windows | ✅ Authenticode signed + npm package | ❌ Not distributed |
| Linux | ✅ GPG signed + npm package | ❌ Not distributed |

**Note**: Only signed binaries are distributed to ensure keychain access works reliably.

#### **Triggering Releases:**

1. **Update version** in `package.json` (e.g., `0.1.0` → `0.1.1`)
2. **Create GitHub release** manually with matching tag (e.g., `v0.1.1`)
3. **CI runs automatically**:
   - Builds and signs binaries for platforms with certificates
   - Uploads binaries to the release
   - Publishes platform-specific npm packages
   - Publishes main npm package

#### **Version Synchronization:**

All platform packages automatically sync to the main package version during CI, ensuring consistency across the distribution.

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
