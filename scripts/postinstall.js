#!/usr/bin/env node

import { createWriteStream, chmodSync, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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

function getBinaryName(platform, arch) {
  const target = `${platform}-${arch}`;
  return platform === 'windows' ? `lpop-${target}.exe` : `lpop-${target}`;
}

function checkOptionalDependency() {
  const { platform, arch } = getPlatformInfo();
  const packageName = `lpop-${platform}-${arch}`;
  const optionalDepPath = join(packageRoot, 'node_modules', packageName);
  
  return existsSync(optionalDepPath);
}

async function setupBinary() {
  // Skip postinstall during development (when devDependencies exist)
  try {
    const packageJson = await import(join(packageRoot, 'package.json'), { with: { type: 'json' } });
    if (packageJson.default.devDependencies) {
      console.log('🔧 Development mode detected, skipping binary setup');
      return;
    }
  } catch (error) {
    // If we can't read package.json, continue with setup attempt
  }

  const { platform, arch } = getPlatformInfo();
  const target = `${platform}-${arch}`;
  const packageName = `lpop-${target}`;
  const binaryName = platform === 'windows' ? `lpop-${target}.exe` : `lpop-${target}`;
  
  let binaryPath = null;
  
  // First try to find the binary from optional dependency
  const optionalDepPath = join(packageRoot, 'node_modules', packageName, binaryName);
  if (existsSync(optionalDepPath)) {
    console.log('✅ Platform-specific binary found via optional dependency');
    binaryPath = optionalDepPath;
  } else {
    // Fallback: download from GitHub release
    console.log('⚠️  Optional dependency failed, downloading from GitHub release...');
    
    try {
      const packageJson = await import(join(packageRoot, 'package.json'), { with: { type: 'json' } });
      const version = packageJson.default.version;
      
      // Download from GitHub release with matching version
      const downloadUrl = `https://github.com/loggipop/lpop/releases/download/v${version}/${binaryName}`;
      const distDir = join(packageRoot, 'dist');
      const downloadedBinaryPath = join(distDir, binaryName);
      
      console.log(`📥 Downloading lpop binary for ${platform}-${arch} (v${version})...`);
      
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Binary not found in release v${version}. The release may still be building.`);
        }
        throw new Error(`Failed to download binary: ${response.status} ${response.statusText}`);
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
      console.error('Please try reinstalling in a few minutes or check: https://github.com/loggipop/lpop/releases');
      process.exit(1);
    }
  }
  
  // Replace the wrapper script with the actual binary
  if (binaryPath) {
    const binLpopPath = join(packageRoot, 'bin', 'lpop');
    try {
      // Copy the binary to replace the wrapper
      const sourceBuffer = require('fs').readFileSync(binaryPath);
      require('fs').writeFileSync(binLpopPath, sourceBuffer);
      
      // Make it executable
      if (platform !== 'windows') {
        chmodSync(binLpopPath, 0o755);
      }
      
      console.log('🔄 Replaced wrapper script with native binary');
    } catch (error) {
      console.error('❌ Failed to replace wrapper script:', error.message);
      console.error('The wrapper script will remain, but may be slower');
    }
  }
}

// Only run if this script is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupBinary();
}