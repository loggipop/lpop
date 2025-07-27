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

  generateServiceName(variableName: string, environment?: string, branch?: string): string {
    const gitInfo = this.getGitInfoSync();
    const baseServiceName = gitInfo 
      ? `lpop://${gitInfo.owner}/${gitInfo.name}/${variableName}`
      : `lpop://local/${this.workingDir.split('/').pop() || 'unknown'}/${variableName}`;
    
    return this.buildServiceNameWithParams(baseServiceName, environment, branch);
  }

  async generateServiceNameAsync(variableName: string, environment?: string, branch?: string): Promise<string> {
    const gitInfo = await this.getGitInfo();
    const baseServiceName = gitInfo 
      ? `lpop://${gitInfo.owner}/${gitInfo.name}/${variableName}`
      : `lpop://local/${this.workingDir.split('/').pop() || 'unknown'}/${variableName}`;
    
    return this.buildServiceNameWithParams(baseServiceName, environment, branch);
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

  private buildServiceNameWithParams(baseServiceName: string, environment?: string, branch?: string): string {
    const params = [];
    if (environment) params.push(`env=${environment}`);
    if (branch) params.push(`branch=${branch}`);
    
    return params.length > 0 ? `${baseServiceName}?${params.join('&')}` : baseServiceName;
  }

  static extractEnvironmentFromService(serviceName: string): string | undefined {
    const match = serviceName.match(/[?&]env=([^&]+)/);
    return match ? match[1] : undefined;
  }

  static extractBranchFromService(serviceName: string): string | undefined {
    const match = serviceName.match(/[?&]branch=([^&]+)/);
    return match ? match[1] : undefined;
  }

  static extractVariableFromService(serviceName: string): string {
    // Extract variable from lpop://org/repo/VARIABLE or lpop://org/repo/VARIABLE?params
    const match = serviceName.match(/lpop:\/\/[^/]+\/[^/]+\/([^?]+)/);
    return match ? match[1] : '';
  }

  static extractRepoFromService(serviceName: string): string {
    // Extract org/repo from lpop://org/repo/variable
    const match = serviceName.match(/lpop:\/\/([^/]+\/[^/]+)/);
    return match ? match[1] : serviceName.split('?')[0];
  }
}