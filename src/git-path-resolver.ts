import { basename } from 'node:path';
import GitUrlParse from 'git-url-parse';
import { type SimpleGit, simpleGit } from 'simple-git';

export interface GitInfo {
  owner: string;
  name: string;
  full_name: string;
}

export const isDevelopment = () => {
  // Check if running directly with bun/node (not compiled) - note this is not the user's "development" environment, just how we are running the CLI either compiled or through bun.
  // When running as compiled binary directly, execPath ends with 'lpop'
  if (basename(process.execPath).startsWith('lpop')) {
    return false;
  }

  // When running through npm/node_modules (production install), argv[1] contains node_modules
  if (process.argv[1]?.includes('node_modules')) {
    return false;
  }

  // Otherwise we're in development (running with bun/node from source)
  return true;
};

export const getServicePrefix = () =>
  isDevelopment() ? 'lpop-dev://' : 'lpop://';

export class GitPathResolver {
  private git: SimpleGit;

  constructor(private workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir);
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async getRemoteUrl(remoteName: string = 'origin'): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const remote = remotes.find((r) => r.name === remoteName);
      return remote?.refs?.fetch || null;
    } catch {
      return null;
    }
  }

  async getGitInfo(): Promise<GitInfo | null> {
    const remoteUrl = await this.getRemoteUrl();
    if (!remoteUrl) {
      return null;
    }

    try {
      const parsed = GitUrlParse(remoteUrl);
      return {
        owner: parsed.owner,
        name: parsed.name,
        full_name: parsed.full_name,
      };
    } catch {
      return null;
    }
  }

  async generateServiceNameAsync(): Promise<string> {
    const gitInfo = await this.getGitInfo();
    if (gitInfo) {
      return `${getServicePrefix()}${gitInfo.full_name}`;
    }

    // Fallback to current directory name
    const dirName = this.workingDir.split('/').pop() || 'unknown';
    return `${getServicePrefix()}local/${dirName}`;
  }

  static extractEnvironmentFromService(serviceName: string): string | null {
    const url = new URL(serviceName);
    const environment = url.searchParams.get('env');
    return environment;
  }

  static extractRepoFromService(serviceName: string): string {
    const url = new URL(serviceName);
    return url.hostname + url.pathname;
  }
}
