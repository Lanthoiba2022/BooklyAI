import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { generateQuizFromPDF, QuizConfig } from "@/lib/quiz";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type GenerateQuizBody = {
  pdfId: number;
  config: QuizConfig;
};

export async function POST(req: NextRequest) {
  const { user } = await getAuthenticatedUserFromCookies(req);
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

  try {
    const body: GenerateQuizBody = await req.json();
    const { pdfId, config } = body;

    if (!pdfId || !config) {
      return NextResponse.json({ error: "Missing pdfId or config" }, { status: 400 });
    }

    // Validate config
    if (config.mcq < 0 || config.saq < 0 || config.laq < 0) {
      return NextResponse.json({ error: "Invalid question counts" }, { status: 400 });
    }

    if (config.mcq + config.saq + config.laq === 0) {
      return NextResponse.json({ error: "At least one question type required" }, { status: 400 });
    }

    // Check PDF ownership
    const { data: pdf } = await supabaseServer
      .from("pdfs")
      .select("id, owner_id, status")
      .eq("id", pdfId)
      .eq("owner_id", dbUser.id)
      .eq("status", "ready")
      .single();

    if (!pdf) {
      return NextResponse.json({ error: "PDF not found or not ready" }, { status: 404 });
    }

    // Generate quiz
    const result = await generateQuizFromPDF(pdfId, config);

    // Update the quiz with correct owner_id
    await supabaseServer
      .from("quizzes")
      .update({ owner_id: dbUser.id })
      .eq("id", result.quizId);

    return NextResponse.json({
      quizId: result.quizId,
      questions: result.questions
    });

  } catch (error: any) {
    console.error("Quiz generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
