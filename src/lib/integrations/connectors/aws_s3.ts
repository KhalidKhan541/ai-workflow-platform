import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AWSS3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  signatureVersion?: string;
}

export interface S3Object {
  Key: string;
  LastModified: string;
  ETag: string;
  Size: number;
  StorageClass: string;
  Owner?: { ID: string; DisplayName: string };
}

export interface S3Bucket {
  Name: string;
  CreationDate: string;
  BucketRegion?: string;
}

export interface S3ListResponse {
  Contents: S3Object[];
  NextContinuationToken?: string;
  IsTruncated: boolean;
  Name: string;
  Prefix: string;
  MaxKeys: number;
  Delimiter?: string;
}

export interface S3UploadParams {
  bucket?: string;
  key: string;
  body: Buffer | Blob | string;
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
  serverSideEncryption?: 'AES256' | 'aws:kms';
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  tagging?: string;
}

export interface S3PresignedUrlParams {
  bucket?: string;
  key: string;
  expiresIn?: number;
  httpMethod?: 'GET' | 'PUT';
  contentType?: string;
}

export interface S3CORSRule {
  ID?: string;
  AllowedHeaders: string[];
  AllowedMethods: string[];
  AllowedOrigins: string[];
  ExposeHeaders?: string[];
  MaxAgeSeconds?: number;
}

export interface S3WebsiteConfiguration {
  IndexDocument: { Suffix: string };
  ErrorDocument?: { Key: string };
  RoutingRules?: { Condition: { KeyPrefixEquals?: string }; Redirect: { ReplaceKeyPrefixWith?: string; HttpRedirectCode?: string; Protocol?: string } }[];
}

export interface S3VersioningConfiguration {
  Enabled: boolean;
  MfaDelete?: boolean;
}

export interface S3Tagging {
  TagSet: { Key: string; Value: string }[];
}

export interface S3Policy {
  Version: string;
  Statement: { Sid?: string; Effect: string; Principal: string | Record<string, string[]>; Action: string | string[]; Resource: string | string[]; Condition?: Record<string, unknown> }[];
}

export interface S3AccessControlPolicy {
  Owner: { ID: string; DisplayName?: string };
  Grants: { Grantee: { Type: string; URI?: string; ID?: string }; Permission: string }[];
}

// ---------------------------------------------------------------------------
// AWS Signature V4 Implementation
// ---------------------------------------------------------------------------

class AWSV4Signer {
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;
  private service = 's3';

