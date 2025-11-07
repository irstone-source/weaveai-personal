import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getModelProvider } from '$lib/ai/index.js';
import type { AIResponse, AIStreamChunk, AIMessage } from '$lib/ai/types.js';
import { AVAILABLE_TOOLS } from '$lib/ai/tools/index.js';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Session is optional for text chat; used when present for attribution/storage
    const session = await locals.auth?.();

    const body = await request.json();
    const {
      model,
      messages,
      maxTokens = 2000,
      temperature = 0.7,
      stream = false,
      chatId,
      selectedTool,
      multimodal = false,
    } = body as {
      model: string;
      messages: AIMessage[];
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
      chatId?: string | null;
      selectedTool?: string | undefined;
      multimodal?: boolean;
    };

    if (!model) {
      return json({ error: 'Model is required' }, { status: 400 });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'Messages array is required and cannot be empty' }, { status: 400 });
    }

    const provider = getModelProvider(model);
    if (!provider) {
      return json({ error: `No provider found for model: ${model}` }, { status: 400 });
    }

    // Multimodal non-streaming path
    if (multimodal) {
      if (!provider.chatMultimodal) {
        return json({ error: `Model ${model} does not support multimodal chat` }, { status: 400 });
      }
      const resp = await provider.chatMultimodal({
        model,
        messages,
        maxTokens,
        temperature,
        userId: session?.user?.id,
        chatId: chatId ?? undefined,
        tools: selectedTool && AVAILABLE_TOOLS[selectedTool]
          ? [AVAILABLE_TOOLS[selectedTool]]
          : undefined,
      });
      return json(resp);
    }

    // Text chat path (streaming or non-streaming)
    const tools = selectedTool && AVAILABLE_TOOLS[selectedTool]
      ? [AVAILABLE_TOOLS[selectedTool]]
      : undefined;

    const result = await provider.chat({
      model,
      messages,
      maxTokens,
      temperature,
      stream, // provider may still return non-stream if tools force tool-calling
      userId: session?.user?.id,
      chatId: chatId ?? undefined,
      tools,
    });

    // If streaming requested and provider returned an async iterator, stream as SSE
    if (stream && Symbol.asyncIterator in (result as any)) {
      const encoder = new TextEncoder();
      const iterator = result as AsyncIterableIterator<AIStreamChunk>;

      const streamBody = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of iterator) {
              const payload = JSON.stringify({ content: chunk.content });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
            // Signal completion
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Streaming error';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(streamBody, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          // Disable proxy buffering where applicable (Nginx etc.)
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Fallback: non-streaming JSON response
    return json(result as AIResponse);
  } catch (error) {
    console.error('Chat API error:', error);
    // Improve common failure messages for OpenRouter
    const message = error instanceof Error ? error.message : 'Internal server error';
    let status = 500;
    if (/unauthorized|invalid api key/i.test(message)) status = 401;
    if (/insufficient credits|payment required|402/i.test(message)) status = 402;
    if (/rate limit|429/i.test(message)) status = 429;
    if (/service unavailable|503/i.test(message)) status = 503;
    return json({ error: message }, { status });
  }
};
