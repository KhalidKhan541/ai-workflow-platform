import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey?: string;
  cloudId?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    status: JiraStatus;
    priority: JiraPriority;
    issuetype: JiraIssueType;
    assignee?: JiraUser;
    reporter?: JiraUser;
    labels?: string[];
    components?: { id: string; name: string }[];
    fixVersions?: { id: string; name: string }[];
    parent?: { id: string; key: string };
    subtasks?: { id: string; key: string; fields: { summary: string; status: JiraStatus } }[];
    created: string;
    updated: string;
    resolutiondate?: string;
    timetracking?: { originalEstimate: string; timeSpent: string; timeRemaining: string };
    customfield_10000?: unknown;
    [key: string]: unknown;
  };
}

export interface JiraStatus {
  id: string;
  name: string;
  description?: string;
  statusCategory: { id: number; key: string; name: string };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
  iconUrl: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls: { '16x16': string; '24x24': string; '32x32': string; '48x48': string };
  active: boolean;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead: JiraUser;
  url: string;
  projectTypeKey: string;
  simplified: boolean;
  projectCategory?: { id: string; name: string; description?: string };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
  originBoardId: number;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban';
  self: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
}

export interface JiraWorklog {
  id: string;
  self: string;
  author: JiraUser;
  comment?: string;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
}

export interface JiraSearchResult {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraComment {
  id: string;
  self: string;
  author: JiraUser;
  body: string;
  created: string;
  updated: string;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  created: string;
  content: string;
  author: JiraUser;
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  orderable: boolean;
  navigable: boolean;
  searchable: boolean;
  clauseNames: string[];
  schema?: { type: string; system?: string; custom?: string; customId?: number };
}

// ---------------------------------------------------------------------------
// Jira Integration
// ---------------------------------------------------------------------------

export class JiraIntegration extends BaseIntegration {
  private config: JiraConfig;
  private authHeader: string;

  constructor(config: JiraConfig) {
    super(config.baseUrl, config);
    this.config = config;
    this.authHeader = 'Basic ' + Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    this.rateLimitConfig = { maxRequests: 100, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Basic;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  getCapabilities(): string[] {
    return [
      'issues.create',
      'issues.read',
      'issues.update',
      'issues.delete',
      'issues.search',
      'issues.transitions',
      'issues.comments',
      'issues.attachments',
      'issues.worklog',
      'projects.read',
      'projects.create',
      'sprints.read',
      'sprints.create',
      'sprints.update',
      'boards.read',
      'users.read',
      'fields.read',
      'statuses.read',
    ];
  }

  // -- Issues --------------------------------------------------------------

  async createIssue(projectKey: string, data: {
    summary: string;
    description?: string;
    issuetype: { name: string };
    priority?: { name: string };
    assignee?: { accountId: string };
    labels?: string[];
    components?: { id: string }[];
    parent?: { key: string };
    customFields?: Record<string, unknown>;
  }): Promise<JiraIssue> {
    return this.post('/issue', {
      fields: {
        project: { key: projectKey },
        summary: data.summary,
        description: data.description,
        issuetype: data.issuetype,
        priority: data.priority,
        assignee: data.assignee,
        labels: data.labels,
        components: data.components,
        parent: data.parent,
        ...data.customFields,
      },
    });
  }

  async getIssue(issueKey: string, expand?: string[]): Promise<JiraIssue> {
    const params: Record<string, string> = {};
    if (expand?.length) params.expand = expand.join(',');
    return this.get(`/issue/${issueKey}`, params);
  }

  async updateIssue(issueKey: string, data: {
    summary?: string;
    description?: string;
    priority?: { name: string };
    assignee?: { accountId: string };
    labels?: string[];
    components?: { id: string }[];
    customFields?: Record<string, unknown>;
  }): Promise<void> {
    const fields: Record<string, unknown> = {};
    if (data.summary) fields.summary = data.summary;
    if (data.description) fields.description = data.description;
    if (data.priority) fields.priority = data.priority;
    if (data.assignee !== undefined) fields.assignee = data.assignee;
    if (data.labels) fields.labels = data.labels;
    if (data.components) fields.components = data.components;
    if (data.customFields) Object.assign(fields, data.customFields);
    await this.request({ method: 'PUT' as any, url: `/issue/${issueKey}`, body: { fields } });
  }

  async deleteIssue(issueKey: string, deleteSubtasks?: boolean): Promise<void> {
    const params: Record<string, string> = {};
    if (deleteSubtasks) params.deleteSubtasks = 'true';
    await this.delete(`/issue/${issueKey}`, params as unknown);
  }

  async search(jql: string, options?: {
    fields?: string[];
    expand?: string[];
    maxResults?: number;
    startAt?: number;
  }): Promise<JiraSearchResult> {
    const body: Record<string, unknown> = { jql };
    if (options?.fields) body.fields = options.fields;
    if (options?.expand) body.expand = options.expand;
    if (options?.maxResults) body.maxResults = options.maxResults;
    if (options?.startAt) body.startAt = options.startAt;
    return this.post('/search', body);
  }

  async searchAll(jql: string): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;
    while (true) {
      const result = await this.search(jql, { startAt, maxResults });
      allIssues.push(...result.issues);
      if (startAt + maxResults >= result.total) break;
      startAt += maxResults;
    }
    return allIssues;
  }

  // -- Transitions ---------------------------------------------------------

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const result = await this.get<{ transitions: JiraTransition[] }>(`/issue/${issueKey}/transitions`);
    return result.transitions;
  }

