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
    const attemptIdParam = req.nextUrl.searchParams.get("quizAttemptId");
    const attemptFilter = attemptIdParam ? Number(attemptIdParam) : null;

    // Get incorrect answers scoped (optionally) to a specific quiz attempt
    let incorrectQuery = supabaseServer
      .from("answers")
      .select(`
        question_index,
        user_answer,
        correct_answer,
        quiz_attempt:quiz_attempts(
          quiz:quizzes(config)
        )
      `)
      .eq("quiz_attempt.owner_id", dbUser.id)
      .eq("is_correct", false);
    if (attemptFilter) {
      incorrectQuery = incorrectQuery.eq("quiz_attempt_id", attemptFilter);
    }
    const { data: incorrectAnswers } = await incorrectQuery;

    if (!incorrectAnswers || incorrectAnswers.length === 0) {
      return NextResponse.json({
        weaknesses: [],
        totalIncorrect: 0
      });
    }

    // Analyze weaknesses by topic
    const topicWeaknesses: Record<string, {
      topic: string;
      incorrectCount: number;
      totalAttempts: number;
      accuracy: number;
      commonMistakes: string[];
      lastIncorrect: string;
    }> = {};

    incorrectAnswers.forEach(answer => {
      const quizConfig = answer.quiz_attempt?.quiz?.config;
      if (!quizConfig?.questions) return;

      const question = quizConfig.questions[answer.question_index - 1];
      if (!question) return;

      const topic = question.topic || "General";
      
      if (!topicWeaknesses[topic]) {
        topicWeaknesses[topic] = {
          topic,
          incorrectCount: 0,
          totalAttempts: 0,
          accuracy: 0,
          commonMistakes: [],
          lastIncorrect: ""
        };
      }

      topicWeaknesses[topic].incorrectCount += 1;
      topicWeaknesses[topic].commonMistakes.push(answer.user_answer?.text || "");
    });

    // Get total attempts per topic for accuracy calculation (same scope)
    let allAnswersQuery = supabaseServer
      .from("answers")
      .select(`
        question_index,
        is_correct,
        quiz_attempt:quiz_attempts(
          quiz:quizzes(config)
        )
      `)
      .eq("quiz_attempt.owner_id", dbUser.id);
    if (attemptFilter) {
      allAnswersQuery = allAnswersQuery.eq("quiz_attempt_id", attemptFilter);
    }
    const { data: allAnswers } = await allAnswersQuery;

    if (allAnswers) {
      allAnswers.forEach(answer => {
        const quizConfig = answer.quiz_attempt?.quiz?.config;
        if (!quizConfig?.questions) return;

        const question = quizConfig.questions[answer.question_index - 1];
        if (!question) return;

        const topic = question.topic || "General";
        
        if (topicWeaknesses[topic]) {
          topicWeaknesses[topic].totalAttempts += 1;
        }
      });
    }

    // Calculate accuracy and format weaknesses
    const weaknesses = Object.values(topicWeaknesses)
      .map(weakness => {
        weakness.accuracy = weakness.totalAttempts > 0 
          ? ((weakness.totalAttempts - weakness.incorrectCount) / weakness.totalAttempts) * 100 
          : 0;
        
        // Get most common mistakes (simplified)
        const mistakeCounts: Record<string, number> = {};
        weakness.commonMistakes.forEach(mistake => {
          mistakeCounts[mistake] = (mistakeCounts[mistake] || 0) + 1;
        });
        
        weakness.commonMistakes = Object.entries(mistakeCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([mistake]) => mistake);

        return weakness;
      })
      .sort((a, b) => a.accuracy - b.accuracy) // Sort by lowest accuracy first
      .slice(0, 5); // Top 5 weaknesses

    return NextResponse.json({
      weaknesses,
      totalIncorrect: incorrectAnswers.length
    });

  } catch (error: any) {
    console.error("Weaknesses analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze weaknesses" },
      { status: 500 }
    );
  }
}
