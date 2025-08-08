#!/usr/bin/env bun

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build and optionally sign Windows binaries
 * 
 * This script builds binaries for all platforms and optionally signs
 * the Windows executable if a certificate is provided.
 */

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSign = args.includes('--sign');
const certificatePath = args.find(arg => arg.startsWith('--cert='))?.split('=')[1];
const certificatePassword = args.find(arg => arg.startsWith('--password='))?.split('=')[1];

const isWindows = process.platform === 'win32';
const scriptPath = isWindows 
  ? path.join(__dirname, 'build-binary.ps1')
  : path.join(__dirname, 'build-binary.sh');

const command = isWindows ? 'powershell' : 'bash';
const buildArgs = isWindows ? ['-File', scriptPath] : [scriptPath];

console.log(`🔧 Running build script for ${isWindows ? 'Windows' : 'Unix'}...`);

if (shouldSign && isWindows) {
  console.log('🔐 Code signing will be performed after build');
  if (certificatePath) {
    console.log(`📁 Certificate: ${certificatePath}`);
  } else {
    console.log('⚠️  Certificate path not provided, signing will be skipped');
  }
}

const child = spawn(command, buildArgs, {
  stdio: 'inherit',
  shell: true
});

child.on('close', async (code) => {
  if (code === 0) {
    console.log('✅ Build completed successfully!');
    
    // Perform code signing if requested and on Windows
    if (shouldSign && isWindows) {
      await performCodeSigning();
    }
  } else {
    console.error(`❌ Build failed with exit code ${code}`);
    process.exit(code);
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start build process:', error.message);
  process.exit(1);
});

/**
 * Performs code signing for Windows executable
 */
async function performCodeSigning() {
  const { signWindowsExecutable } = await import('./sign-windows.js');
  
     if (!certificatePath || !certificatePassword) {
     console.log('⚠️  Skipping code signing - certificate path or password not provided');
     console.log('💡 To sign the Windows executable, use:');
     console.log('   bun run build:binaries -- --sign --cert=path/to/cert.pfx --password=yourpassword');
     return;
   }
  
  console.log('🔐 Starting code signing process...');
  
  const success = await signWindowsExecutable({
    certificatePath,
    certificatePassword,
    binaryPath: 'dist/lpop-windows-x64.exe'
  });
  
  if (success) {
    console.log('✅ Code signing completed successfully!');
  } else {
    console.error('❌ Code signing failed');
    process.exit(1);
  }
}
