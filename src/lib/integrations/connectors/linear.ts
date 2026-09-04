import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinearConfig {
  apiKey: string;
  organizationId?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  estimate?: number;
  state: LinearState;
  assignee?: LinearUser;
  team: LinearTeam;
  labels?: LinearLabel[];
  project?: LinearProject;
  cycle?: LinearCycle;
  parent?: { id: string; identifier: string };
  subIssues?: { nodes: LinearIssue[] };
  comments?: { nodes: LinearComment[] };
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  sortPriority?: number;
  incomingUrls?: string[];
  identifiers?: string[];
}

export interface LinearState {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  active: boolean;
  admin: boolean;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  color: string;
  issueCount: number;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  startDate?: string;
  targetDate?: string;
  lead?: LinearUser;
  teams: { nodes: LinearTeam[] };
  createdAt: string;
  updatedAt: string;
}

export interface LinearCycle {
  id: string;
  name: string;
  number: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  completedAt?: string;
}

export interface LinearComment {
  id: string;
  body: string;
  user: LinearUser;
  createdAt: string;
  updatedAt: string;
}

export interface LinearSearchResult<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor?: string };
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
}

export interface LinearIssueType {
  id: string;
  name: string;
  description?: string;
  icon: string;
}

export interface LinearIntegration {
  id: string;
  type: string;
  app: { name: string };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Linear Integration
// ---------------------------------------------------------------------------

export class LinearIntegration extends BaseIntegration {
  private config: LinearConfig;

