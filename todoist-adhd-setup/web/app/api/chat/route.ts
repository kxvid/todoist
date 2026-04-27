import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runChat } from "@/lib/agent";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { readProviderFromHeaders } from "@/lib/providers";
import type { ChatRequest, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function sse(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }

  let provider;
  try {
    provider = readProviderFromHeaders(req.headers);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad provider config" },
      { status: 400 },
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runChat(provider, body.messages)) {
          controller.enqueue(encoder.encode(sse(event)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(sse({ type: "error", message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
