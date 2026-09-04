export { BaseIntegration, AuthType, ErrorCategory, HttpMethod } from './base';
export type {
  OAuth2Config,
  OAuth2PKCEConfig,
  ClientCredentialsConfig,
  ApiKeyConfig,
  BearerConfig,
  BasicConfig,
  TokenData,
  RateLimitConfig,
  RetryConfig,
  RequestConfig,
  ResponseData,
  IntegrationError,
  InterceptorConfig,
} from './base';

export { IntegrationRegistry, IntegrationCategory, registry } from './registry';
export type {
  IntegrationMetadata,
  IntegrationInstance,
  IntegrationFilter,
  IntegrationSearchResult,
} from './registry';

export { SlackIntegration } from './connectors/slack';
export { GmailIntegration } from './connectors/gmail';
export { GitHubIntegration } from './connectors/github';
export { NotionIntegration } from './connectors/notion';
export { AirtableIntegration } from './connectors/airtable';
export { StripeIntegration } from './connectors/stripe';
export { GoogleSheetsIntegration } from './connectors/google_sheets';
export { HubSpotIntegration } from './connectors/hubspot';
export { TwilioIntegration } from './connectors/twilio';
export { OpenAIIntegration } from './connectors/openai_connector';
export { AWSS3Integration } from './connectors/aws_s3';
export { ZapierIntegration } from './connectors/zapier';
export { MicrosoftTeamsIntegration } from './connectors/microsoft_teams';
export { SalesforceIntegration } from './connectors/salesforce';
export { JiraIntegration } from './connectors/jira';
export { LinearIntegration } from './connectors/linear';
export { FigmaIntegration } from './connectors/figma';
export { CalendlyIntegration } from './connectors/calendly';