  constructor(config: LinearConfig) {
    super('https://api.linear.app/graphql', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 50, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: this.config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  getCapabilities(): string[] {
    return [
      'issues.create',
      'issues.read',
      'issues.update',
      'issues.delete',
      'issues.search',
      'comments.create',
      'comments.read',
      'labels.create',
      'labels.read',
      'projects.create',
      'projects.read',
      'projects.update',
      'cycles.read',
      'teams.read',
      'users.read',
      'workflow_states.read',
      'issue_types.read',
      'integrations.read',
      'search',
    ];
  }

  // -- GraphQL Helper ------------------------------------------------------

  private async gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Linear API error: ${response.status}`);
    const result = await response.json() as { data?: T; errors?: { message: string }[] };
    if (result.errors?.length) throw new Error(`GraphQL error: ${result.errors[0].message}`);
    if (!result.data) throw new Error('No data returned from Linear');
    return result.data;
  }

  // -- Issues --------------------------------------------------------------

  async createIssue(input: {
    title: string;
    teamId: string;
    description?: string;
    priority?: number;
    estimate?: number;
    assigneeId?: string;
    projectId?: string;
    cycleId?: string;
    parentIssueId?: string;
    labelIds?: string[];
    dueDate?: string;
    stateId?: string;
  }): Promise<{ issue: LinearIssue }> {
    return this.gql(`
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id identifier title description priority
            state { id name type }
            team { id name key }
            createdAt updatedAt
          }
        }
      }
    `, { input });
  }

  async getIssue(issueId: string): Promise<{ issue: LinearIssue }> {
    return this.gql(`
      query Issue($issueId: String!) {
        issue(id: $issueId) {
          id identifier title description priority priorityLabel estimate
          state { id name type color position }
          assignee { id name email displayName }
          team { id name key }
          labels { nodes { id name color description } }
          project { id name description state startDate targetDate }
          cycle { id name number startsAt endsAt isActive }
          parent { id identifier }
          subIssues { nodes { id identifier title state { name } } }
          comments { nodes { id body user { name } createdAt } }
          createdAt updatedAt dueDate sortPriority incomingUrls
        }
      }
    `, { issueId });
  }

  async updateIssue(issueId: string, input: {
    title?: string;
    description?: string;
    priority?: number;
    estimate?: number;
    assigneeId?: string;
    projectId?: string;
    stateId?: string;
    labelIds?: string[];
    dueDate?: string;
    parentIssueId?: string;
  }): Promise<{ issue: LinearIssue }> {
    return this.gql(`
      mutation IssueUpdate($issueId: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $issueId, input: $input) {
          success
          issue { id identifier title description priority updatedAt }
        }
      }
    `, { issueId, input });
  }

  async deleteIssue(issueId: string): Promise<{ success: boolean }> {
    return this.gql(`
      mutation IssueDelete($issueId: String!) {
        issueDelete(id: $issueId) { success }
      }
    `, { issueId });
  }

  async searchIssues(query: string, options?: { teamId?: string; assigneeId?: string; stateType?: string; first?: number }): Promise<LinearSearchResult<LinearIssue>> {
    return this.gql(`
      query IssueSearch($query: String!, $teamId: UUID, $assigneeId: UUID, $first: Int) {
        issueSearch(query: $query, filter: { team: { id: { eq: $teamId } }, assignee: { id: { eq: $assigneeId } } }, first: $first) {
          nodes {
            id identifier title description priority
            state { name type }
            team { name key }
            assignee { displayName }
            createdAt
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { query, ...options, first: options?.first || 50 });
  }

  async listIssues(filter?: {
    teamId?: string;
    assigneeId?: string;
    stateId?: string;
    priority?: number;
    label?: string;
    projectId?: string;
    first?: number;
    after?: string;
  }): Promise<LinearSearchResult<LinearIssue>> {
    return this.gql(`
      query IssueList($filter: IssueFilter, $first: Int, $after: String) {
        issues(filter: $filter, first: $first, after: $after) {
          nodes {
            id identifier title description priority priorityLabel
            state { id name type }
            assignee { id displayName }
            team { id name key }
            labels { nodes { id name color } }
            createdAt updatedAt
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { filter, first: filter?.first || 50, after: filter?.after });
  }

  // -- Comments ------------------------------------------------------------

  async addComment(issueId: string, body: string): Promise<{ comment: LinearComment }> {
    return this.gql(`
      mutation CommentCreate($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment { id body user { name displayName } createdAt }
        }
      }
    `, { input: { issueId, body } });
  }

  async getComments(issueId: string): Promise<LinearComment[]> {
    return this.gql(`
      query IssueComments($issueId: String!) {
        issue(id: $issueId) {
          comments { nodes { id body user { name displayName } createdAt updatedAt } }
        }
      }
    `, { issueId }).then((data: any) => data.issue?.comments?.nodes || []);
  }

  // -- Projects ------------------------------------------------------------

  async createProject(input: {
    name: string;
    description?: string;
    teamIds: string[];
    leadId?: string;
    startDate?: string;
    targetDate?: string;
  }): Promise<{ project: LinearProject }> {
    return this.gql(`
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project { id name description state startDate targetDate createdAt }
        }
      }
    `, { input });
  }

  async getProject(projectId: string): Promise<LinearProject> {
    return this.gql(`
      query Project($projectId: String!) {
        project(id: $projectId) {
          id name description state startDate targetDate
          lead { id displayName }
          teams { nodes { id name key } }
          createdAt updatedAt
        }
      }
    `, { projectId }).then((data: any) => data.project);
  }

  async updateProject(projectId: string, input: {
    name?: string;
    description?: string;
    state?: string;
    startDate?: string;
    targetDate?: string;
    leadId?: string;
  }): Promise<{ project: LinearProject }> {
    return this.gql(`
      mutation ProjectUpdate($projectId: String!, $input: ProjectUpdateInput!) {
        projectUpdate(id: $projectId, input: $input) {
          success
          project { id name description state }
        }
      }
    `, { projectId, input });
  }

  async listProjects(options?: { teamId?: string; first?: number }): Promise<LinearSearchResult<LinearProject>> {
    return this.gql(`
      query ProjectList($filter: ProjectFilter, $first: Int) {
        projects(filter: $filter, first: $first) {
          nodes {
            id name description state startDate targetDate
            lead { displayName }
            teams { nodes { name } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { filter: options?.teamId ? { team: { id: { eq: options.teamId } } } : undefined, first: options?.first || 50 });
  }

  // -- Cycles --------------------------------------------------------------

  async listCycles(options?: { teamId?: string; first?: number }): Promise<LinearSearchResult<LinearCycle>> {
    return this.gql(`
      query CycleList($filter: CycleFilter, $first: Int) {
        cycles(filter: $filter, first: $first) {
          nodes { id name number startsAt endsAt isActive completedAt }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { filter: options?.teamId ? { team: { id: { eq: options.teamId } } } : undefined, first: options?.first || 20 });
  }

  async getCycle(cycleId: string): Promise<LinearCycle> {
    return this.gql(`
      query Cycle($cycleId: String!) {
        cycle(id: $cycleId) {
          id name number startsAt endsAt isActive completedAt
        }
      }
    `, { cycleId }).then((data: any) => data.cycle);
  }

  // -- Teams ---------------------------------------------------------------

  async listTeams(): Promise<LinearTeam[]> {
    return this.gql(`
      query Teams {
        teams { nodes { id name key description color issueCount } }
      }
    `).then((data: any) => data.teams?.nodes || []);
  }

  async getTeam(teamId: string): Promise<LinearTeam> {
    return this.gql(`
      query Team($teamId: String!) {
        team(id: $teamId) { id name key description color issueCount }
      }
    `, { teamId }).then((data: any) => data.team);
  }

  // -- Users ---------------------------------------------------------------

  async getCurrentUser(): Promise<LinearUser> {
    return this.gql(`
      query Viewer {
        viewer { id name email displayName avatarUrl active admin }
      }
    `).then((data: any) => data.viewer);
  }

  async listUsers(options?: { first?: number }): Promise<LinearUser[]> {
    return this.gql(`
      query Users($first: Int) {
        users(first: $first) {
          nodes { id name email displayName avatarUrl active admin }
        }
      }
    `, { first: options?.first || 50 }).then((data: any) => data.users?.nodes || []);
  }

  // -- Workflow States -----------------------------------------------------

  async listWorkflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    return this.gql(`
      query WorkflowStates($teamId: String!) {
        workflowStates(filter: { team: { id: { eq: $teamId } } }) {
          nodes { id name type color position }
        }
      }
    `, { teamId }).then((data: any) => data.workflowStates?.nodes || []);
  }

  // -- Labels --------------------------------------------------------------

  async listLabels(teamId: string): Promise<LinearLabel[]> {
    return this.gql(`
      query Labels($teamId: String!) {
        issueLabels(filter: { team: { id: { eq: $teamId } } }) {
          nodes { id name color description }
        }
      }
    `, { teamId }).then((data: any) => data.issueLabels?.nodes || []);
  }

  async createLabel(input: { name: string; teamId: string; color?: string; description?: string }): Promise<{ issueLabel: LinearLabel }> {
    return this.gql(`
      mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
          success
          issueLabel { id name color description }
        }
      }
    `, { input });
  }

  // -- Issue Types ---------------------------------------------------------

  async listIssueTypes(teamId: string): Promise<LinearIssueType[]> {
    return this.gql(`
      query IssueTypes($teamId: String!) {
        issueTypes(filter: { team: { id: { eq: $teamId } } }) {
          nodes { id name description icon }
        }
      }
    `, { teamId }).then((data: any) => data.issueTypes?.nodes || []);
  }

  // -- Integrations --------------------------------------------------------

  async listIntegrations(): Promise<LinearIntegration[]> {
    return this.gql(`
      query Integrations {
        integrations { nodes { id type app { name } createdAt } }
      }
    `).then((data: any) => data.integrations?.nodes || []);
  }

  // -- Helpers -------------------------------------------------------------

  static priorityLabel(priority: number): string {
    const labels: Record<number, string> = {
      0: 'No priority',
      1: 'Urgent',
      2: 'High',
      3: 'Medium',
      4: 'Low',
    };
    return labels[priority] || 'Unknown';
  }

  static buildIssueFilter(params: {
    teamId?: string;
    assigneeId?: string;
    stateId?: string;
    priority?: number;
    projectId?: string;
    label?: string;
    createdAt?: { after?: string; before?: string };
  }): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (params.teamId) filter.team = { id: { eq: params.teamId } };
    if (params.assigneeId) filter.assignee = { id: { eq: params.assigneeId } };
    if (params.stateId) filter.state = { id: { eq: params.stateId } };
    if (params.priority) filter.priority = { eq: params.priority };
    if (params.projectId) filter.project = { id: { eq: params.projectId } };
    if (params.createdAt?.after) filter.createdAt = { gte: params.createdAt.after };
    if (params.createdAt?.before) filter.createdAt = { lte: params.createdAt.before };
    return filter;
  }
}
