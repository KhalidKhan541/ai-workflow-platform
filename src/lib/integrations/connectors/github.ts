import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubConfig {
  token?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  installationId?: number;
  baseUrl?: string;
}

export interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  labels: GitHubLabel[];
  assignee?: GitHubUser;
  assignees: GitHubUser[];
  milestone?: GitHubMilestone;
  locked: boolean;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  url: string;
  html_url: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
}

export interface GitHubLabel {
  id: number;
  name: string;
  description?: string;
  color: string;
}

export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description?: string;
  state: 'open' | 'closed';
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  user: GitHubUser;
  head: { ref: string; sha: string; repo?: { name: string } };
  base: { ref: string; sha: string; repo: { name: string } };
  mergeable?: boolean;
  merged?: boolean;
  merged_at?: string;
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: GitHubUser;
  created_at: string;
  updated_at: string;
}

export interface GitHubWebhook {
  id: number;
  name: string;
  events: string[];
  active: boolean;
  config: { url: string; content_type: string; secret?: string };
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: { name: string; email: string; date: string };
  url: string;
}

// ---------------------------------------------------------------------------
// GitHub Integration
// ---------------------------------------------------------------------------

export class GitHubIntegration extends BaseIntegration {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    super(config.baseUrl || 'https://api.github.com', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 5000, windowMs: 3600000 };
  }

  protected determineAuthType(): AuthType {
    return this.config.token ? AT.Bearer : AT.OAuth2;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenData?.accessToken || this.config.token;
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  getCapabilities(): string[] {
    return [
      'issues.create',
      'issues.read',
      'issues.update',
      'issues.delete',
      'issues.comment',
      'pull_requests.create',
      'pull_requests.read',
      'pull_requests.update',
      'pull_requests.merge',
      'pull_requests.review',
      'repositories.read',
      'repositories.create',
      'webhooks.create',
      'webhooks.read',
      'webhooks.delete',
      'commits.read',
      'branches.read',
      'branches.create',
      'releases.read',
      'releases.create',
    ];
  }

  // -- Issues --------------------------------------------------------------

  async createIssue(owner: string, repo: string, data: {
    title: string;
    body?: string;
    assignee?: string;
    milestone?: number;
    labels?: string[];
  }): Promise<GitHubIssue> {
    return this.post(`/repos/${owner}/${repo}/issues`, data);
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  async listIssues(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    assignee?: string;
    labels?: string;
    sort?: 'created' | 'updated' | 'comments';
    direction?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
  }): Promise<GitHubIssue[]> {
    return this.get(`/repos/${owner}/${repo}/issues`, options || {});
  }

  async updateIssue(owner: string, repo: string, issueNumber: number, data: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    assignee?: string;
    milestone?: number;
    labels?: string[];
  }): Promise<GitHubIssue> {
    return this.patch(`/repos/${owner}/${repo}/issues/${issueNumber}`, data);
  }

  async deleteIssue(owner: string, repo: string, issueNumber: number): Promise<void> {
    await this.delete(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  async addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<{ id: number; body: string; created_at: string }> {
    return this.post(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
  }

  async listComments(owner: string, repo: string, issueNumber: number): Promise<{ id: number; body: string; user: GitHubUser; created_at: string }[]> {
    return this.get(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
  }

  async addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<GitHubLabel[]> {
    return this.post(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, { labels });
  }

  async removeLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void> {
    await this.delete(`/repos/${owner}/${repo}/issues/${issueNumber}/labels/${label}`);
  }

  async assignIssue(owner: string, repo: string, issueNumber: number, assignees: string[]): Promise<GitHubIssue> {
    return this.post(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, { assignees });
  }

  // -- Pull Requests -------------------------------------------------------

  async createPullRequest(owner: string, repo: string, data: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<GitHubPullRequest> {
    return this.post(`/repos/${owner}/${repo}/pulls`, data);
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  }

  async listPullRequests(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    sort?: 'created' | 'updated' | 'popularity' | 'long-running';
    direction?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
  }): Promise<GitHubPullRequest[]> {
    return this.get(`/repos/${owner}/${repo}/pulls`, options || {});
  }

  async updatePullRequest(owner: string, repo: string, pullNumber: number, data: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
  }): Promise<GitHubPullRequest> {
    return this.patch(`/repos/${owner}/${repo}/pulls/${pullNumber}`, data);
  }

  async mergePullRequest(owner: string, repo: string, pullNumber: number, options?: {
    commit_title?: string;
    commit_message?: string;
    merge_method?: 'merge' | 'squash' | 'rebase';
  }): Promise<{ sha: string; merged: boolean; message: string }> {
    return this.put(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, options || {});
  }

  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<{ filename: string; status: string; additions: number; deletions: number; patch?: string }[]> {
    return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
  }

  async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: { Accept: 'application/vnd.github.v3.diff' },
    });
    return response.text();
  }

  async createReview(owner: string, repo: string, pullNumber: number, data: {
    body?: string;
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: { path: string; position: number; body: string }[];
  }): Promise<{ id: number; state: string; body?: string }> {
    return this.post(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, data);
  }

  // -- Repositories --------------------------------------------------------

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.get(`/repos/${owner}/${repo}`);
  }

  async listRepositories(options?: {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
  }): Promise<GitHubRepository[]> {
    return this.get('/user/repos', options || {});
  }

  async createRepository(data: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    gitignore_template?: string;
    license_template?: string;
  }): Promise<GitHubRepository> {
    return this.post('/user/repos', data);
  }

  async deleteRepository(owner: string, repo: string): Promise<void> {
    await this.delete(`/repos/${owner}/${repo}`);
  }

  // -- Webhooks ------------------------------------------------------------

  async createWebhook(owner: string, repo: string, data: {
    name: string;
    config: { url: string; content_type?: string; secret?: string; insecure_ssl?: string };
    events?: string[];
    active?: boolean;
  }): Promise<GitHubWebhook> {
    return this.post(`/repos/${owner}/${repo}/hooks`, data);
  }

  async listWebhooks(owner: string, repo: string): Promise<GitHubWebhook[]> {
    return this.get(`/repos/${owner}/${repo}/hooks`);
  }

  async getWebhook(owner: string, repo: string, hookId: number): Promise<GitHubWebhook> {
    return this.get(`/repos/${owner}/${repo}/hooks/${hookId}`);
  }

  async deleteWebhook(owner: string, repo: string, hookId: number): Promise<void> {
    await this.delete(`/repos/${owner}/${repo}/hooks/${hookId}`);
  }

  async pingWebhook(owner: string, repo: string, hookId: number): Promise<void> {
    await this.post(`/repos/${owner}/${repo}/hooks/${hookId}/pings`);
  }

  // -- Commits & Branches --------------------------------------------------

  async listCommits(owner: string, repo: string, options?: {
    sha?: string;
    path?: string;
    since?: string;
    until?: string;
    page?: number;
    per_page?: number;
  }): Promise<GitHubCommit[]> {
    return this.get(`/repos/${owner}/${repo}/commits`, options || {});
  }

  async listBranches(owner: string, repo: string): Promise<{ name: string; commit: { sha: string } }[]> {
    return this.get(`/repos/${owner}/${repo}/branches`);
  }

  // -- Releases ------------------------------------------------------------

  async listReleases(owner: string, repo: string): Promise<{ id: number; tag_name: string; name?: string; body?: string; draft: boolean; prerelease: boolean; created_at: string }[]> {
    return this.get(`/repos/${owner}/${repo}/releases`);
  }

  async createRelease(owner: string, repo: string, data: {
    tag_name: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
  }): Promise<{ id: number; tag_name: string; html_url: string }> {
    return this.post(`/repos/${owner}/${repo}/releases`, data);
  }

  // -- Webhook Verification ------------------------------------------------

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) return false;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', this.config.webhookSecret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  // -- Rate Limit ----------------------------------------------------------

  async getRateLimit(): Promise<{ resources: Record<string, { limit: number; remaining: number; reset: number }> }> {
    return this.get('/rate_limit');
  }

  // -- Search --------------------------------------------------------------

  async searchIssues(owner: string, repo: string, query: string): Promise<{ total_count: number; items: GitHubIssue[] }> {
    return this.get('/search/issues', { q: `${query} repo:${owner}/${repo}` });
  }

  async searchCode(owner: string, repo: string, query: string): Promise<{ total_count: number; items: { name: string; path: string; html_url: string }[] }> {
    return this.get('/search/code', { q: `${query} repo:${owner}/${repo}` });
  }
}
