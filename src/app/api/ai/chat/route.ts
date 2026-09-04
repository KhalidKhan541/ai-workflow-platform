import { NextRequest } from 'next/server';
import { validateBody, errorResponse } from '@/lib/api-utils';
import { chatSchema } from '@/lib/validations';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const validation = validateBody(chatSchema, body);
    if (!validation.success) return validation.response;

    const { messages, model, temperature, maxTokens, stream } = validation.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return errorResponse('AI service not configured', 503);
    }

    const requestBody = {
      model: model || 'gpt-4',
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      stream,
    };

    if (stream) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        return errorResponse(error.error?.message || 'AI request failed', response.status);
      }

      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      return errorResponse(error.error?.message || 'AI request failed', response.status);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: data.id,
          model: data.model,
          content: data.choices[0]?.message?.content,
          finishReason: data.choices[0]?.finish_reason,
          usage: data.usage,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
