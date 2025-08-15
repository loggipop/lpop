#!/usr/bin/env bun

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Windows Code Signing Wrapper
 * 
 * This script provides a Node.js interface for signing Windows executables.
 * It wraps the PowerShell signing script and provides additional functionality.
 */

// Configuration
const DEFAULT_BINARY_PATH = 'dist/lpop-windows-x64.exe';
const DEFAULT_TIMESTAMP_SERVER = 'http://timestamp.digicert.com';

/**
 * Signs a Windows executable file
 * @param {Object} options - Signing options
 * @param {string} options.certificatePath - Path to the .pfx certificate file
 * @param {string} options.certificatePassword - Password for the certificate
 * @param {string} [options.binaryPath] - Path to the .exe file to sign
 * @param {string} [options.timestampServer] - Timestamp server URL
 * @returns {Promise<boolean>} - True if signing was successful
 */
export async function signWindowsExecutable(options) {
  const {
    certificatePath,
    certificatePassword,
    binaryPath = DEFAULT_BINARY_PATH,
    timestampServer = DEFAULT_TIMESTAMP_SERVER
  } = options;

  // Validate required parameters
  if (!certificatePath || !certificatePassword) {
    console.error('❌ Certificate path and password are required');
    return false;
  }

     // Check if binary exists
   if (!fs.existsSync(binaryPath)) {
     console.error(`❌ Binary not found: ${binaryPath}`);
     console.error('Please run the build script first: bun run build:binaries');
     return false;
   }

  // Check if certificate exists
  if (!fs.existsSync(certificatePath)) {
    console.error(`❌ Certificate file not found: ${certificatePath}`);
    return false;
  }

  const scriptPath = path.join(__dirname, 'sign-windows.ps1');
  
  const args = [
    '-File', scriptPath,
    '-CertificatePath', certificatePath,
    '-CertificatePassword', certificatePassword,
    '-BinaryPath', binaryPath,
    '-TimestampServer', timestampServer
  ];

  console.log('🔐 Starting Windows code signing process...');
  console.log(`📁 Binary: ${binaryPath}`);
  console.log(`🔑 Certificate: ${certificatePath}`);

  return new Promise((resolve) => {
    const child = spawn('powershell', args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Windows code signing completed successfully!');
        resolve(true);
      } else {
        console.error(`❌ Windows code signing failed with exit code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error('❌ Failed to start signing process:', error.message);
      resolve(false);
    });
  });
}

/**
 * Verifies the signature of a Windows executable file
 * @param {string} [binaryPath] - Path to the .exe file to verify
 * @returns {Promise<boolean>} - True if signature is valid
 */
export async function verifyWindowsSignature(binaryPath = DEFAULT_BINARY_PATH) {
  const scriptPath = path.join(__dirname, 'sign-windows.ps1');
  
  const args = [
    '-File', scriptPath,
    '-BinaryPath', binaryPath,
    '-VerifyOnly'
  ];

  console.log('🔍 Verifying Windows executable signature...');
  console.log(`📁 Binary: ${binaryPath}`);

  return new Promise((resolve) => {
    const child = spawn('powershell', args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Signature verification completed successfully!');
        resolve(true);
      } else {
        console.error(`❌ Signature verification failed with exit code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error('❌ Failed to start verification process:', error.message);
      resolve(false);
    });
  });
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'sign':
      const certPath = args[1];
      const certPassword = args[2];
      const binaryPath = args[3] || DEFAULT_BINARY_PATH;
      
      if (!certPath || !certPassword) {
        console.error('Usage: bun run sign-windows.js sign <certificate-path> <certificate-password> [binary-path]');
        process.exit(1);
      }
      
      signWindowsExecutable({
        certificatePath: certPath,
        certificatePassword: certPassword,
        binaryPath: binaryPath
      }).then(success => {
        process.exit(success ? 0 : 1);
      });
      break;

    case 'verify':
      const verifyPath = args[1] || DEFAULT_BINARY_PATH;
      verifyWindowsSignature(verifyPath).then(success => {
        process.exit(success ? 0 : 1);
      });
      break;

    case 'help':
      console.log('Windows Code Signing Tool');
      console.log('');
      console.log('Usage:');
      console.log('  bun run sign-windows.js sign <cert-path> <cert-password> [binary-path]');
      console.log('  bun run sign-windows.js verify [binary-path]');
      console.log('  bun run sign-windows.js help');
      console.log('');
      console.log('Examples:');
      console.log('  bun run sign-windows.js sign cert.pfx mypassword');
      console.log('  bun run sign-windows.js sign cert.pfx mypassword dist/myapp.exe');
      console.log('  bun run sign-windows.js verify');
      console.log('  bun run sign-windows.js verify dist/myapp.exe');
      break;

    default:
      console.error('Unknown command. Use "help" for usage information.');
      process.exit(1);
  }
}