  async transitionIssue(issueKey: string, transitionId: string, comment?: string): Promise<void> {
    const body: Record<string, unknown> = {
      transition: { id: transitionId },
    };
    if (comment) {
      body.update = { comment: [{ add: { body: comment } }] };
    }
    await this.post(`/issue/${issueKey}/transitions`, body);
  }

  // -- Comments ------------------------------------------------------------

  async addComment(issueKey: string, body: string): Promise<JiraComment> {
    return this.post(`/issue/${issueKey}/comment`, { body });
  }

  async getComments(issueKey: string, options?: { startAt?: number; maxResults?: number }): Promise<{ comments: JiraComment[]; total: number }> {
    return this.get(`/issue/${issueKey}/comment`, options || {});
  }

  async updateComment(issueKey: string, commentId: string, body: string): Promise<JiraComment> {
    return this.put(`/issue/${issueKey}/comment/${commentId}`, { body });
  }

  async deleteComment(issueKey: string, commentId: string): Promise<void> {
    await this.delete(`/issue/${issueKey}/comment/${commentId}`);
  }

  // -- Attachments ---------------------------------------------------------

  async addAttachment(issueKey: string, file: File | Blob, filename: string): Promise<JiraAttachment> {
    const formData = new FormData();
    formData.append('file', file, filename);
    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    headers['X-Atlassian-Token'] = 'no-check';
    const response = await fetch(`${this.baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(`Attach file failed: ${response.status}`);
    const results = await response.json() as JiraAttachment[];
    return results[0];
  }

  async getAttachments(issueKey: string): Promise<JiraAttachment[]> {
    const issue = await this.getIssue(issueKey);
    return (issue.fields as any).attachment || [];
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.delete(`/attachment/${attachmentId}`);
  }

  // -- Worklog -------------------------------------------------------------

  async addWorklog(issueKey: string, data: {
    timeSpent?: string;
    timeSpentSeconds?: number;
    comment?: string;
    started?: string;
  }): Promise<JiraWorklog> {
    return this.post(`/issue/${issueKey}/worklog`, {
      timeSpent: data.timeSpent,
      timeSpentSeconds: data.timeSpentSeconds,
      comment: data.comment,
      started: data.started || new Date().toISOString(),
    });
  }

  async getWorklog(issueKey: string): Promise<{ worklogs: JiraWorklog[]; total: number }> {
    return this.get(`/issue/${issueKey}/worklog`);
  }

  async deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
    await this.delete(`/issue/${issueKey}/worklog/${worklogId}`);
  }

  // -- Projects ------------------------------------------------------------

  async listProjects(): Promise<JiraProject[]> {
    return this.get('/project');
  }

  async getProject(projectKeyOrId: string): Promise<JiraProject> {
    return this.get(`/project/${projectKeyOrId}`);
  }

  async createProject(data: {
    key: string;
    name: string;
    projectTypeKey?: string;
    projectTemplateKey?: string;
    description?: string;
    leadAccountId?: string;
  }): Promise<JiraProject> {
    return this.post('/project', data);
  }

  async deleteProject(projectKeyOrId: string): Promise<void> {
    await this.delete(`/project/${projectKeyOrId}`);
  }

  // -- Sprints -------------------------------------------------------------

  async listSprints(boardId: number, options?: { state?: string; maxResults?: number; startAt?: number }): Promise<{ values: JiraSprint[]; startAt: number; maxResults: number; total: number }> {
    return this.get(`/board/${boardId}/sprint`, options || {});
  }

  async getSprint(sprintId: number): Promise<JiraSprint> {
    return this.get(`/sprint/${sprintId}`);
  }

  async createSprint(boardId: number, data: { name: string; goal?: string; startDate?: string; endDate?: string }): Promise<JiraSprint> {
    return this.post(`/board/${boardId}/sprint`, data);
  }

  async updateSprint(sprintId: number, data: { name?: string; state?: string; goal?: string; endDate?: string }): Promise<JiraSprint> {
    return this.request({ method: 'PUT' as any, url: `/sprint/${sprintId}`, body: data });
  }

  async moveIssuesToSprint(sprintId: number, issueKeys: string[]): Promise<void> {
    await this.post(`/sprint/${sprintId}/issue`, { issues: issueKeys });
  }

  async getSprintIssues(sprintId: number): Promise<JiraSearchResult> {
    return this.get(`/sprint/${sprintId}/issue`);
  }

  // -- Boards --------------------------------------------------------------

  async listBoards(options?: { type?: string; maxResults?: number }): Promise<{ values: JiraBoard[]; total: number }> {
    return this.get('/board', options || {});
  }

  async getBoard(boardId: number): Promise<JiraBoard> {
    return this.get(`/board/${boardId}`);
  }

  // -- Users ---------------------------------------------------------------

  async getCurrentUser(): Promise<JiraUser> {
    return this.get('/myself');
  }

  async getUser(accountId: string): Promise<JiraUser> {
    return this.get('/user', { accountId });
  }

  async searchUsers(query: string): Promise<JiraUser[]> {
    return this.get('/user/search', { query });
  }

  // -- Fields & Statuses ---------------------------------------------------

  async listFields(): Promise<JiraField[]> {
    return this.get('/field');
  }

  async listStatuses(): Promise<JiraStatus[]> {
    return this.get('/status');
  }

  // -- Board Configuration -------------------------------------------------

  async getBoardConfiguration(boardId: number): Promise<Record<string, unknown>> {
    return this.get(`/board/${boardId}/configuration`);
  }

  async getBoardBacklog(boardId: number): Promise<JiraSearchResult> {
    return this.get(`/board/${boardId}/backlog`);
  }

  async getBoardEpics(boardId: number): Promise<{ values: JiraIssue[]; total: number }> {
    return this.get(`/board/${boardId}/epic`);
  }

  // -- Helpers -------------------------------------------------------------

  static buildJQL(params: {
    project?: string;
    status?: string;
    assignee?: string;
    issuetype?: string;
    labels?: string[];
    priority?: string;
    created?: { after?: string; before?: string };
    updated?: { after?: string; before?: string };
    text?: string;
    AND?: string[];
    OR?: string[];
  }): string {
    const conditions: string[] = [];
    if (params.project) conditions.push(`project = "${params.project}"`);
    if (params.status) conditions.push(`status = "${params.status}"`);
    if (params.assignee) conditions.push(`assignee = "${params.assignee}"`);
    if (params.issuetype) conditions.push(`issuetype = "${params.issuetype}"`);
    if (params.labels?.length) conditions.push(`label in (${params.labels.map(l => `"${l}"`).join(', ')})`);
    if (params.priority) conditions.push(`priority = "${params.priority}"`);
    if (params.created?.after) conditions.push(`created >= "${params.created.after}"`);
    if (params.created?.before) conditions.push(`created <= "${params.created.before}"`);
    if (params.updated?.after) conditions.push(`updated >= "${params.updated.after}"`);
    if (params.updated?.before) conditions.push(`updated <= "${params.updated.before}"`);
    if (params.text) conditions.push(`text ~ "${params.text}"`);
    if (params.AND) conditions.push(`(${params.AND.join(' AND ')})`);
    if (params.OR) conditions.push(`(${params.OR.join(' OR ')})`);
    return conditions.join(' AND ') || 'order by created DESC';
  }
}
