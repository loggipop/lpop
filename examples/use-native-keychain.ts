#!/usr/bin/env node

/**
 * Example of how to use the native keychain module with lpop
 * 
 * This demonstrates:
 * 1. Using the native module instead of @napi-rs/keyring
 * 2. Configuring macOS-specific security features
 * 3. Maintaining compatibility with existing lpop functionality
 */

import { GitPathResolver } from '../src/git-path-resolver.js';
import { NativeKeychainManager } from '../src/keychain-manager-native.js';
import { EnvFileParser } from '../src/env-file-parser.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue('Using native keychain module with enhanced security features\n'));

  // Get the service name from git context
  const gitResolver = new GitPathResolver();
  const serviceName = await gitResolver.getServiceName();
  const environment = 'development';

  console.log(chalk.gray(`Service: ${serviceName}`));
  console.log(chalk.gray(`Environment: ${environment}\n`));

  // Create keychain manager with native module and macOS options
  const keychainManager = new NativeKeychainManager(
    serviceName,
    environment,
    {
      // These can be set via environment variables
      teamId: process.env.LPOP_TEAM_ID,
      accessGroup: process.env.LPOP_ACCESS_GROUP,
      synchronizable: process.env.LPOP_SYNC === 'true'
    }
  );

  // Example 1: Set some environment variables
  console.log(chalk.yellow('Setting environment variables...'));
  const variables = [
    { key: 'API_KEY', value: 'secret-api-key-123' },
    { key: 'DATABASE_URL', value: 'postgres://localhost/mydb' },
    { key: 'REDIS_URL', value: 'redis://localhost:6379' }
  ];

  await keychainManager.setEnvironmentVariables(variables);
  console.log(chalk.green('✓ Variables set successfully\n'));

  // Example 2: Retrieve variables
  console.log(chalk.yellow('Retrieving environment variables...'));
  const retrieved = await keychainManager.getEnvironmentVariables();
  
  for (const { key, value } of retrieved) {
    console.log(chalk.cyan(`  ${key}=`) + chalk.gray(value));
  }
  console.log();

  // Example 3: Parse and store from .env file
  const envContent = `
# API Configuration
API_KEY=new-api-key-456
API_URL=https://api.example.com

# Database
DATABASE_URL=postgres://user:pass@localhost/db
`;

  console.log(chalk.yellow('Parsing and storing from .env content...'));
  const parser = new EnvFileParser();
  const parsed = parser.parse(envContent);
  
  await keychainManager.setEnvironmentVariables(parsed.variables);
  console.log(chalk.green('✓ Stored', parsed.variables.length, 'variables from .env\n'));

  // Example 4: Update a single variable
  console.log(chalk.yellow('Updating a single variable...'));
  await keychainManager.updateEnvironmentVariable('API_KEY', 'updated-key-789');
  
  const updatedKey = await keychainManager.getPassword('API_KEY');
  console.log(chalk.green('✓ Updated API_KEY to:'), chalk.gray(updatedKey));
  console.log();

  // Example 5: Remove a variable
  console.log(chalk.yellow('Removing REDIS_URL...'));
  const removed = await keychainManager.removeEnvironmentVariable('REDIS_URL');
  console.log(chalk.green('✓ Removed:', removed));
  console.log();

  // Show final state
  console.log(chalk.yellow('Final environment variables:'));
  const final = await keychainManager.getEnvironmentVariables();
  
  for (const { key, value } of final) {
    console.log(chalk.cyan(`  ${key}=`) + chalk.gray(value));
  }

  console.log(chalk.blue('\n✨ Example completed successfully!'));
  
  // Show security info if on macOS
  if (process.platform === 'darwin') {
    console.log(chalk.gray('\nmacOS Security Info:'));
    console.log(chalk.gray(`  Team ID: ${process.env.LPOP_TEAM_ID || 'Not set'}`));
    console.log(chalk.gray(`  Access Group: ${process.env.LPOP_ACCESS_GROUP || 'Default'}`));
    console.log(chalk.gray(`  iCloud Sync: ${process.env.LPOP_SYNC === 'true' ? 'Enabled' : 'Disabled'}`));
  }
}

// Run the example
main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});