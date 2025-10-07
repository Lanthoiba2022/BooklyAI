import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAuthenticatedUserFromSession } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Get authenticated user
  const user = await getAuthenticatedUserFromSession(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ files: [] });
  }
  try {
    // list files from user-specific folder
    const userFolder = `users/${user.id}`;
    
    // Double-check that we're only accessing the user's folder
    if (!userFolder.startsWith(`users/${user.id}`)) {
      throw new Error("Invalid user folder access");
    }
    
    const { data, error } = await supabaseServer.storage.from("pdfs").list(userFolder, { limit: 100, offset: 0, sortBy: { column: "name", order: "desc" } });
    if (error) throw error;
    const files = await Promise.all(
      (data ?? []).map(async (f) => {
        const path = `${userFolder}/${f.name}`;
        const { data: urlData } = await supabaseServer.storage.from("pdfs").createSignedUrl(path, 60 * 60);
        return {
          id: path,
          name: f.name.replace(/^\d+_/, ""),
          path,
          url: urlData?.signedUrl,
        };
      })
    );
    return NextResponse.json({ files });
  } catch (e) {
    console.error("Error listing user files:", e);
    return NextResponse.json({ files: [] });
  }
}


