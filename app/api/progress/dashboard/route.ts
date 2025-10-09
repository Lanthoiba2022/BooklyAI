import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { getUserProgress, ProgressMetrics } from "@/lib/quiz";
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
    // Get basic progress metrics
    const progressMetrics = await getUserProgress(dbUser.id);

    // Get recent quiz attempts for additional insights
    const { data: recentAttempts } = await supabaseServer
      .from("quiz_attempts")
      .select(`
        id,
        score,
        details,
        created_at,
        quiz:quizzes(config, pdf:pdfs(name))
      `)
      .eq("owner_id", dbUser.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get quiz history for charts
    const { data: allAttempts } = await supabaseServer
      .from("quiz_attempts")
      .select(`
        score,
        details,
        created_at,
        quiz:quizzes(config)
      `)
      .eq("owner_id", dbUser.id)
      .order("created_at", { ascending: true });

    // Calculate additional metrics
    const scoreHistory = allAttempts?.map(attempt => {
      const quizRel: any = (attempt as any).quiz;
      const config = Array.isArray(quizRel) ? quizRel[0]?.config : quizRel?.config;
      const totalQs = config?.questions?.length || 1;
      return {
        date: (attempt as any).created_at.split('T')[0],
        score: (attempt as any).score || 0,
        percentage: Math.round(((((attempt as any).score || 0) / totalQs) * 100))
      };
    }) || [];

    // Topic performance analysis
    const topicPerformance: Record<string, { total: number; correct: number; average: number }> = {};
    
    allAttempts?.forEach(attempt => {
      const quizRel: any = (attempt as any).quiz;
      const config = Array.isArray(quizRel) ? quizRel[0]?.config : quizRel?.config;
      const questions = config?.questions || [];
      const questionScores = (attempt as any).details?.questionScores || [];
      
      questions.forEach((q: any, index: number) => {
        const topic = q.topic || "General";
        if (!topicPerformance[topic]) {
          topicPerformance[topic] = { total: 0, correct: 0, average: 0 };
        }
        topicPerformance[topic].total += 1;
        topicPerformance[topic].correct += questionScores[index] || 0;
      });
    });

    // Calculate topic averages
    Object.keys(topicPerformance).forEach(topic => {
      const perf = topicPerformance[topic];
      perf.average = perf.total > 0 ? (perf.correct / perf.total) * 100 : 0;
    });

    // Question type performance
    const questionTypePerformance = {
      mcq: { total: 0, correct: 0, average: 0 },
      saq: { total: 0, correct: 0, average: 0 },
      laq: { total: 0, correct: 0, average: 0 }
    };

    allAttempts?.forEach(attempt => {
      const quizRel: any = (attempt as any).quiz;
      const config = Array.isArray(quizRel) ? quizRel[0]?.config : quizRel?.config;
      const questions = config?.questions || [];
      const questionScores = (attempt as any).details?.questionScores || [];
      
      questions.forEach((q: any, index: number) => {
        const type = q.type || "mcq";
        if (questionTypePerformance[type as keyof typeof questionTypePerformance]) {
          questionTypePerformance[type as keyof typeof questionTypePerformance].total += 1;
          questionTypePerformance[type as keyof typeof questionTypePerformance].correct += questionScores[index] || 0;
        }
      });
    });

    // Calculate question type averages
    Object.keys(questionTypePerformance).forEach(type => {
      const perf = questionTypePerformance[type as keyof typeof questionTypePerformance];
      perf.average = perf.total > 0 ? (perf.correct / perf.total) * 100 : 0;
    });

    // Recent activity
    const recentActivity = recentAttempts?.map(attempt => {
      const quizRel: any = (attempt as any).quiz;
      const config = Array.isArray(quizRel) ? quizRel[0]?.config : quizRel?.config;
      const pdfRel = Array.isArray(quizRel) ? quizRel[0]?.pdf : quizRel?.pdf;
      const totalQuestions = config?.questions?.length || 0;
      const percentage = Math.round(((((attempt as any).score || 0) / (totalQuestions || 1)) * 100));
      return {
        id: (attempt as any).id,
        score: (attempt as any).score || 0,
        totalQuestions,
        percentage,
        pdfName: pdfRel?.name || "Unknown PDF",
        createdAt: (attempt as any).created_at,
        timeTaken: (attempt as any).details?.timeTaken || 0,
      };
    }) || [];

    // Calculate improvement trend
    const recentScores = scoreHistory.slice(-5).map(h => h.percentage);
    const olderScores = scoreHistory.slice(-10, -5).map(h => h.percentage);
    const recentAvg = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
    const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : 0;
    const improvement = recentAvg - olderAvg;

    return NextResponse.json({
      ...progressMetrics,
      scoreHistory,
      topicPerformance,
      questionTypePerformance,
      recentActivity,
      improvement,
      // Additional calculated fields
      totalEngagementTime: progressMetrics.totalEngagementTime,
      averageTimePerQuestion: progressMetrics.averageTimePerQuestion,
      completionRate: progressMetrics.completionRate,
      consistency: progressMetrics.consistency
    });

  } catch (error: any) {
    console.error("Dashboard data error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
