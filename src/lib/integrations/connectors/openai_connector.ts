import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | null;
  name?: string;
  function_call?: { name: string; arguments: string };
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ChatCompletionStream {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ImageGeneration {
  created: number;
  data: { url?: string; b64_json?: string; revised_prompt?: string }[];
}

export interface Embedding {
  object: 'embedding';
  embedding: number[];
  index: number;
}

export interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface FineTuneJob {
  id: string;
  object: 'fine_tuning.job';
  created_at: number;
  finished_at?: number;
  model: string;
  trained_tokens?: number;
  result_files: string[];
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  validation_file?: string;
  training_file: string;
  hyperparameters: { n_epochs: number | string };
  error?: { code: string; message: string; param: string | null };
  trained_tokens?: number;
}

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ModerationResult {
  id: string;
  model: string;
  results: {
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }[];
}

export interface AudioTranscription {
  text: string;
  language?: string;
  duration?: number;
  words?: { word: string; start: number; end: number }[];
}

export interface FileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status?: string;
  status_details?: string;
}

// ---------------------------------------------------------------------------
// OpenAI Integration
// ---------------------------------------------------------------------------

export class OpenAIIntegration extends BaseIntegration {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    super(config.baseUrl || 'https://api.openai.com/v1', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 60, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
    if (this.config.organization) headers['OpenAI-Organization'] = this.config.organization;
    if (this.config.project) headers['OpenAI-Project'] = this.config.project;
    return headers;
  }

  getCapabilities(): string[] {
    return [
      'chat.completions',
      'chat.completions.stream',
      'images.generate',
      'images.edit',
      'embeddings',
      'fine_tuning.create',
      'fine_tuning.read',
      'fine_tuning.cancel',
      'models.list',
      'models.read',
      'files.upload',
      'files.read',
      'files.delete',
      'moderations.create',
      'audio.transcribe',
      'audio.translate',
      'audio.speech',
    ];
  }

  // -- Chat Completions ----------------------------------------------------

  async chatCompletion(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: Record<string, number>;
    user?: string;
    tools?: { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[];
    tool_choice?: string | { type: string; function: { name: string } };
    response_format?: { type: string };
    seed?: number;
  }): Promise<ChatCompletion> {
    return this.post('/chat/completions', params);
  }

