import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber?: string;
  messagingServiceSid?: string;
}

export interface TwilioMessage {
  sid: string;
  dateCreated: string;
  dateUpdated: string;
  dateSent?: string;
  accountSid: string;
  to: string;
  from: string;
  messagingServiceSid?: string;
  body: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed' | 'receiving' | 'received' | 'accepted' | 'scheduled' | 'read' | 'partially_delivered' | 'canceled';
  numSegments: string;
  numMedia: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  apiVersion: string;
  price?: string;
  priceUnit?: string;
  errorCode?: number;
  errorMessage?: string;
  uri: string;
}

export interface TwilioCall {
  sid: string;
  dateCreated: string;
  dateUpdated: string;
  accountSid: string;
  to: string;
  from: string;
  phoneNumberSid?: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'canceled' | 'failed';
  startTime?: string;
  endTime?: string;
  duration?: string;
  price?: string;
  priceUnit?: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  answeredBy?: string;
  callerName?: string;
  uri: string;
}

export interface TwilioPhoneNumber {
  sid: string;
  accountSid: string;
  friendlyName: string;
  phoneNumber: string;
  lata?: string;
  rateCenter?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  beta: boolean;
  addressRequirements: string;
  beta?: boolean;
}

export interface TwilioWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  NumSegments: string;
  MessageStatus: string;
  SmsStatus: string;
  SmsMessageSid: string;
}

export interface TwilioListResponse<T> {
  end: number;
  first_page_uri: string;
  next_page_uri?: string;
  page: number;
  page_size: number;
  previous_page_uri?: string;
  start: number;
  uri: string;
  messages?: T[];
  calls?: T[];
  incoming_phone_numbers?: T[];
}

// ---------------------------------------------------------------------------
// Twilio Integration
// ---------------------------------------------------------------------------

export class TwilioIntegration extends BaseIntegration {
  private config: TwilioConfig;
  private authHeader: string;

