import { simpleGit, SimpleGit } from 'simple-git';
import GitUrlParse from 'git-url-parse';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface GitInfo {
  owner: string;
  name: string;
  full_name: string;
}

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
      const remote = remotes.find(r => r.name === remoteName);
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
        full_name: parsed.full_name
      };
    } catch {
      return null;
    }
  }

  generateServiceName(environment: string = 'development'): string {
    const gitInfo = this.getGitInfoSync();
    if (gitInfo) {
      return `${gitInfo.full_name}?env=${environment}`;
    }
    
    // Fallback to current directory name
    const dirName = this.workingDir.split('/').pop() || 'unknown';
    return `local/${dirName}?env=${environment}`;
  }

  async generateServiceNameAsync(environment: string = 'development'): Promise<string> {
    const gitInfo = await this.getGitInfo();
    if (gitInfo) {
      return `${gitInfo.full_name}?env=${environment}`;
    }
    
    // Fallback to current directory name
    const dirName = this.workingDir.split('/').pop() || 'unknown';
    return `local/${dirName}?env=${environment}`;
  }

  private getGitInfoSync(): GitInfo | null {
    // Simple synchronous check for .git directory
    const gitDir = resolve(this.workingDir, '.git');
    if (!existsSync(gitDir)) {
      return null;
    }

    // For now, return null to force async usage
    // This could be enhanced with synchronous git config reading
    return null;
  }

  static extractEnvironmentFromService(serviceName: string): string {
    const match = serviceName.match(/\?env=([^&]+)/);
    return match ? match[1] : 'development';
  }

  static extractRepoFromService(serviceName: string): string {
    return serviceName.split('?')[0];
  }
}