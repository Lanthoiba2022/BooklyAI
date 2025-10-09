import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  console.log("[API] /api/chats GET: start");
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const dbUser = await ensureUserProvisioned(user as any);
  if (!dbUser) {
    return NextResponse.json({ error: "User not provisioned" }, { status: 500 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ chats: [] });
  }

  try {
    // Get chats with last message snippet
    const { data: chats, error } = await supabaseServer
      .from("chats")
      .select(`
        id,
        created_at,
        pdf_id,
        pdfs!left(name)
      `)
      .eq("owner_id", dbUser.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[API] /api/chats GET: error", error.message);
      return NextResponse.json({ chats: [] });
    }

    // Get last message for each chat
    const chatIds = (chats ?? []).map(c => c.id);
    let lastMessages: Record<number, string> = {};
    
    if (chatIds.length > 0) {
      const { data: messages } = await supabaseServer
        .from("messages")
        .select("chat_id, content, created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false });

      // Group by chat_id and get the most recent message
      (messages ?? []).forEach(msg => {
        if (!lastMessages[msg.chat_id]) {
          lastMessages[msg.chat_id] = msg.content.slice(0, 100) + (msg.content.length > 100 ? "..." : "");
        }
      });
    }

    const formattedChats = (chats ?? []).map(chat => {
      const pdfsField: any = (chat as any).pdfs;
      const pdfName = Array.isArray(pdfsField) ? (pdfsField[0]?.name ?? null) : (pdfsField?.name ?? null);
      return {
        id: chat.id,
        createdAt: chat.created_at,
        pdfName,
        lastMessage: lastMessages[chat.id] ?? null,
      };
    });

    console.log("[API] /api/chats GET: found", formattedChats.length, "chats");
    const res = NextResponse.json({ chats: formattedChats });
    headers.forEach((v, k) => res.headers.append(k, v));
    return res;
  } catch (e: any) {
    console.error("[API] /api/chats GET: error", e?.message || e);
    return NextResponse.json({ chats: [] });
  }
}

export async function DELETE(req: NextRequest) {
  console.log("[API] /api/chats DELETE: start");
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const dbUser = await ensureUserProvisioned(user as any);
  if (!dbUser) {
    return NextResponse.json({ error: "User not provisioned" }, { status: 500 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");
  if (!chatId || isNaN(Number(chatId))) {
    return NextResponse.json({ error: "Missing or invalid chatId" }, { status: 400 });
  }

  try {
    // Verify ownership
    const { data: chat, error: chatError } = await supabaseServer
      .from("chats")
      .select("id, owner_id")
      .eq("id", chatId)
      .single();
    if (chatError || !chat || chat.owner_id !== dbUser.id) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Delete (messages cascade via FK)
    const { error: delError } = await supabaseServer
      .from("chats")
      .delete()
      .eq("id", chatId);
    if (delError) {
      console.error("[API] /api/chats DELETE: error", delError.message);
      return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });
    headers.forEach((v, k) => res.headers.append(k, v));
    return res;
  } catch (e: any) {
    console.error("[API] /api/chats DELETE: error", e?.message || e);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