  constructor(config: TwilioConfig) {
    super(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}`, config);
    this.config = config;
    this.authHeader = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    this.rateLimitConfig = { maxRequests: 100, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Basic;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Basic ${this.authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  getCapabilities(): string[] {
    return [
      'sms.send',
      'sms.read',
      'sms.webhook',
      'calls.initiate',
      'calls.read',
      'calls.hangup',
      'calls.record',
      'calls.twiml',
      'phone_numbers.list',
      'phone_numbers.buy',
      'phone_numbers.release',
      'messages.status_callback',
      'usage.read',
    ];
  }

  // -- SMS -----------------------------------------------------------------

  async sendSms(to: string, body: string, options?: {
    from?: string;
    messagingServiceSid?: string;
    statusCallback?: string;
    maxPrice?: number;
    validityPeriod?: number;
    forceDelivery?: boolean;
    contentRetention?: boolean;
    retention?: boolean;
    smartEncoded?: boolean;
  }): Promise<TwilioMessage> {
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('Body', body);
    if (options?.from || this.config.phoneNumber) {
      params.append('From', options?.from || this.config.phoneNumber!);
    }
    if (options?.messagingServiceSid || this.config.messagingServiceSid) {
      params.append('MessagingServiceSid', options?.messagingServiceSid || this.config.messagingServiceSid!);
    }
    if (options?.statusCallback) params.append('StatusCallback', options.statusCallback);
    if (options?.maxPrice) params.append('MaxPrice', String(options.maxPrice));
    if (options?.validityPeriod) params.append('ValidityPeriod', String(options.validityPeriod));

    return this.request<TwilioMessage>({
      method: 'POST' as any,
      url: '/Messages.json',
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async sendMediaMessage(to: string, body: string, mediaUrls: string[], options?: {
    from?: string;
    messagingServiceSid?: string;
    statusCallback?: string;
  }): Promise<TwilioMessage> {
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('Body', body);
    for (const url of mediaUrls) params.append('MediaUrl', url);
    if (options?.from || this.config.phoneNumber) params.append('From', options?.from || this.config.phoneNumber!);
    if (options?.messagingServiceSid || this.config.messagingServiceSid) {
      params.append('MessagingServiceSid', options?.messagingServiceSid || this.config.messagingServiceSid!);
    }
    if (options?.statusCallback) params.append('StatusCallback', options.statusCallback);

    return this.request<TwilioMessage>({
      method: 'POST' as any,
      url: '/Messages.json',
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async getMessage(messageSid: string): Promise<TwilioMessage> {
    return this.get(`/Messages/${messageSid}.json`);
  }

  async listMessages(options?: {
    to?: string;
    from?: string;
    dateSent?: string;
    dateSentBefore?: string;
    dateSentAfter?: string;
    limit?: number;
    pageSize?: number;
    pageToken?: string;
  }): Promise<TwilioListResponse<TwilioMessage>> {
    const params: Record<string, string> = {};
    if (options?.to) params.To = options.to;
    if (options?.from) params.From = options.from;
    if (options?.dateSent) params.DateSent = options.dateSent;
    if (options?.dateSentBefore) params.DateSent< = options.dateSentBefore;
    if (options?.dateSentAfter) params.DateSent>= = options.dateSentAfter;
    if (options?.limit) params.PageSize = String(options.limit);
    if (options?.pageToken) params.PageToken = options.pageToken;
    return this.get('/Messages.json', params);
  }

  async deleteMessage(messageSid: string): Promise<boolean> {
    await this.delete(`/Messages/${messageSid}.json`);
    return true;
  }

  // -- Calls ---------------------------------------------------------------

  async makeCall(to: string, url: string, options?: {
    from?: string;
    method?: string;
    fallbackUrl?: string;
    fallbackMethod?: string;
    statusCallback?: string;
    statusCallbackEvent?: string[];
    statusCallbackMethod?: string;
    timeout?: number;
    machineDetection?: string;
    recordingChannels?: number;
    recordingStatusCallback?: string;
    trim?: string;
    callerId?: string;
    twiml?: string;
  }): Promise<TwilioCall> {
    const params = new URLSearchParams();
    params.append('To', to);
    if (options?.twiml) {
      params.append('Twiml', options.twiml);
    } else {
      params.append('Url', url);
    }
    if (options?.from || this.config.phoneNumber) params.append('From', options?.from || this.config.phoneNumber!);
    if (options?.method) params.append('Method', options.method);
    if (options?.fallbackUrl) params.append('FallbackUrl', options.fallbackUrl);
    if (options?.statusCallback) params.append('StatusCallback', options.statusCallback);
    if (options?.statusCallbackEvent) options.statusCallbackEvent.forEach(e => params.append('StatusCallbackEvent', e));
    if (options?.timeout) params.append('Timeout', String(options.timeout));
    if (options?.machineDetection) params.append('MachineDetection', options.machineDetection);
    if (options?.recordingChannels) params.append('RecordingChannels', String(options.recordingChannels));
    if (options?.trim) params.append('Trim', options.trim);

    return this.request<TwilioCall>({
      method: 'POST' as any,
      url: '/Calls.json',
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async getCall(callSid: string): Promise<TwilioCall> {
    return this.get(`/Calls/${callSid}.json`);
  }

  async listCalls(options?: {
    to?: string;
    from?: string;
    status?: string;
    startTime?: string;
    startTimeBefore?: string;
    startTimeAfter?: string;
    endTime?: string;
    endTimeBefore?: string;
    endTimeAfter?: string;
    limit?: number;
    pageSize?: number;
  }): Promise<TwilioListResponse<TwilioCall>> {
    const params: Record<string, string> = {};
    if (options?.to) params.To = options.to;
    if (options?.from) params.From = options.from;
    if (options?.status) params.Status = options.status;
    if (options?.limit) params.PageSize = String(options.limit);
    return this.get('/Calls.json', params);
  }

  async hangupCall(callSid: string): Promise<TwilioCall> {
    const params = new URLSearchParams();
    params.append('Status', 'completed');
    return this.request<TwilioCall>({
      method: 'POST' as any,
      url: `/Calls/${callSid}.json`,
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async redirectCall(callSid: string, twiml: string): Promise<TwilioCall> {
    const params = new URLSearchParams();
    params.append('Twiml', twiml);
    return this.request<TwilioCall>({
      method: 'POST' as any,
      url: `/Calls/${callSid}.json`,
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async deleteCall(callSid: string): Promise<boolean> {
    await this.delete(`/Calls/${callSid}.json`);
    return true;
  }

  // -- Recordings ----------------------------------------------------------

  async listRecordings(options?: { callSid?: string; limit?: number }): Promise<{ recordings: { sid: string; callSid: string; dateCreated: string; duration: number; uri: string }[] }> {
    const params: Record<string, string> = {};
    if (options?.callSid) params.CallSid = options.callSid;
    if (options?.limit) params.PageSize = String(options.limit);
    return this.get('/Recordings.json', params);
  }

  async deleteRecording(recordingSid: string): Promise<boolean> {
    await this.delete(`/Recordings/${recordingSid}.json`);
    return true;
  }

  // -- Phone Numbers -------------------------------------------------------

  async listPhoneNumbers(options?: { phoneNumber?: string; limit?: number }): Promise<TwilioListResponse<TwilioPhoneNumber>> {
    const params: Record<string, string> = {};
    if (options?.phoneNumber) params.PhoneNumber = options.phoneNumber;
    if (options?.limit) params.PageSize = String(options.limit);
    return this.get('/IncomingPhoneNumbers.json', params);
  }

  async getPhoneNumber(phoneNumberSid: string): Promise<TwilioPhoneNumber> {
    return this.get(`/IncomingPhoneNumbers/${phoneNumberSid}.json`);
  }

  async buyPhoneNumber(phoneNumber: string): Promise<TwilioPhoneNumber> {
    const params = new URLSearchParams();
    params.append('PhoneNumber', phoneNumber);
    return this.request<TwilioPhoneNumber>({
      method: 'POST' as any,
      url: '/IncomingPhoneNumbers.json',
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async releasePhoneNumber(phoneNumberSid: string): Promise<boolean> {
    await this.delete(`/IncomingPhoneNumbers/${phoneNumberSid}.json`);
    return true;
  }

  async searchAvailablePhoneNumbers(country: string, options?: {
    phoneNumber?: string;
    areaCode?: string;
    contains?: string;
    smsEnabled?: boolean;
    voiceEnabled?: boolean;
    limit?: number;
  }): Promise<{ incomingPhoneNumbers: { phoneNumber: string; friendlyName: string }[] }> {
    const params: Record<string, string> = {};
    if (options?.phoneNumber) params.PhoneNumber = options.phoneNumber;
    if (options?.areaCode) params.AreaCode = options.areaCode;
    if (options?.contains) params.Contains = options.contains;
    if (options?.smsEnabled) params.SmsEnabled = 'true';
    if (options?.voiceEnabled) params.VoiceEnabled = 'true';
    if (options?.limit) params.PageSize = String(options.limit);
    return this.get(`/AvailablePhoneNumbers/${country}/Local.json`, params);
  }

  // -- Usage ---------------------------------------------------------------

  async getUsage(options?: { startDate?: string; endDate?: string }): Promise<{ records: { category: string; count: number; usage: string; account_sid: string }[] }> {
    const params: Record<string, string> = {};
    if (options?.startDate) params.StartDate = options.startDate;
    if (options?.endDate) params.EndDate = options.endDate;
    return this.get('/Usage/Records/Today.json', params);
  }

  // -- Webhook Helpers -----------------------------------------------------

  validateWebhook(signature: string, url: string, params: Record<string, string>): boolean {
    const crypto = require('crypto');
    const data = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], '');
    const computed = crypto
      .createHmac('sha1', this.config.authToken)
      .update(Buffer.from(url + data, 'utf-8'))
      .digest('base64');
    return computed === signature;
  }

  parseWebhookBody(body: string): Record<string, string> {
    return body.split('&').reduce((acc: Record<string, string>, pair) => {
      const [key, value] = pair.split('=');
      acc[decodeURIComponent(key)] = decodeURIComponent(value);
      return acc;
    }, {});
  }
}
