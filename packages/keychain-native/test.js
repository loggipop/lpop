#!/usr/bin/env node

const { Keychain } = require('./index.js');

async function test() {
  console.log('Testing native keychain module...\n');

  // Create keychain instance with macOS-specific options
  const keychain = new Keychain({
    teamId: 'YOUR_TEAM_ID', // Replace with your actual team ID
    accessGroup: 'com.lpop.shared',
    synchronizable: false
  });

  const service = 'com.lpop.test';
  const account = 'test_user';
  const password = 'test_password_123';

  try {
    // Test 1: Set password
    console.log('1. Setting password...');
    await keychain.setPassword(service, account, password);
    console.log('✓ Password set successfully\n');

    // Test 2: Get password
    console.log('2. Getting password...');
    const retrieved = await keychain.getPassword(service, account);
    console.log(`✓ Retrieved password: ${retrieved}`);
    console.log(`✓ Passwords match: ${retrieved === password}\n`);

    // Test 3: Find credentials
    console.log('3. Finding credentials for service...');
    const credentials = await keychain.findCredentials(service);
    console.log(`✓ Found ${credentials.length} credential(s):`);
    credentials.forEach(cred => {
      console.log(`  - Account: ${cred.account}, Password: ${cred.password}`);
    });
    console.log();

    // Test 4: Add another credential
    console.log('4. Adding another credential...');
    await keychain.setPassword(service, 'another_user', 'another_password');
    console.log('✓ Second credential added\n');

    // Test 5: Find all credentials again
    console.log('5. Finding all credentials...');
    const allCreds = await keychain.findCredentials(service);
    console.log(`✓ Found ${allCreds.length} credential(s):`);
    allCreds.forEach(cred => {
      console.log(`  - Account: ${cred.account}, Password: ${cred.password}`);
    });
    console.log();

    // Test 6: Delete password
    console.log('6. Deleting first password...');
    const deleted = await keychain.deletePassword(service, account);
    console.log(`✓ Password deleted: ${deleted}\n`);

    // Test 7: Try to get deleted password
    console.log('7. Trying to get deleted password...');
    const deletedPassword = await keychain.getPassword(service, account);
    console.log(`✓ Retrieved password after deletion: ${deletedPassword}`);
    console.log(`✓ Password is null: ${deletedPassword === null}\n`);

    // Cleanup
    console.log('8. Cleaning up...');
    await keychain.deletePassword(service, 'another_user');
    console.log('✓ Cleanup complete\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test().catch(console.error);