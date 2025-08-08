#!/usr/bin/env node

import { LpopCLI } from './cli';

async function main() {
  const cli = new LpopCLI();
  await cli.run();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});