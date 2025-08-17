#!/usr/bin/env node

import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);

function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch;

  let platformName;
  let archName;

  switch (platform) {
    case 'darwin':
      platformName = 'darwin';
      break;
    case 'linux':
      platformName = 'linux';
      break;
    case 'win32':
      platformName = 'windows';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  switch (arch) {
    case 'x64':
      archName = 'x64';
      break;
    case 'arm64':
      archName = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  return { platform: platformName, arch: archName };
}

async function setupBinary() {
  console.log('🚀 Starting lpop postinstall script...');
  console.log(`📍 Package root: ${packageRoot}`);

  // Skip postinstall during development (when src directory exists)
  // This is more reliable than checking devDependencies which are included in npm pack
  const srcDir = join(packageRoot, 'src');
  if (existsSync(srcDir)) {
    console.log(
      '🔧 Development mode detected (src directory exists), skipping binary setup',
    );
    return;
  }

  const { platform, arch } = getPlatformInfo();
  const target = `${platform}-${arch}`;
  const packageName = `lpop-${target}`;
  const binaryName =
    platform === 'windows' ? `lpop-${target}.exe` : `lpop-${target}`;

  let binaryPath = null;

  // First try to find the binary from optional dependency
  const optionalDepPath = join(
    packageRoot,
    'node_modules',
    packageName,
    binaryName,
  );
  if (existsSync(optionalDepPath)) {
    console.log('✅ Platform-specific binary found via optional dependency');
    binaryPath = optionalDepPath;
  } else {
    // Fallback: download from GitHub release
    console.log(
      '⚠️  Optional dependency failed, downloading from GitHub release...',
    );

    try {
      const packageJson = await import(join(packageRoot, 'package.json'), {
        with: { type: 'json' },
      });
      const version = packageJson.default.version;

      // Download from GitHub release with matching version
      const downloadUrl = `https://github.com/loggipop/lpop/releases/download/v${version}/${binaryName}`;
      const distDir = join(packageRoot, 'dist');
      const downloadedBinaryPath = join(distDir, binaryName);

      console.log(
        `📥 Downloading lpop binary for ${platform}-${arch} (v${version})...`,
      );

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Binary not found in release v${version}. The release may still be building.`,
          );
        }
        throw new Error(
          `Failed to download binary: ${response.status} ${response.statusText}`,
        );
      }

      // Ensure the directory exists
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // Download and save the binary
      const fileStream = createWriteStream(downloadedBinaryPath);
      await pipeline(response.body, fileStream);

      // Make the binary executable (Unix-like systems)
      if (platform !== 'windows') {
        chmodSync(downloadedBinaryPath, 0o755);
      }

      console.log(`✅ lpop binary downloaded successfully`);
      binaryPath = downloadedBinaryPath;
    } catch (error) {
      console.error('❌ Failed to download lpop binary:', error.message);
      console.error('This is likely because:');
      console.error('  1. The GitHub release is still being created');
      console.error('  2. Your platform is not yet supported');
      console.error(
        'Please try reinstalling in a few minutes or check: https://github.com/loggipop/lpop/releases',
      );
      process.exit(1);
    }
  }

  // Replace the wrapper script with the actual binary
  if (binaryPath) {
    const binLpopPath = join(packageRoot, 'bin', 'lpop');
    console.log(`📋 Attempting to replace wrapper at: ${binLpopPath}`);
    console.log(`📦 Using binary from: ${binaryPath}`);

    try {
      // Check if bin directory exists
      if (!existsSync(dirname(binLpopPath))) {
        console.log('📁 Creating bin directory...');
        mkdirSync(dirname(binLpopPath), { recursive: true });
      }

      // Move the binary to replace the wrapper
      console.log(`📏 Moving binary from ${binaryPath} to ${binLpopPath}`);

      try {
        // First try to rename (move) which is more efficient
        renameSync(binaryPath, binLpopPath);
        console.log('✍️  Binary moved successfully');
      } catch (error) {
        // If rename fails (e.g., cross-device), fall back to copy
        console.log('⚠️  Rename failed, falling back to copy:', error.message);
        const { readFileSync, writeFileSync } = await import('node:fs');
        const sourceBuffer = readFileSync(binaryPath);
        writeFileSync(binLpopPath, sourceBuffer);
        console.log('✍️  Binary copied successfully');

        // Try to remove the original
        try {
          const { unlinkSync } = await import('node:fs');
          unlinkSync(binaryPath);
          console.log('🗑️  Original binary removed');
        } catch (e) {
          console.log('⚠️  Could not remove original binary:', e.message);
        }
      }

      // Make it executable
      if (platform !== 'windows') {
        chmodSync(binLpopPath, 0o755);
        console.log('🔐 Made binary executable');
      }

      console.log('🔄 Replaced wrapper script with native binary');
    } catch (error) {
      console.error('❌ Failed to replace wrapper script:', error.message);
      console.error('Stack trace:', error.stack);
      console.error('The wrapper script will remain, but may be slower');
    }
  } else {
    console.log('⚠️  No binary path available, wrapper script unchanged');
  }
}

// Only run if this script is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupBinary();
}
