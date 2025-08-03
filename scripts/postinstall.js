#!/usr/bin/env node

import { createWriteStream, chmodSync, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);

function getPlatform() {
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

async function downloadBinary() {
  try {
    const { platform, arch } = getPlatform();
    const binaryName = getBinaryName(platform, arch);
    const packageJson = await import(join(packageRoot, 'package.json'), { assert: { type: 'json' } });
    const version = packageJson.default.version;
    
    const downloadUrl = `https://github.com/loggipop/lpop/releases/download/v${version}/${binaryName}`;
    const binaryPath = join(packageRoot, 'lpop' + (platform === 'windows' ? '.exe' : ''));
    
    console.log(`Downloading lpop binary for ${platform}-${arch}...`);
    console.log(`URL: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download binary: ${response.status} ${response.statusText}`);
    }
    
    // Ensure the directory exists
    const binaryDir = dirname(binaryPath);
    if (!existsSync(binaryDir)) {
      mkdirSync(binaryDir, { recursive: true });
    }
    
    // Download and save the binary
    const fileStream = createWriteStream(binaryPath);
    await pipeline(response.body, fileStream);
    
    // Make the binary executable (Unix-like systems)
    if (platform !== 'windows') {
      chmodSync(binaryPath, 0o755);
    }
    
    console.log(`✅ lpop binary installed successfully at ${binaryPath}`);
  } catch (error) {
    console.error('❌ Failed to download lpop binary:', error.message);
    console.error('Please try installing again or download manually from https://github.com/loggipop/lpop/releases');
    process.exit(1);
  }
}

// Only run if this script is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadBinary();
}