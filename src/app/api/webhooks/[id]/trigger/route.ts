import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: params.id },
      include: {
        org: { select: { id: true } },
      },
    });

    if (!webhook) return errorResponse('Webhook not found', 404);
    if (!webhook.isActive) return errorResponse('Webhook is disabled', 400);

    const body = await req.json();
    const { event, payload } = body;

    if (!event) return errorResponse('event is required', 400);

    if (!webhook.events.includes(event) && !webhook.events.includes('*')) {
      return errorResponse(`Webhook does not listen for event: ${event}`, 400);
    }

    // Verify signature if secret is set
    const signature = req.headers.get('x-webhook-signature');
    if (webhook.secret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(body))
        .digest('hex');

      if (signature !== `sha256=${expectedSignature}`) {
        return errorResponse('Invalid webhook signature', 401);
      }
    }

    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: params.id,
        event,
        payload,
        status: 'PENDING',
      },
    });

    // Simulate delivery (in production, this would be a background job)
    if (webhook.url) {
      try {
        const startTime = Date.now();
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Delivery-Id': delivery.id,
            ...(webhook.secret
              ? {
                  'X-Webhook-Signature': `sha256=${crypto
                    .createHmac('sha256', webhook.secret)
                    .update(JSON.stringify(body))
                    .digest('hex')}`,
                }
              : {}),
          },
          body: JSON.stringify({ event, payload, deliveryId: delivery.id }),
          signal: AbortSignal.timeout(10000),
        });

        const responseData = await response.json().catch(() => null);
        const latency = Date.now() - startTime;

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: response.ok ? 'SUCCESS' : 'FAILED',
            response: {
              status: response.status,
              latency,
              body: responseData,
            },
            attempts: 1,
          },
        });

        return successResponse({
          deliveryId: delivery.id,
          status: response.ok ? 'delivered' : 'failed',
          statusCode: response.status,
          latency,
        });
      } catch (fetchError) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'FAILED',
            error: fetchError instanceof Error ? fetchError.message : 'Delivery failed',
            attempts: 1,
            nextRetry: new Date(Date.now() + 60000), // Retry in 1 minute
          },
        });

        return successResponse({
          deliveryId: delivery.id,
          status: 'queued_for_retry',
        });
      }
    }

    return successResponse({
      deliveryId: delivery.id,
      status: 'queued',
      message: 'Webhook received, delivery queued',
    });
  } catch (error) {
    console.error('Webhook trigger error:', error);
    return errorResponse('Webhook processing failed', 500);
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const webhook = await prisma.webhook.findUnique({ where: { id: params.id } });
    if (!webhook) return errorResponse('Webhook not found', 404);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return successResponse(deliveries);
  } catch (error) {
    return errorResponse('Failed to fetch deliveries', 500);
  }
}
