/**
 * Example configuration for using the native keychain module with lpop
 * 
 * To use enhanced macOS security features:
 * 
 * 1. Set your Apple Developer Team ID:
 *    export LPOP_TEAM_ID="YOUR_TEAM_ID"
 * 
 * 2. Optionally set a custom access group:
 *    export LPOP_ACCESS_GROUP="com.yourcompany.shared"
 * 
 * 3. Code sign your application with proper entitlements
 */

const { Keychain } = require('./index.js');

// Example 1: Basic usage (no special configuration)
async function basicExample() {
  const keychain = new Keychain();
  
  await keychain.setPassword('com.example.app', 'API_KEY', 'secret123');
  const password = await keychain.getPassword('com.example.app', 'API_KEY');
  console.log('Basic example - Retrieved:', password);
}

// Example 2: With Team ID for code signing
async function teamIdExample() {
  const keychain = new Keychain({
    teamId: 'ABC123XYZ', // Your Apple Developer Team ID
  });
  
  await keychain.setPassword('com.example.app', 'API_KEY', 'secret456');
  const password = await keychain.getPassword('com.example.app', 'API_KEY');
  console.log('Team ID example - Retrieved:', password);
}

// Example 3: With access group for sharing between apps
async function accessGroupExample() {
  const keychain = new Keychain({
    teamId: 'ABC123XYZ',
    accessGroup: 'com.example.shared',
  });
  
  // This password can be accessed by other apps in the same access group
  await keychain.setPassword('shared.service', 'SHARED_KEY', 'shared789');
  const password = await keychain.getPassword('shared.service', 'SHARED_KEY');
  console.log('Access group example - Retrieved:', password);
}

// Example 4: With iCloud Keychain sync
async function iCloudSyncExample() {
  const keychain = new Keychain({
    teamId: 'ABC123XYZ',
    synchronizable: true, // Sync with iCloud Keychain
  });
  
  // This password will sync across user's devices
  await keychain.setPassword('com.example.sync', 'SYNC_KEY', 'synced123');
  const password = await keychain.getPassword('com.example.sync', 'SYNC_KEY');
  console.log('iCloud sync example - Retrieved:', password);
}

// Run examples
async function runExamples() {
  console.log('Running keychain examples...\n');
  
  try {
    await basicExample();
    console.log();
    
    // Uncomment these after setting your Team ID
    // await teamIdExample();
    // console.log();
    
    // await accessGroupExample();
    // console.log();
    
    // await iCloudSyncExample();
    // console.log();
    
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  basicExample,
  teamIdExample,
  accessGroupExample,
  iCloudSyncExample
};