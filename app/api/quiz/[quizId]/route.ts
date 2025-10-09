import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ quizId: string }> }
) {
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
    const { quizId: quizIdParam } = await ctx.params;
    const quizId = parseInt(quizIdParam);
    if (isNaN(quizId)) {
      return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 });
    }

    // Get quiz details
    const { data: quiz } = await supabaseServer
      .from("quizzes")
      .select(`
        id,
        pdf_id,
        config,
        created_at,
        pdf:pdfs(name)
      `)
      .eq("id", quizId)
      .eq("owner_id", dbUser.id)
      .single();

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Remove correct answers from questions for security
    const questions = (quiz.config.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      page: q.page,
      lineStart: q.lineStart,
      lineEnd: q.lineEnd,
      topic: q.topic
    }));

    const pdfName = (quiz as any).pdf?.name as string | undefined;

    return NextResponse.json({
      id: quiz.id,
      pdfId: quiz.pdf_id,
      pdfName,
      config: {
        mcq: quiz.config.mcq,
        saq: quiz.config.saq,
        laq: quiz.config.laq,
        difficulty: quiz.config.difficulty
      },
      questions,
      createdAt: quiz.created_at
    });

  } catch (error: any) {
    console.error("Quiz fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}
