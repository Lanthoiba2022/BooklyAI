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
    const quizAttemptId = searchParams.get('quizAttemptId');

    if (!quizAttemptId) {
      return NextResponse.json({ error: "quizAttemptId is required" }, { status: 400 });
    }

    // Verify the quiz attempt belongs to the user
    const { data: quizAttempt, error: attemptError } = await supabaseServer
      .from('quiz_attempts')
      .select('id')
      .eq('id', quizAttemptId)
      .eq('owner_id', dbUser.id)
      .single();

    if (attemptError || !quizAttempt) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 });
    }

    // Get quiz-specific YouTube recommendations from database
    const { data: recommendations, error } = await supabaseServer
      .from('youtube_recommendations')
      .select(`
        id,
        video_id,
        title,
        description,
        thumbnail_url,
        channel_title,
        duration,
        view_count,
        relevance_score,
        source_type,
        source_topic,
        video_url,
        created_at
      `)
      .eq('owner_id', dbUser.id)
      .eq('quiz_attempt_id', quizAttemptId)
      .order('relevance_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[Quiz YouTube Persistent API] Database error:', error);
      return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
    }

    // Transform data to match frontend expectations
    const transformedRecommendations = (recommendations || []).map(rec => ({
      id: rec.id,
      videoId: rec.video_id,
      title: rec.title,
      description: rec.description,
      thumbnailUrl: rec.thumbnail_url,
      channelTitle: rec.channel_title,
      duration: rec.duration,
      viewCount: rec.view_count,
      relevanceScore: rec.relevance_score,
      sourceType: rec.source_type,
      sourceTopic: rec.source_topic,
      videoUrl: rec.video_url,
      createdAt: rec.created_at,
    }));

    return NextResponse.json({
      recommendations: transformedRecommendations,
      totalFound: transformedRecommendations.length,
      quizAttemptId: parseInt(quizAttemptId),
    });

  } catch (error: any) {
    console.error('[Quiz YouTube Persistent API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get quiz-specific YouTube recommendations' }, 
      { status: 500 }
    );
  }
}
