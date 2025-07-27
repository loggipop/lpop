import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { KeychainManager } from './keychain-manager.js';
import { GitPathResolver } from './git-path-resolver.js';
import { EnvFileParser, EnvEntry } from './env-file-parser.js';

export class LpopCLI {
  private program: Command;
  private gitResolver: GitPathResolver;

  constructor() {
    this.program = new Command();
    this.gitResolver = new GitPathResolver();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('lpop')
      .description('CLI tool for managing environment variables in the system keychain')
      .version('1.0.0');

    // Main command with smart inference
    this.program
      .argument('[input]', 'Path to .env file, variable assignment (KEY=value), or empty for current repo')
      .option('-e, --env <environment>', 'Environment name')
      .option('-b, --branch <branch>', 'Branch name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)')
      .action(async (input: string | undefined, options) => {
        await this.handleSmartCommand(input, options);
      });

    // Explicit commands
    this.program
      .command('add <input>')
      .description('Add environment variables from file or single variable')
      .option('-e, --env <environment>', 'Environment name')
      .option('-b, --branch <branch>', 'Branch name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)')
      .action(async (input: string, options) => {
        await this.handleAdd(input, options);
      });

    this.program
      .command('get [key]')
      .description('Get environment variables or specific variable')
      .option('-e, --env <environment>', 'Environment name')
      .option('-b, --branch <branch>', 'Branch name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)')
      .option('-o, --output <file>', 'Output to .env file')
      .action(async (key: string | undefined, options) => {
        await this.handleGet(key, options);
      });

    this.program
      .command('update <input>')
      .description('Update environment variables from file or single variable')
      .option('-e, --env <environment>', 'Environment name')
      .option('-b, --branch <branch>', 'Branch name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)')
      .action(async (input: string, options) => {
        await this.handleUpdate(input, options);
      });

    this.program
      .command('remove <key>')
      .description('Remove specific environment variable')
      .option('-e, --env <environment>', 'Environment name')
      .option('-b, --branch <branch>', 'Branch name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)')
      .action(async (key: string, options) => {
        await this.handleRemove(key, options);
      });

    this.program
      .command('clear')
      .description('Clear all environment variables for the repository/environment')
      .option('-e, --env <environment>', 'Environment name')
      .option('-b, --branch <branch>', 'Branch name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)')
      .option('--confirm', 'Skip confirmation prompt')
      .action(async (options) => {
        await this.handleClear(options);
      });

    this.program
      .command('list')
      .description('List all stored repositories and environments')
      .action(async () => {
        await this.handleList();
      });
  }

