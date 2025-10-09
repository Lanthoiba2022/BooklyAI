import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { evaluateMCQ, evaluateSAQ, evaluateLAQ, QuizResults } from "@/lib/quiz";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type EvaluateQuizBody = {
  quizId: number;
  answers: Record<number, string>;
  timeTaken?: number;
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
    const body: EvaluateQuizBody = await req.json();
    const { quizId, answers, timeTaken = 0 } = body;

    if (!quizId || !answers) {
      return NextResponse.json({ error: "Missing quizId or answers" }, { status: 400 });
    }

    // Get quiz details
    const { data: quiz } = await supabaseServer
      .from("quizzes")
      .select("id, owner_id, config")
      .eq("id", quizId)
      .eq("owner_id", dbUser.id)
      .single();

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const questions = quiz.config.questions || [];
    const totalQuestions = questions.length;
    let totalScore = 0;
    const feedback: QuizResults["feedback"] = [];

    // Evaluate each answer
    for (const question of questions) {
      const userAnswer = answers[question.id] || "";
      let evaluation: { correct: boolean; score: number; feedback?: string };

      switch (question.type) {
        case "mcq":
          evaluation = evaluateMCQ(userAnswer, question.correctAnswer);
          break;
        case "saq":
          evaluation = await evaluateSAQ(userAnswer, question.correctAnswer, question.question);
          break;
        case "laq":
          evaluation = await evaluateLAQ(userAnswer, question.correctAnswer, question.question);
          break;
        default:
          evaluation = { correct: false, score: 0, feedback: "Unknown question type" };
      }

      totalScore += evaluation.score;

      feedback.push({
        questionId: question.id,
        correct: evaluation.correct,
        userAnswer,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        score: evaluation.score,
        ...(evaluation.feedback && { feedback: evaluation.feedback })
      });
    }

    const percentage = Math.round((totalScore / totalQuestions) * 100);
    const results: QuizResults = {
      score: totalScore,
      totalScore: totalQuestions,
      percentage,
      feedback
    };

    // Store quiz attempt
    const { data: attempt } = await supabaseServer
      .from("quiz_attempts")
      .insert({
        quiz_id: quizId,
        owner_id: dbUser.id,
        score: totalScore,
        details: {
          answers,
          timeTaken,
          questionScores: feedback.map(f => f.score)
        }
      })
      .select("id")
      .single();

    if (attempt) {
      // Store individual answers
      const answerInserts = feedback.map(f => ({
        quiz_attempt_id: attempt.id,
        question_index: f.questionId,
        user_answer: { text: f.userAnswer },
        correct_answer: { text: f.correctAnswer },
        is_correct: f.correct
      }));

      await supabaseServer
        .from("answers")
        .insert(answerInserts);
    }

    // Update user progress
    await updateUserProgress(dbUser.id, results);

    return NextResponse.json(results);

  } catch (error: any) {
    console.error("Quiz evaluation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to evaluate quiz" },
      { status: 500 }
    );
  }
}

async function updateUserProgress(userId: number, results: QuizResults) {
  if (!supabaseServer) return;

  try {
    // Get current progress
    const { data: progress } = await supabaseServer
      .from("user_progress")
      .select("metrics")
      .eq("owner_id", userId)
      .single();

    const currentMetrics = progress?.metrics || {
      totalQuizzes: 0,
      averageScore: 0,
      streak: 0,
      topicScores: {},
      lastQuizDate: ""
    };

    // Update metrics
    const newTotalQuizzes = currentMetrics.totalQuizzes + 1;
    const newAverageScore = ((currentMetrics.averageScore * currentMetrics.totalQuizzes) + results.percentage) / newTotalQuizzes;
    
    // Calculate streak
    const today = new Date().toISOString().split('T')[0];
    const lastQuizDate = currentMetrics.lastQuizDate;
    let newStreak = currentMetrics.streak;
    
    if (lastQuizDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastQuizDate === yesterdayStr || lastQuizDate === today) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    // Update topic scores (simplified - would need question topics in real implementation)
    const topicScores = { ...currentMetrics.topicScores };
    topicScores["General"] = ((topicScores["General"] || 0) + results.percentage) / 2;

    const updatedMetrics = {
      ...currentMetrics,
      totalQuizzes: newTotalQuizzes,
      averageScore: newAverageScore,
      streak: newStreak,
      topicScores,
      lastQuizDate: today
    };

    // Upsert progress
    await supabaseServer
      .from("user_progress")
      .upsert({
        owner_id: userId,
        metrics: updatedMetrics,
        updated_at: new Date().toISOString()
      });

  } catch (error) {
    console.error("Progress update error:", error);
  }
}
