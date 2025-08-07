#!/usr/bin/env bun

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const PACKAGE_DIR = import.meta.dir;

async function runTests() {
  console.log(chalk.blue('🧪 Running Keychain Native Module Tests\n'));

  // Check if native module is built
  const nativeModule = join(PACKAGE_DIR, 'keychain-native.darwin-arm64.node');
  if (!existsSync(nativeModule)) {
    console.error(chalk.red('❌ Native module not found. Please build first with:'));
    console.error(chalk.yellow('   bun run build'));
    process.exit(1);
  }

  // Run Rust tests
  console.log(chalk.cyan('Running Rust tests...'));
  await runCommand('cargo', ['test', '--lib', '--', '--nocapture']);
  
  console.log(chalk.cyan('\nRunning Rust integration tests...'));
  await runCommand('cargo', ['test', '--test', '*', '--', '--nocapture']);

  // Run TypeScript tests
  console.log(chalk.cyan('\nRunning TypeScript tests...'));
  await runCommand('bun', ['test', '__tests__']);

  console.log(chalk.green('\n✅ All tests completed!'));
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: PACKAGE_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        RUST_BACKTRACE: '1',
        // Force test environment
        NODE_ENV: 'test',
      },
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Run tests
runTests().catch((err) => {
  console.error(chalk.red('\n❌ Test run failed:'), err);
  process.exit(1);
});