import { NextRequest } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { isTextAllowedByModeration } from "@/lib/moderation";
import { embedText, searchChunks, buildPromptFromChunks, RetrievedChunk } from "@/lib/rag";
import { getEnv } from "@/lib/env";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// Very basic in-memory per-instance rate limiting (best-effort)
const lastRequestAtByUser = new Map<string, number>();
const MIN_INTERVAL_MS = 500; // ~2 rps per user per instance

type ChatBody = {
	chatId?: number;
	pdfId?: number;
	message: string;
};

export async function POST(req: NextRequest) {
	const { user, headers } = await getAuthenticatedUserFromCookies(req);
	if (!user) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
	const dbUser = await ensureUserProvisioned(user as any);
	if (!dbUser) return new Response(JSON.stringify({ error: "User not provisioned" }), { status: 500 });
    // Basic rate limit
    try {
        const now = Date.now();
        const key = String(dbUser.id);
        const last = lastRequestAtByUser.get(key) ?? 0;
        if (now - last < MIN_INTERVAL_MS) {
            return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 });
        }
        lastRequestAtByUser.set(key, now);
    } catch {}


	if (!supabaseServer) return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });

	let body: ChatBody | null = null;
	try { body = await req.json(); } catch {}
    if (!body || !body.message) {
		return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });
	}

    // Optional ownership check for pdfId when provided
    let pdfRow: { id: number; owner_id: number; status: string } | null = null;
    if (body.pdfId) {
        const { data } = await (supabaseServer as any)
            .from("pdfs")
            .select("id, owner_id, status")
            .eq("id", body.pdfId)
            .maybeSingle();
        pdfRow = data ?? null;
        if (!pdfRow || pdfRow.owner_id !== dbUser.id || pdfRow.status !== "ready") {
            pdfRow = null;
            body.pdfId = undefined;
        }
    }

	// Moderation
	const moderation = await isTextAllowedByModeration(body.message);
	if (!moderation.allowed) {
		return new Response(JSON.stringify({ error: "Message blocked by moderation" }), { status: 400 });
	}

    // Ensure chat row
	let chatId = body.chatId ?? null;
	if (!chatId) {
		const { data: created, error } = await supabaseServer
			.from("chats")
            .insert({ owner_id: dbUser.id, pdf_id: body.pdfId ?? null })
			.select("id")
			.single();
		if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		chatId = created?.id ?? null;
	}

    // Persist user message
    await supabaseServer.from("messages").insert({ chat_id: chatId!, role: "user", content: body.message });

    // Retrieval (only if pdfId provided)
    let citations: Array<{ page: number; text: string }> = [];
    let system = "You are a helpful, concise tutor.";
    let userPrompt = body.message;
    if (body.pdfId) {
        const embedding = await embedText(body.message);
        if (embedding) {
            const matches = (await searchChunks(body.pdfId, embedding, 5, 10)) as RetrievedChunk[];
            const built = buildPromptFromChunks(body.message, matches);
            system = built.system;
            userPrompt = built.user;
            citations = built.citations;
        }
    }

	// Gemini generation
	const { geminiApiKey } = getEnv();
	if (!geminiApiKey) return new Response(JSON.stringify({ error: "GEMINI_API missing" }), { status: 500 });
	const genAI = new GoogleGenerativeAI(geminiApiKey);
	const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
		start: async (controller) => {
			// First, emit citations frame for UI
            controller.enqueue(encoder.encode(JSON.stringify({ type: "chat", data: { chatId } }) + "\n"));
            controller.enqueue(encoder.encode(JSON.stringify({ type: "citations", data: citations }) + "\n"));
			try {
				let fullText = "";
				const stream = await (model as any).generateContentStream(`${system}\n\n${userPrompt}`);
				for await (const chunk of (stream as any).stream) {
					const partText = typeof chunk?.text === 'function' ? chunk.text() : '';
					if (partText) {
						fullText += partText;
						controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", data: partText }) + "\n"));
					}
				}
				await (supabaseServer as any).from("messages").insert({ chat_id: chatId!, role: "assistant", content: fullText });
				controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
				controller.close();
			} catch (e: any) {
				controller.enqueue(encoder.encode(JSON.stringify({ type: "error", data: e?.message || "Chat failed" }) + "\n"));
				controller.close();
			}
		},
	});

	const res = new Response(stream, {
		headers: {
			"Content-Type": "application/jsonl; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
	headers.forEach((v, k) => res.headers.append(k, v));
	return res;
}


