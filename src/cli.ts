import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { KeychainManager } from './keychain-manager.js';
import { GitPathResolver, getServicePrefix } from './git-path-resolver.js';
import { EnvFileParser, EnvEntry } from './env-file-parser.js';
import packageJson from '../package.json' with { type: 'json' };

type Options = {
  env?: string;
  repo?: string;
}

type ClearOptions = Options & {
  confirm?: boolean;
}

type GetOptions = Options & {
  output?: string;
}

type CommandOptions = Options | ClearOptions | GetOptions;

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
      .version(packageJson.version)
      // Global options available to all commands
      .option('-e, --env <environment>', 'Environment name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)');

    // Main command with smart inference
    this.program
      .argument('[input]', 'Path to .env file, variable assignment (KEY=value), or empty for current repo')
      .action(async (input: string | undefined, options: CommandOptions) => {
        await this.handleSmartCommand(input, options);
      });

    // Explicit commands (inherit global -e/-r options)
    this.program
      .command('add <input>')
      .description('Add environment variables from file or single variable')
      .action(async (input: string, options: CommandOptions) => {
        const globalOptions = this.program.opts();
        const mergedOptions = { ...globalOptions, ...options };
        await this.handleAdd(input, mergedOptions);
      });

    this.program
      .command('get [key]')
      .description('Get environment variables or specific variable')
      .option('-o, --output <file>', 'Output to .env file')
      .action(async (key: string | undefined, options: GetOptions) => {
        const globalOptions = this.program.opts();
        const mergedOptions = { ...globalOptions, ...options };
        await this.handleGet(key, mergedOptions);
      });

    this.program
      .command('update <input>')
      .description('Update environment variables from file or single variable')
      .action(async (input: string, options: CommandOptions) => {
        const globalOptions = this.program.opts();
        const mergedOptions = { ...globalOptions, ...options };
        await this.handleUpdate(input, mergedOptions);
      });

    this.program
      .command('remove <key>')
      .description('Remove specific environment variable')
      .action(async (key: string, options: CommandOptions) => {
        const globalOptions = this.program.opts();
        const mergedOptions = { ...globalOptions, ...options };
        await this.handleRemove(key, mergedOptions);
      });

    this.program
      .command('clear')
      .description('Clear all environment variables for the repository/environment')
      .option('--confirm', 'Skip confirmation prompt')
      .action(async (options: CommandOptions) => {
        const globalOptions = this.program.opts();
        const mergedOptions = { ...globalOptions, ...options };
        await this.handleClear(mergedOptions);
      });

    this.program
      .command('list')
      .description('List all stored repositories and environments')
      .action(async () => {
        await this.handleList();
      });
  }

  private async handleSmartCommand(input: string | undefined, options: CommandOptions): Promise<void> {
    try {
      // No input - get current repo's variables
      if (!input) {
        await this.handleGet(undefined, options);
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

      // Treat as file path that might be stored
      console.log(chalk.blue(`Checking for stored variables...`));
      await this.handleGet(undefined, { ...options, output: input });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleAdd(input: string, options: { env?: string, repo?: string }): Promise<void> {
    const serviceName = await this.getServiceName(options);
    const keychain = new KeychainManager(serviceName, options.env);

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

      await keychain.setEnvironmentVariables(entries);
      console.log(chalk.green(`✓ Added ${entries.length} variables to ${serviceName}`));
    } catch (error) {
      console.error(chalk.red(`Error adding variables: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  /**
   * Get environment variables from the keychain for the current repository
   * @param key - The key to get
   * @param options - The options for the command
   */
  private async handleGet(key: string | undefined, options: GetOptions): Promise<void> {
    const serviceName = await this.getServiceName(options);
    console.log(chalk.blue(`Getting variables for ${serviceName} with repo ${options.repo} and env ${options.env}`));
    const keychain = new KeychainManager(serviceName, options.env);

    try {
      const variables = await keychain.getEnvironmentVariables();

      if (variables.length === 0) {
        console.log(chalk.yellow(`No variables found for ${serviceName}`));
        return;
      }

      if (key) {
        // Get specific variable
        const variable = variables.find((v) => v.key === key);
        if (variable) {
          if (options.output) {
            await EnvFileParser.writeFile(options.output, [variable]);
            console.log(chalk.green(`✓ Variable ${key} written to ${options.output}`));
          } else {
            console.log(`${variable.key}=${variable.value}`);
          }
        } else {
          console.log(chalk.yellow(`Variable ${key} not found`));
        }
      } else {
        // Get all variables
        if (options.output) {
          await EnvFileParser.writeFile(options.output, variables);
          console.log(chalk.green(`✓ ${variables.length} variables written to ${options.output}`));
        } else {
          console.log(chalk.blue(`Environment variables for ${serviceName}:`));
          for (const { key: varKey, value } of variables) {
            console.log(`${varKey}=${value}`);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error getting variables: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleUpdate(input: string, options: CommandOptions): Promise<void> {
    // Update is the same as add - keychain overwrites existing values
    await this.handleAdd(input, options);
  }

  private async handleRemove(key: string, options: CommandOptions): Promise<void> {
    const serviceName = await this.getServiceName(options);
    const keychain = new KeychainManager(serviceName, options.env);

    try {
      const removed = await keychain.removeEnvironmentVariable(key);
      if (removed) {
        console.log(chalk.green(`✓ Removed variable ${key} from ${serviceName}`));
      } else {
        console.log(chalk.yellow(`Variable ${key} not found in ${serviceName}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error removing variable: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async handleClear(options: ClearOptions): Promise<void> {
    const serviceName = await this.getServiceName(options);
    const keychain = new KeychainManager(serviceName, options.env);

    try {
      if (!options.confirm) {
        console.log(chalk.yellow(`This will remove ALL environment variables for ${serviceName}`));
        console.log(chalk.yellow('Use --confirm to skip this warning'));
        return;
      }

      await keychain.clearAllEnvironmentVariables();
      console.log(chalk.green(`✓ Cleared all variables for ${serviceName}`));
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

  private async getServiceName(options: CommandOptions): Promise<string> {
    if (options.repo) {
      return `${getServicePrefix()}${options.repo}`;
    }

    return await this.gitResolver.generateServiceNameAsync();
  }

  public async run(): Promise<void> {
    await this.program.parseAsync(process.argv);
  }
}
