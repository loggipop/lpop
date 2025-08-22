import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import {
  asVariable,
  type EnvEntry,
  mergeWithEnvExample,
  parseFile,
  parseVariable,
  type VariableEntry,
  writeFile,
} from './env-file-parser.js';
import { GitPathResolver, getServicePrefix } from './git-path-resolver.js';
import { KeychainManager } from './keychain-manager.js';

type Options = {
  env?: string;
  repo?: string;
};

type ClearOptions = Options & {
  confirm?: boolean;
};

type GetOptions = Options & {
  output?: string;
};

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
      .description(
        'CLI tool for managing environment variables in the system keychain',
      )
      .version(packageJson.version)
      // Global options available to all commands
      .option('-e, --env <environment>', 'Environment name')
      .option('-r, --repo <repo>', 'Repository name (overrides git detection)');

    // Main command with smart inference
    this.program
      .argument(
        '[input]',
        'Path to .env file, variable assignment (KEY=value), or empty for current repo',
      )
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
      .description(
        'Clear all environment variables for the repository/environment',
      )
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

    this.program
      .command('env')
      .description(
        'Run a command with environment variables from keychain (use -- to separate lpop options from command)',
      )
      .argument(
        '[command...]',
        'Command to run (use -- before command to prevent option conflicts)',
      )
      .action(async (command: string[], options: CommandOptions) => {
        const globalOptions = this.program.opts();
        const mergedOptions = { ...globalOptions, ...options };
        await this.handleEnv(command, mergedOptions);
      });
  }

  private async handleSmartCommand(
    input: string | undefined,
    options: CommandOptions,
  ): Promise<void> {
    try {
      // No input - get current repo's variables
      if (!input) {
        await this.handleGet(undefined, options);
        return;
      }

      // Check if input is a file path
      if (existsSync(input)) {
        // File exists - add/update
        console.log(
          chalk.blue(`File ${input} found, adding/updating variables...`),
        );
        await this.handleAdd(input, options);
        return;
      }

      // Check if input is a variable assignment
      if (input.includes('=')) {
        console.log(
          chalk.blue(`Variable assignment detected, adding/updating...`),
        );
        await this.handleAdd(input, options);
        return;
      }

      // Treat as output filename for getting variables
      console.log(chalk.blue(`Outputting variables to ${input}...`));
      await this.handleGet(undefined, { ...options, output: input });
    } catch (error) {
      console.error(
        chalk.red(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    }
  }

  private async handleAdd(
    input: string,
    options: { env?: string; repo?: string },
  ): Promise<void> {
    const serviceName = await this.getServiceName(options);
    const keychain = new KeychainManager(serviceName, options.env);

    try {
      let entries: EnvEntry[];

      if (existsSync(input)) {
        // Parse file
        const parsed = await parseFile(input);
        entries = parsed.entries;
        console.log(
          chalk.green(`Parsed ${entries.length} variables from ${input}`),
        );

        // Report ignored entries with empty values
        if (parsed.ignoredCount > 0) {
          console.log(
            chalk.yellow(
              `⚠️  Ignored ${parsed.ignoredCount} entries with empty values`,
            ),
          );
        }
      } else {
        // Parse single variable
        entries = [parseVariable(input)];
      }

      // Convert EnvEntry to KeychainEntry for the keychain manager
      const keychainEntries = entries
        .filter((entry): entry is VariableEntry => entry.type === 'variable')
        .map((entry) => ({ key: entry.key, value: entry.value }));

      await keychain.setEnvironmentVariables(keychainEntries);
      console.log(
        chalk.green(`✓ Added ${entries.length} variables to ${serviceName}`),
      );
    } catch (error) {
      console.error(
        chalk.red(
          `Error adding variables: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    }
  }

  /**
   * Get environment variables from the keychain for the current repository
   * @param key - The key to get
   * @param options - The options for the command
   */
  private async handleGet(
    key: string | undefined,
    options: GetOptions,
  ): Promise<void> {
    const serviceName = await this.getServiceName(options);
    let logMsg = `Getting variables for ${serviceName}`;
    if (options.repo) {
      logMsg += ` for repo ${options.repo}`;
    }
    if (options.env) {
      logMsg += ` [env: ${options.env}]`;
    }
    console.log(chalk.blue(logMsg));
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
            // Convert KeychainEntry to VariableEntry
            const variableEntry: VariableEntry = asVariable(
              variable.key,
              variable.value,
            );
            await writeFile(options.output, [variableEntry]);
            console.log(
              chalk.green(`✓ Variable ${key} written to ${options.output}`),
            );
          } else {
            console.log(`${variable.key}=${variable.value}`);
          }
        } else {
          console.log(chalk.yellow(`Variable ${key} not found`));
        }
      } else {
        // Get all variables
        const outputFile = options.output || '.env.local';
        // Check if .env.example exists and use it as template
        const envExamplePath = '.env.example';
        if (existsSync(envExamplePath)) {
          console.log(chalk.blue(`Found .env.example, using as template...`));
          const mergedEntries = await mergeWithEnvExample(
            envExamplePath,
            variables,
          );
          await writeFile(outputFile, mergedEntries);
          let varsWritten = 0;
          let emptyVarsWritten = 0;

          for (const entry of mergedEntries) {
            if (entry.type === 'variable') {
              if (entry.value.trim() !== '') {
                varsWritten++;
              } else {
                emptyVarsWritten++;
              }
            }
          }
          console.log(
            chalk.green(
              `✓ ${varsWritten} variables written to ${outputFile} using .env.example template`,
            ),
          );
          if (emptyVarsWritten > 0) {
            console.log(
              chalk.yellow(
                `⚠️  ${emptyVarsWritten} additional unset variables copied from .env.example template`,
              ),
            );
          }
        } else {
          // Convert KeychainEntry to VariableEntry
          const variableEntries: VariableEntry[] = variables.map((v) =>
            asVariable(v.key, v.value),
          );
          await writeFile(outputFile, variableEntries);
          console.log(
            chalk.green(
              `✓ ${variables.length} variables written to ${outputFile}`,
            ),
          );
        }
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Error getting variables: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    }
  }

  private async handleUpdate(
    input: string,
    options: CommandOptions,
  ): Promise<void> {
    // Update is the same as add - keychain overwrites existing values
    await this.handleAdd(input, options);
  }

  private async handleRemove(
    key: string,
    options: CommandOptions,
  ): Promise<void> {
    const serviceName = await this.getServiceName(options);
    const keychain = new KeychainManager(serviceName, options.env);

    try {
      const removed = await keychain.removeEnvironmentVariable(key);
      if (removed) {
        console.log(
          chalk.green(`✓ Removed variable ${key} from ${serviceName}`),
        );
      } else {
        console.log(
          chalk.yellow(`Variable ${key} not found in ${serviceName}`),
        );
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Error removing variable: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    }
  }

  private async handleClear(options: ClearOptions): Promise<void> {
    const serviceName = await this.getServiceName(options);
    const keychain = new KeychainManager(serviceName, options.env);

    try {
      if (!options.confirm) {
        console.log(
          chalk.yellow(
            `This will remove ALL environment variables for ${serviceName}`,
          ),
        );
        console.log(chalk.yellow('Use --confirm to skip this warning'));
        return;
      }

      await keychain.clearAllEnvironmentVariables();
      console.log(chalk.green(`✓ Cleared all variables for ${serviceName}`));
    } catch (error) {
      console.error(
        chalk.red(
          `Error clearing variables: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    }
  }

  private async handleList(): Promise<void> {
    // This would require enumerating all keychain services
    // For now, show a message about limitation
    console.log(chalk.blue('Listing stored repositories:'));
    console.log(
      chalk.yellow(
        'Note: Due to keychain limitations, this requires knowing service names.',
      ),
    );
    console.log(
      chalk.yellow(
        'Use specific repo/env combinations to check for stored variables.',
      ),
    );
  }

  private async handleEnv(
    command: string[],
    options: CommandOptions,
  ): Promise<void> {
    const serviceName = await this.getServiceName(options);
    const keychain = new KeychainManager(serviceName, options.env);

    try {
      // Parse command line arguments manually to handle --
      const args = process.argv.slice(2); // Remove 'node' and script name
      const envIndex = args.indexOf('env');
      let actualCommand = command;

      if (envIndex !== -1) {
        // Find arguments after 'env' command
        const afterEnvArgs = args.slice(envIndex + 1);

        // Look for -- separator
        const dashDashIndex = afterEnvArgs.indexOf('--');

        if (dashDashIndex !== -1) {
          // Everything after -- is the command
          actualCommand = afterEnvArgs.slice(dashDashIndex + 1);
        } else {
          // No -- separator, use the command as passed by commander
          // But filter out lpop options that might have been included
          actualCommand = command.filter(
            (arg) =>
              !arg.startsWith('-') &&
              !['development', 'production', 'staging'].includes(arg), // common env values
          );
        }
      }

      const variables = await keychain.getEnvironmentVariables();

      if (variables.length === 0) {
        console.log(chalk.yellow(`No variables found for ${serviceName}`));
        if (actualCommand.length === 0) {
          return;
        }
      }

      // If no command specified, just show what variables would be loaded
      if (actualCommand.length === 0) {
        console.log(chalk.blue(`Environment variables for ${serviceName}:`));
        for (const { key, value } of variables) {
          console.log(`${key}=${value}`);
        }
        return;
      }

      // Prepare environment with keychain variables
      const env = { ...process.env };
      for (const { key, value } of variables) {
        env[key] = value;
      }

      console.log(
        chalk.blue(
          `Running "${actualCommand.join(' ')}" with ${variables.length} variables from ${serviceName}`,
        ),
      );

      // Spawn the command with the enhanced environment
      const child = spawn(actualCommand[0], actualCommand.slice(1), {
        env,
        stdio: 'inherit',
      });

      // Handle process exit
      child.on('close', (code) => {
        process.exit(code || 0);
      });

      child.on('error', (error) => {
        console.error(chalk.red(`Failed to start command: ${error.message}`));
        process.exit(1);
      });
    } catch (error) {
      console.error(
        chalk.red(
          `Error loading environment: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    }
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