  private async handleSmartCommand(input: string | undefined, options: any): Promise<void> {
    try {
      // No input - show usage since getting all variables requires explicit operation
      if (!input) {
        console.log(chalk.blue('lpop - Environment Variable Manager'));
        console.log('');
        console.log(chalk.yellow('With the new service format, specify a variable name:'));
        console.log('  lpop get VARIABLE_NAME     # Get variable (with fallback to universal)');
        console.log('  lpop add KEY=value         # Add/update variable');
        console.log('  lpop add .env              # Add from file');
        console.log('');
        console.log('Variable precedence:');
        console.log('  1. Specific: lpop://org/repo/VAR?env=dev&branch=feat');
        console.log('  2. Universal: lpop://org/repo/VAR (no env/branch)');
        console.log('');
        console.log('Options:');
        console.log('  --env development          # Environment context (optional)');
        console.log('  --branch feature-123       # Branch context (optional)');
        console.log('  --repo org/repo           # Override repository');
        return;
      }

      // Check if input is a file path
      if (existsSync(input)) {
        // File exists - add/update
        console.log(chalk.blue(`File ${input} found, adding/updating variables...`));
        await this.handleAdd(input, options);
        return;
      }

      // Check if input is a variable assignment
      if (input.includes('=')) {
        console.log(chalk.blue(`Variable assignment detected, adding/updating...`));
        await this.handleAdd(input, options);
        return;
      }

      // Treat as variable name to get
      console.log(chalk.blue(`Getting variable: ${input}`));
      await this.handleGet(input, options);

    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleAdd(input: string, options: any): Promise<void> {
    try {
      let entries: EnvEntry[];

      if (existsSync(input)) {
        // Parse file
        const parsed = await EnvFileParser.parseFile(input);
        entries = parsed.entries;
        console.log(chalk.green(`Parsed ${entries.length} variables from ${input}`));
      } else {
        // Parse single variable
        entries = [EnvFileParser.parseVariable(input)];
      }

      // Create keychain manager (base service name not used for variable storage)
      const keychain = new KeychainManager('lpop-base');
      
      // Store each variable with its own service name
      for (const { key, value } of entries) {
        const serviceName = await this.getServiceName(key, options);
        await keychain.setEnvironmentVariable(serviceName, value);
        console.log(chalk.green(`✓ Added ${key} -> ${serviceName}`));
      }

    } catch (error) {
      console.error(chalk.red(`Error adding variables: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleGet(key: string | undefined, options: any): Promise<void> {
    const keychain = new KeychainManager('lpop-base');

    try {
      if (key) {
        // Get specific variable with fallback to universal
        const serviceName = await this.getServiceName(key, options);
        const result = await keychain.getEnvironmentVariableWithFallback(serviceName);
        
        if (result.value) {
          if (options.output) {
            await EnvFileParser.writeFile(options.output, [{ key, value: result.value }]);
            console.log(chalk.green(`✓ Variable ${key} written to ${options.output}`));
          } else {
            console.log(`${key}=${result.value}`);
          }
          // Show which source was used if it's different from requested
          if (result.source !== serviceName) {
            console.log(chalk.dim(`(using universal: ${result.source})`));
          }
        } else {
          console.log(chalk.yellow(`Variable ${key} not found`));
        }
      } else {
        // Get all variables - this requires finding all lpop:// services
        console.log(chalk.yellow('Getting all variables requires searching keychain for lpop:// services.'));
        console.log(chalk.yellow('This operation is not yet implemented with the new service format.'));
        console.log(chalk.blue('Specify a variable name: lpop get VARIABLE_NAME'));
      }

    } catch (error) {
      console.error(chalk.red(`Error getting variables: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleUpdate(input: string, options: any): Promise<void> {
    // Update is the same as add - keychain overwrites existing values
    await this.handleAdd(input, options);
  }

  private async handleRemove(key: string, options: any): Promise<void> {
    const keychain = new KeychainManager('lpop-base');

    try {
      const serviceName = await this.getServiceName(key, options);
      const result = await keychain.removeEnvironmentVariableWithFallback(serviceName);
      
      if (result.removed) {
        console.log(chalk.green(`✓ Removed variable ${key}`));
        if (result.source !== serviceName) {
          console.log(chalk.dim(`(removed universal: ${result.source})`));
        } else {
          console.log(chalk.dim(`(removed specific: ${result.source})`));
        }
      } else {
        console.log(chalk.yellow(`Variable ${key} not found`));
      }
    } catch (error) {
      console.error(chalk.red(`Error removing variable: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleClear(options: any): Promise<void> {
    try {
      if (!options.confirm) {
        console.log(chalk.yellow('This will remove ALL environment variables with lpop:// service names'));
        console.log(chalk.yellow('Use --confirm to skip this warning'));
        return;
      }

      console.log(chalk.yellow('Clear operation not yet implemented with new service format.'));
      console.log(chalk.blue('The new format requires finding all lpop:// services in keychain.'));
      console.log(chalk.blue('Use individual variable removal: lpop remove VARIABLE_NAME'));

    } catch (error) {
      console.error(chalk.red(`Error clearing variables: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleList(): Promise<void> {
    // This would require enumerating all keychain services
    // For now, show a message about limitation
    console.log(chalk.blue('Listing stored repositories:'));
    console.log(chalk.yellow('Note: Due to keychain limitations, this requires knowing service names.'));
    console.log(chalk.yellow('Use specific repo/env combinations to check for stored variables.'));
  }

  private async getServiceName(variableName: string, options: any): Promise<string> {
    if (options.repo) {
      // Parse repo format like "org/repo" and construct lpop:// URL
      const baseServiceName = `lpop://${options.repo}/${variableName}`;
      return this.buildServiceNameWithParams(baseServiceName, options.env, options.branch);
    }

    return await this.gitResolver.generateServiceNameAsync(variableName, options.env, options.branch);
  }

  private buildServiceNameWithParams(baseServiceName: string, environment?: string, branch?: string): string {
    const params = [];
    if (environment) params.push(`env=${environment}`);
    if (branch) params.push(`branch=${branch}`);
    
    return params.length > 0 ? `${baseServiceName}?${params.join('&')}` : baseServiceName;
  }

  public async run(): Promise<void> {
    await this.program.parseAsync();
  }
}