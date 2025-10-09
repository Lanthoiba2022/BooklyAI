import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get quiz attempts with quiz and PDF details
    const { data: attempts, error } = await supabaseServer
      .from("quiz_attempts")
      .select(`
        id,
        score,
        details,
        created_at,
        quiz:quizzes(
          id,
          config,
          pdf:pdfs(
            id,
            name
          )
        )
      `)
      .eq("owner_id", dbUser.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching quiz history:", error);
      return NextResponse.json({ error: "Failed to fetch quiz history" }, { status: 500 });
    }

    // Transform the data for the frontend
    const quizHistory = attempts?.map(attempt => {
      const quiz = attempt.quiz;
      const config = quiz?.config || {};
      const questions = config.questions || [];
      const totalQuestions = questions.length;
      const percentage = totalQuestions > 0 ? Math.round((attempt.score / totalQuestions) * 100) : 0;
      
      return {
        id: attempt.id,
        quizId: quiz?.id,
        pdfId: quiz?.pdf?.id,
        pdfName: quiz?.pdf?.name || "Unknown PDF",
        score: attempt.score,
        totalQuestions,
        percentage,
        timeTaken: attempt.details?.timeTaken || 0,
        createdAt: attempt.created_at,
        questionTypes: {
          mcq: questions.filter((q: any) => q.type === 'mcq').length,
          saq: questions.filter((q: any) => q.type === 'saq').length,
          laq: questions.filter((q: any) => q.type === 'laq').length
        },
        answers: attempt.details?.answers || {},
        questionScores: attempt.details?.questionScores || [],
        detailedFeedback: attempt.details?.detailedFeedback || []
      };
    }) || [];

    return NextResponse.json({
      quizHistory,
      total: quizHistory.length,
      hasMore: quizHistory.length === limit
    });

  } catch (error: any) {
    console.error("Quiz history error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch quiz history" },
      { status: 500 }
    );
  }
}