  constructor(accessKeyId: string, secretAccessKey: string, region: string) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
  }

  private sha256(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private hmac(key: string, data: string): Buffer {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  private getSignatureKey(date: string): Buffer {
    const kDate = this.hmac(`AWS4${this.secretAccessKey}`, date);
    const kRegion = this.hmac(kDate.toString(), this.region);
    const kService = this.hmac(kRegion.toString(), this.service);
    return this.hmac(kService.toString(), 'aws4_request');
  }

  async sign(method: string, url: string, headers: Record<string, string>, payload: string, date?: Date): Promise<Record<string, string>> {
    const now = date || new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15);
    const dateStamp = amzDate.slice(0, 8);

    const parsedUrl = new URL(url);
    const canonicalQuery = parsedUrl.searchParams.toString().split('&').sort().join('&');
    const payloadHash = this.sha256(payload);

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(k => k.toLowerCase())
      .join(' ');

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(k => `${k.toLowerCase()}:${headers[k].trim()}`)
      .join('\n') + '\n';

    const canonicalRequest = [
      method,
      parsedUrl.pathname,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');

    const signatureKey = this.getSignatureKey(dateStamp);
    const signature = this.hmac(signatureKey.toString(), stringToSign).toString('hex');

    return {
      ...headers,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }
}

// ---------------------------------------------------------------------------
// AWS S3 Integration
// ---------------------------------------------------------------------------

export class AWSS3Integration extends BaseIntegration {
  private config: AWSS3Config;
  private signer: AWSV4Signer;

  constructor(config: AWSS3Config) {
    const endpoint = config.endpoint || `https://s3.${config.region}.amazonaws.com`;
    super(endpoint, config);
    this.config = config;
    this.signer = new AWSV4Signer(config.accessKeyId, config.secretAccessKey, config.region);
    this.rateLimitConfig = { maxRequests: 100, windowMs: 1000 };
  }

  protected determineAuthType(): AuthType {
    return AT.ApiKey;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  getCapabilities(): string[] {
    return [
      'objects.upload',
      'objects.download',
      'objects.delete',
      'objects.head',
      'objects.copy',
      'objects.list',
      'objects.restore',
      'objects.tag',
      'presigned_urls',
      'cors.manage',
      'website.manage',
      'versioning.manage',
      'lifecycle.manage',
      'policy.manage',
      'access_control.manage',
    ];
  }

  private getBucketUrl(bucket?: string): string {
    const b = bucket || this.config.bucket;
    if (!b) throw new Error('Bucket name required');
    if (this.config.forcePathStyle) return `${this.baseUrl}/${b}`;
    return `https://${b}.s3.${this.config.region}.amazonaws.com`;
  }

  private getSignedUrl(bucket: string, key: string, method: string, expires: number, contentType?: string): string {
    const crypto = require('crypto');
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 8);
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15);

    const bucketUrl = this.getBucketUrl(bucket);
    const url = new URL(`/${key}`, bucketUrl);
    const canonicalQuery = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${this.config.accessKeyId}%2F${dateStamp}%2F${this.config.region}%2Fs3%2Faws4_request&X-Amz-Date=${amzDate}&X-Amz-Expires=${expires}`;
    if (contentType) url.searchParams.set('X-Amz-Content-Type', contentType);

    const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const signedHeaders = contentType ? 'host;x-amz-content-sha256;x-amz-content-type' : 'host;x-amz-content-sha256';
    const canonicalHeaders = `host:${url.hostname}\nx-amz-content-sha256:${payloadHash}${contentType ? `\nx-amz-content-type:${contentType}` : ''}\n`;

    const canonicalRequest = ['GET', `/${key}`, canonicalQuery.split('&').sort().join('&'), canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [`AWS4-HMAC-SHA256`, amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.config.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    return `${url.origin}/${key}?${canonicalQuery}&X-Amz-SignedHeaders=${signedHeaders}&X-Amz-Signature=${signature}`;
  }

  // -- Bucket Operations ---------------------------------------------------

  async listBuckets(): Promise<{ Buckets: S3Bucket[]; Owner: { ID: string; DisplayName: string } }> {
    const url = `${this.baseUrl}/`;
    const date = new Date();
    const headers = await this.signer.sign('GET', url, { Host: new URL(url).hostname }, '', date);
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`List buckets failed: ${response.status}`);
    const text = await response.text();
    return this.parseXml(text) as any;
  }

  async createBucket(bucket: string, region?: string): Promise<void> {
    const url = `https://${bucket}.s3.${region || this.config.region}.amazonaws.com/`;
    const body = region ? `<CreateBucketConfiguration><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>` : '';
    const headers = await this.signer.sign('PUT', url, { Host: new URL(url).hostname }, body);
    const response = await fetch(url, { method: 'PUT', headers, body });
    if (!response.ok) throw new Error(`Create bucket failed: ${response.status}`);
  }

  async deleteBucket(bucket: string): Promise<void> {
    const url = this.getBucketUrl(bucket) + '/';
    const headers = await this.signer.sign('DELETE', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`Delete bucket failed: ${response.status}`);
  }

  async headBucket(bucket: string): Promise<boolean> {
    const url = this.getBucketUrl(bucket) + '/';
    const headers = await this.signer.sign('HEAD', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'HEAD', headers });
    return response.ok;
  }

  // -- Object Operations ---------------------------------------------------

  async uploadObject(params: S3UploadParams): Promise<{ Location: string; ETag: string }> {
    const bucket = params.bucket || this.config.bucket;
    if (!bucket) throw new Error('Bucket required');
    const url = `${this.getBucketUrl(bucket)}/${params.key}`;
    const bodyStr = params.body instanceof Buffer ? params.body.toString('base64') : typeof params.body === 'string' ? params.body : await params.body.text();

    const extraHeaders: Record<string, string> = {};
    if (params.contentType) extraHeaders['x-amz-acl'] = params.acl || 'private';
    if (params.contentType) extraHeaders['Content-Type'] = params.contentType;
    if (params.cacheControl) extraHeaders['Cache-Control'] = params.cacheControl;
    if (params.contentDisposition) extraHeaders['Content-Disposition'] = params.contentDisposition;
    if (params.serverSideEncryption) extraHeaders['x-amz-server-side-encryption'] = params.serverSideEncryption;

    const headers = await this.signer.sign('PUT', url, {
      Host: new URL(url).hostname,
      ...extraHeaders,
    }, bodyStr);

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: params.body instanceof Buffer ? params.body : bodyStr,
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.status}: ${await response.text()}`);
    return {
      Location: url,
      ETag: response.headers.get('etag') || '',
    };
  }

  async downloadObject(bucket: string, key: string): Promise<ArrayBuffer> {
    const url = `${this.getBucketUrl(bucket)}/${key}`;
    const headers = await this.signer.sign('GET', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return response.arrayBuffer();
  }

  async downloadObjectAsString(bucket: string, key: string): Promise<string> {
    const buffer = await this.downloadObject(bucket, key);
    return new TextDecoder().decode(buffer);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const url = `${this.getBucketUrl(bucket)}/${key}`;
    const headers = await this.signer.sign('DELETE', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
  }

  async deleteMultipleObjects(bucket: string, keys: string[]): Promise<void> {
    const url = this.getBucketUrl(bucket) + '/';
    const body = `<?xml version="1.0" encoding="UTF-8"?><Delete>${keys.map(k => `<Object><Key>${k}</Key></Object>`).join('')}</Delete>`;
    const headers = await this.signer.sign('POST', url, {
      Host: new URL(url).hostname,
      'Content-Type': 'application/xml',
    }, body);

    const response = await fetch(`${url}?delete`, { method: 'POST', headers, body });
    if (!response.ok) throw new Error(`Batch delete failed: ${response.status}`);
  }

  async headObject(bucket: string, key: string): Promise<Record<string, string>> {
    const url = `${this.getBucketUrl(bucket)}/${key}`;
    const headers = await this.signer.sign('HEAD', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'HEAD', headers });
    if (!response.ok) throw new Error(`Head object failed: ${response.status}`);
    const result: Record<string, string> = {};
    response.headers.forEach((value, key) => { result[key] = value; });
    return result;
  }

  async copyObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): Promise<void> {
    const url = `${this.getBucketUrl(destBucket)}/${destKey}`;
    const headers = await this.signer.sign('PUT', url, {
      Host: new URL(url).hostname,
      'x-amz-copy-source': `/${sourceBucket}/${sourceKey}`,
    }, '');
    const response = await fetch(url, { method: 'PUT', headers });
    if (!response.ok) throw new Error(`Copy failed: ${response.status}`);
  }

  async listObjects(bucket: string, prefix?: string, delimiter?: string, maxKeys?: number): Promise<S3ListResponse> {
    const url = new URL(this.getBucketUrl(bucket) + '/');
    if (prefix) url.searchParams.set('prefix', prefix);
    if (delimiter) url.searchParams.set('delimiter', delimiter);
    if (maxKeys) url.searchParams.set('max-keys', String(maxKeys));

    const headers = await this.signer.sign('GET', url.toString(), { Host: url.hostname }, '');
    const response = await fetch(url.toString(), { method: 'GET', headers });
    if (!response.ok) throw new Error(`List objects failed: ${response.status}`);
    const text = await response.text();
    return this.parseListObjectsXml(text);
  }

  async listAllObjects(bucket: string, prefix?: string): Promise<S3Object[]> {
    const allObjects: S3Object[] = [];
    let continuationToken: string | undefined;
    do {
      const url = new URL(this.getBucketUrl(bucket) + '/');
      if (prefix) url.searchParams.set('prefix', prefix);
      url.searchParams.set('list-type', '2');
      if (continuationToken) url.searchParams.set('continuation-token', continuationToken);
      const headers = await this.signer.sign('GET', url.toString(), { Host: url.hostname }, '');
      const response = await fetch(url.toString(), { method: 'GET', headers });
      if (!response.ok) throw new Error(`List objects failed: ${response.status}`);
      const text = await response.text();
      const result = this.parseListObjectsV2Xml(text);
      allObjects.push(...result.Contents);
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);
    return allObjects;
  }

  // -- Presigned URLs ------------------------------------------------------

  getPresignedGetUrl(params: S3PresignedUrlParams): string {
    const bucket = params.bucket || this.config.bucket;
    if (!bucket) throw new Error('Bucket required');
    return this.getSignedUrl(bucket, params.key, 'GET', params.expiresIn || 3600);
  }

  getPresignedPutUrl(params: S3PresignedUrlParams): string {
    const bucket = params.bucket || this.config.bucket;
    if (!bucket) throw new Error('Bucket required');
    return this.getSignedUrl(bucket, params.key, 'PUT', params.expiresIn || 3600, params.contentType);
  }

  // -- CORS ----------------------------------------------------------------

  async getCORS(bucket: string): Promise<{ CORSRules: S3CORSRule[] }> {
    const url = `${this.getBucketUrl(bucket)}/?cors`;
    const headers = await this.signer.sign('GET', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Get CORS failed: ${response.status}`);
    const text = await response.text();
    return this.parseXml(text) as any;
  }

  async putCORS(bucket: string, rules: S3CORSRule[]): Promise<void> {
    const url = `${this.getBucketUrl(bucket)}/?cors`;
    const body = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration>${rules.map(r => `<CORSRule>${r.AllowedOrigins.map(o => `<AllowedOrigin>${o}</AllowedOrigin>`).join('')}${r.AllowedMethods.map(m => `<AllowedMethod>${m}</AllowedMethod>`).join('')}${r.AllowedHeaders.map(h => `<AllowedHeader>${h}</AllowedHeader>`).join('')}${r.ExposeHeaders?.map(e => `<ExposeHeader>${e}</ExposeHeader>`).join('') || ''}${r.MaxAgeSeconds ? `<MaxAgeSeconds>${r.MaxAgeSeconds}</MaxAgeSeconds>` : ''}</CORSRule>`).join('')}</CORSConfiguration>`;
    const headers = await this.signer.sign('PUT', url, { Host: new URL(url).hostname, 'Content-Type': 'application/xml' }, body);
    const response = await fetch(url, { method: 'PUT', headers, body });
    if (!response.ok) throw new Error(`Put CORS failed: ${response.status}`);
  }

  async deleteCORS(bucket: string): Promise<void> {
    const url = `${this.getBucketUrl(bucket)}/?cors`;
    const headers = await this.signer.sign('DELETE', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`Delete CORS failed: ${response.status}`);
  }

  // -- Tagging -------------------------------------------------------------

  async getObjectTagging(bucket: string, key: string): Promise<S3Tagging> {
    const url = `${this.getBucketUrl(bucket)}/${key}?tagging`;
    const headers = await this.signer.sign('GET', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Get tagging failed: ${response.status}`);
    const text = await response.text();
    return this.parseXml(text) as any;
  }

  async putObjectTagging(bucket: string, key: string, tags: { Key: string; Value: string }[]): Promise<void> {
    const url = `${this.getBucketUrl(bucket)}/${key}?tagging`;
    const body = `<?xml version="1.0" encoding="UTF-8"?><Tagging><TagSet>${tags.map(t => `<Tag><Key>${t.Key}</Key><Value>${t.Value}</Value></Tag>`).join('')}</TagSet></Tagging>`;
    const headers = await this.signer.sign('PUT', url, { Host: new URL(url).hostname, 'Content-Type': 'application/xml' }, body);
    const response = await fetch(url, { method: 'PUT', headers, body });
    if (!response.ok) throw new Error(`Put tagging failed: ${response.status}`);
  }

  async deleteObjectTagging(bucket: string, key: string): Promise<void> {
    const url = `${this.getBucketUrl(bucket)}/${key}?tagging`;
    const headers = await this.signer.sign('DELETE', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`Delete tagging failed: ${response.status}`);
  }

  // -- Policy --------------------------------------------------------------

  async getBucketPolicy(bucket: string): Promise<S3Policy> {
    const url = `${this.getBucketUrl(bucket)}/?policy`;
    const headers = await this.signer.sign('GET', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Get policy failed: ${response.status}`);
    return response.json() as Promise<S3Policy>;
  }

  async putBucketPolicy(bucket: string, policy: S3Policy): Promise<void> {
    const url = `${this.getBucketUrl(bucket)}/?policy`;
    const body = JSON.stringify(policy);
    const headers = await this.signer.sign('PUT', url, { Host: new URL(url).hostname, 'Content-Type': 'application/json' }, body);
    const response = await fetch(url, { method: 'PUT', headers, body });
    if (!response.ok) throw new Error(`Put policy failed: ${response.status}`);
  }

  async deleteBucketPolicy(bucket: string): Promise<void> {
    const url = `${this.getBucketUrl(bucket)}/?policy`;
    const headers = await this.signer.sign('DELETE', url, { Host: new URL(url).hostname }, '');
    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`Delete policy failed: ${response.status}`);
  }

  // -- Helpers -------------------------------------------------------------

  private parseXml(text: string): unknown {
    // Simplified XML parsing - in production use a proper XML parser
    return text;
  }

  private parseListObjectsXml(text: string): S3ListResponse {
    return {
      Contents: [],
      IsTruncated: false,
      Name: '',
      Prefix: '',
      MaxKeys: 1000,
    };
  }

  private parseListObjectsV2Xml(text: string): { Contents: S3Object[]; NextContinuationToken?: string } {
    return { Contents: [] };
  }
}