  async chatCompletionStream(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    tools?: { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[];
  }): Promise<ReadableStream<ChatCompletionStream>> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...(this.config.organization ? { 'OpenAI-Organization': this.config.organization } : {}),
      },
      body: JSON.stringify({ ...params, stream: true }),
    });
    if (!response.ok) throw new Error(`Stream failed: ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') { controller.close(); return; }
          try {
            controller.enqueue(JSON.parse(data) as ChatCompletionStream);
          } catch { /* skip malformed */ }
        }
      },
    });
  }

  // -- Image Generation ----------------------------------------------------

  async generateImage(params: {
    prompt: string;
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    model?: 'dall-e-2' | 'dall-e-3';
    response_format?: 'url' | 'b64_json';
    style?: 'vivid' | 'natural';
    user?: string;
  }): Promise<ImageGeneration> {
    return this.post('/images/generations', params);
  }

  async editImage(params: {
    image: File | Blob;
    prompt: string;
    mask?: File | Blob;
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024';
    response_format?: 'url' | 'b64_json';
    user?: string;
  }): Promise<ImageGeneration> {
    const formData = new FormData();
    formData.append('image', params.image);
    formData.append('prompt', params.prompt);
    if (params.mask) formData.append('mask', params.mask);
    if (params.n) formData.append('n', String(params.n));
    if (params.size) formData.append('size', params.size);
    if (params.response_format) formData.append('response_format', params.response_format);

    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    const response = await fetch(`${this.baseUrl}/images/edits`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(`Image edit failed: ${response.status}`);
    return response.json() as Promise<ImageGeneration>;
  }

  async createVariation(params: {
    image: File | Blob;
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024';
    response_format?: 'url' | 'b64_json';
    user?: string;
  }): Promise<ImageGeneration> {
    const formData = new FormData();
    formData.append('image', params.image);
    if (params.n) formData.append('n', String(params.n));
    if (params.size) formData.append('size', params.size);
    if (params.response_format) formData.append('response_format', params.response_format);

    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    const response = await fetch(`${this.baseUrl}/images/variations`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(`Image variation failed: ${response.status}`);
    return response.json() as Promise<ImageGeneration>;
  }

  // -- Embeddings ----------------------------------------------------------

  async createEmbedding(params: {
    input: string | string[];
    model: string;
    encoding_format?: 'float' | 'base64';
    dimensions?: number;
    user?: string;
  }): Promise<EmbeddingResponse> {
    return this.post('/embeddings', params);
  }

  // -- Fine-tuning ---------------------------------------------------------

  async createFineTune(params: {
    training_file: string;
    validation_file?: string;
    model?: string;
    n_epochs?: number | string;
    batch_size?: number | string;
    learning_rate_multiplier?: number | string;
    prompt_loss_weight?: number;
    seed?: number;
    suffix?: string;
  }): Promise<FineTuneJob> {
    return this.post('/fine_tuning/jobs', params);
  }

  async getFineTuneJob(jobId: string): Promise<FineTuneJob> {
    return this.get(`/fine_tuning/jobs/${jobId}`);
  }

  async listFineTuneJobs(options?: { limit?: number; after?: string }): Promise<{ object: 'list'; data: FineTuneJob[]; has_more: boolean }> {
    return this.get('/fine_tuning/jobs', options || {});
  }

  async cancelFineTuneJob(jobId: string): Promise<FineTuneJob> {
    return this.post(`/fine_tuning/jobs/${jobId}/cancel`);
  }

  async listFineTuneEvents(jobId: string, options?: { limit?: number; after?: string }): Promise<{ object: 'list'; data: { id: string; object: string; created_at: number; level: string; message: string }[] }> {
    return this.get(`/fine_tuning/jobs/${jobId}/events`, options || {});
  }

  async deleteFineTuneModel(modelId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.delete(`/models/${modelId}`);
  }

  // -- Models --------------------------------------------------------------

  async listModels(): Promise<{ object: 'list'; data: ModelInfo[] }> {
    return this.get('/models');
  }

  async getModel(modelId: string): Promise<ModelInfo> {
    return this.get(`/models/${modelId}`);
  }

  async deleteModel(modelId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.delete(`/models/${modelId}`);
  }

  // -- Files ---------------------------------------------------------------

  async uploadFile(file: File | Blob, purpose: string): Promise<FileObject> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(`File upload failed: ${response.status}`);
    return response.json() as Promise<FileObject>;
  }

  async getFile(fileId: string): Promise<FileObject> {
    return this.get(`/files/${fileId}`);
  }

  async listFiles(purpose?: string): Promise<{ object: 'list'; data: FileObject[] }> {
    const params: Record<string, string> = {};
    if (purpose) params.purpose = purpose;
    return this.get('/files', params);
  }

  async deleteFile(fileId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.delete(`/files/${fileId}`);
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/files/${fileId}/content`, { headers });
    if (!response.ok) throw new Error(`File download failed: ${response.status}`);
    return response.blob();
  }

  // -- Moderation ----------------------------------------------------------

  async createModeration(input: string, model?: string): Promise<ModerationResult> {
    return this.post('/moderations', { input, model: model || 'text-moderation-latest' });
  }

  // -- Audio ---------------------------------------------------------------

  async transcribeAudio(file: File | Blob, model: string = 'whisper-1', options?: {
    language?: string;
    prompt?: string;
    response_format?: 'json' | 'text' | 'verbose_json' | 'vtt' | 'srt';
    temperature?: number;
  }): Promise<AudioTranscription> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);
    if (options?.language) formData.append('language', options.language);
    if (options?.prompt) formData.append('prompt', options.prompt);
    if (options?.response_format) formData.append('response_format', options.response_format);
    if (options?.temperature) formData.append('temperature', String(options.temperature));

    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);
    return response.json() as Promise<AudioTranscription>;
  }

  async translateAudio(file: File | Blob, model: string = 'whisper-1'): Promise<AudioTranscription> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);

    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    const response = await fetch(`${this.baseUrl}/audio/translations`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
    return response.json() as Promise<AudioTranscription>;
  }

  async textToSpeech(params: {
    input: string;
    model?: string;
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    response_format?: 'mp3' | 'opus' | 'aac' | 'flac';
    speed?: number;
  }): Promise<Blob> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', voice: 'alloy', ...params }),
    });
    if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
    return response.blob();
  }
}
