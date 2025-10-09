import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
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
    const { attemptId: attemptIdParam } = await params;
    const attemptId = parseInt(attemptIdParam);
    if (isNaN(attemptId)) {
      return NextResponse.json({ error: "Invalid attempt ID" }, { status: 400 });
    }

    // Get quiz attempt with detailed information
    const { data: attempt, error } = await supabaseServer
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
      .eq("id", attemptId)
      .eq("owner_id", dbUser.id)
      .single();

    if (error || !attempt) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 });
    }

    // Get individual answers
    const { data: answers } = await supabaseServer
      .from("answers")
      .select("*")
      .eq("quiz_attempt_id", attemptId)
      .order("question_index");

    const quiz = Array.isArray(attempt.quiz) ? attempt.quiz[0] : attempt.quiz;
    const config = quiz?.config || {};
    const questions = config.questions || [];
    const totalQuestions = questions.length;
    const percentage = totalQuestions > 0 ? Math.round((attempt.score / totalQuestions) * 100) : 0;

    const detailedQuiz = {
      id: attempt.id,
      quizId: quiz?.id,
      pdfId: Array.isArray(quiz?.pdf) ? quiz.pdf[0]?.id : (quiz?.pdf as any)?.id,
      pdfName: Array.isArray(quiz?.pdf) ? quiz.pdf[0]?.name || "Unknown PDF" : (quiz?.pdf as any)?.name || "Unknown PDF",
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
          questions: questions.map((question: any, index: number) => {
            const answer = answers?.find(a => a.question_index === question.id);
            const detailedFeedback = attempt.details?.detailedFeedback?.[index];
            return {
              id: question.id,
              type: question.type,
              question: question.question,
              options: question.options,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              page: question.page,
              lineStart: question.lineStart,
              lineEnd: question.lineEnd,
              topic: question.topic,
              userAnswer: answer?.user_answer?.text || "",
              isCorrect: answer?.is_correct || false,
              score: attempt.details?.questionScores?.[index] || 0,
              feedback: detailedFeedback?.feedback || ""
            };
          })
    };

    return NextResponse.json(detailedQuiz);

  } catch (error: any) {
    console.error("Quiz history detail error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch quiz details" },
      { status: 500 }
    );
  }
}
