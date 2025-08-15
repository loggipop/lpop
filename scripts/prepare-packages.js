#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);

const platforms = [
  { name: 'linux', arch: 'x64' },
  { name: 'linux', arch: 'arm64' },
  { name: 'darwin', arch: 'x64' },
  { name: 'darwin', arch: 'arm64' },
  { name: 'windows', arch: 'x64' }
];

// Sync version numbers from main package
console.log('🔄 Syncing version numbers...');
const mainPackageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const mainVersion = mainPackageJson.version;
console.log(`Main package version: ${mainVersion}`);

for (const { name: platform, arch } of platforms) {
  const target = `${platform}-${arch}`;
  const packageName = `lpop-${target}`;
  const packageJsonPath = join(packageRoot, 'packages', packageName, 'package.json');
  
  if (existsSync(packageJsonPath)) {
    const platformPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    platformPackage.version = mainVersion;
    writeFileSync(packageJsonPath, JSON.stringify(platformPackage, null, 2));
    console.log(`Updated ${packageName} to version ${mainVersion}`);
  }
}

// Also update the main package.json's optionalDependencies to use current version
console.log('📝 Updating optionalDependencies versions in main package.json...');
if (mainPackageJson.optionalDependencies) {
  let updated = false;
  for (const dep in mainPackageJson.optionalDependencies) {
    if (dep.startsWith('lpop-')) {
      mainPackageJson.optionalDependencies[dep] = mainVersion;
      updated = true;
    }
  }
  if (updated) {
    writeFileSync(join(packageRoot, 'package.json'), JSON.stringify(mainPackageJson, null, '\t') + '\n');
    console.log(`✅ Updated optionalDependencies to version ${mainVersion}`);
  }
}

console.log('📦 Copying binaries to platform packages...');

for (const { name: platform, arch } of platforms) {
  const target = `${platform}-${arch}`;
  const packageName = `lpop-${target}`;
  const binaryName = platform === 'windows' ? `lpop-${target}.exe` : `lpop-${target}`;
  
  const sourcePath = join(packageRoot, 'dist', binaryName);
  const destDir = join(packageRoot, 'packages', packageName);
  const destPath = join(destDir, binaryName);
  
  if (existsSync(sourcePath)) {
    copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${binaryName} to ${packageName}/`);
  } else {
    console.warn(`⚠️ Binary not found: ${sourcePath}`);
  }
}

console.log('🎉 Package preparation complete!');