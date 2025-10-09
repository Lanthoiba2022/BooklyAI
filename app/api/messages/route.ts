import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  console.log("[API] /api/messages GET: start");
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const dbUser = await ensureUserProvisioned(user as any);
  if (!dbUser) {
    return NextResponse.json({ error: "User not provisioned" }, { status: 500 });
  }

  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");
  
  if (!chatId || isNaN(Number(chatId))) {
    return NextResponse.json({ error: "Missing or invalid chatId" }, { status: 400 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ messages: [] });
  }

  try {
    // Verify chat ownership
    const { data: chat, error: chatError } = await supabaseServer
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("owner_id", dbUser.id)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get messages for this chat
    const { data: messages, error } = await supabaseServer
      .from("messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[API] /api/messages GET: error", error.message);
      return NextResponse.json({ messages: [] });
    }

    const formattedMessages = (messages ?? []).map(msg => ({
      id: msg.id.toString(),
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      createdAt: new Date(msg.created_at).getTime(),
      // No citations persisted in DB; keep field undefined for UI compatibility
      citations: undefined,
    }));

    console.log("[API] /api/messages GET: found", formattedMessages.length, "messages for chat", chatId);
    const res = NextResponse.json({ messages: formattedMessages });
    headers.forEach((v, k) => res.headers.append(k, v));
    return res;
  } catch (e: any) {
    console.error("[API] /api/messages GET: error", e?.message || e);
    return NextResponse.json({ messages: [] });
  }
}
