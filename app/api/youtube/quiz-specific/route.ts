import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { supabaseServer } from "@/lib/supabaseServer";
import { 
  searchYouTubeVideos, 
  extractTopicsFromText, 
  generateSearchQueries,
  rankVideosByRelevance
} from "@/lib/youtube";

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
    const maxResults = parseInt(searchParams.get('maxResults') || '5');

    if (!quizAttemptId) {
      return NextResponse.json({ error: "quizAttemptId is required" }, { status: 400 });
    }

    // Get quiz attempt details to understand the context
    const { data: quizAttempt, error: attemptError } = await supabaseServer
      .from('quiz_attempts')
      .select(`
        id,
        score,
        details,
        quiz:quizzes(
          id,
          config,
          pdf:pdfs(name, id)
        )
      `)
      .eq('id', quizAttemptId)
      .eq('owner_id', dbUser.id)
      .single();

    if (attemptError || !quizAttempt) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 });
    }

    // Extract topics from incorrect answers in the quiz attempt
    const topics: string[] = [];
    const incorrectAnswers = quizAttempt.details?.detailedFeedback || [];
    
    // Get topics from incorrect answers
    for (const feedback of incorrectAnswers) {
      if (!feedback.correct && feedback.explanation) {
        try {
          const answerTopics = await extractTopicsFromText(feedback.explanation);
          topics.push(...answerTopics);
        } catch (error) {
          console.error('[Quiz YouTube API] Topic extraction error:', error);
        }
      }
    }

    // Also extract topics from the PDF content if available
    const quiz = Array.isArray(quizAttempt.quiz) ? quizAttempt.quiz[0] : quizAttempt.quiz;
    const pdfId = Array.isArray(quiz?.pdf) ? quiz.pdf[0]?.id : (quiz?.pdf as any)?.id;
    if (pdfId) {
      try {
        const { data: chunks } = await supabaseServer
          .from('chunks')
          .select('text')
          .eq('pdf_id', pdfId)
          .limit(3);
        
        if (chunks && chunks.length > 0) {
          const pdfContent = chunks.map(c => c.text).join(' ');
          const pdfTopics = await extractTopicsFromText(pdfContent);
          topics.push(...pdfTopics);
        }
      } catch (error) {
        console.error('[Quiz YouTube API] PDF topic extraction error:', error);
      }
    }

    // Remove duplicates and filter out generic topics
    const uniqueTopics = [...new Set(topics)].filter(topic => 
      topic !== 'explanation_needed' && 
      topic !== 'confusion' && 
      topic !== 'complexity' &&
      topic !== 'definition_needed' &&
      topic !== 'assistance_needed'
    );

    console.log('[Quiz YouTube API] Extracted topics for quiz attempt:', quizAttemptId, uniqueTopics);

    // If no specific topics found, use generic physics education queries
    const searchQueries = uniqueTopics.length > 0 
      ? generateSearchQueries(uniqueTopics)
      : ['physics tutorial education', 'physics concepts explained'];

    // Search YouTube for each query
    const allVideos = [];
    for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries for quiz-specific
      try {
        const result = await searchYouTubeVideos(query, Math.ceil(maxResults / 2));
        allVideos.push(...result.videos);
      } catch (error) {
        console.error('[Quiz YouTube API] Search error for query:', query, error);
      }
    }

    // Remove duplicates and rank by relevance
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.videoId === video.videoId)
    );

    const rankedVideos = rankVideosByRelevance(uniqueVideos, uniqueTopics);
    const recommendations = rankedVideos.slice(0, maxResults);

    // Store quiz-specific recommendations in database
    if (recommendations.length > 0) {
      try {
        // Use the safe insert function to prevent duplicates
        for (const video of recommendations) {
          await supabaseServer.rpc('insert_youtube_recommendation', {
            p_owner_id: dbUser.id,
            p_video_id: video.videoId,
            p_title: video.title,
            p_description: video.description,
            p_thumbnail_url: video.thumbnailUrl,
            p_channel_title: video.channelTitle,
            p_duration: video.duration,
            p_view_count: video.viewCount,
            p_relevance_score: (video as any).relevanceScore || 0,
            p_source_type: 'quiz_attempt',
            p_source_topic: uniqueTopics[0] || 'general_physics',
            p_video_url: `https://www.youtube.com/watch?v=${video.videoId}`,
            p_quiz_attempt_id: parseInt(quizAttemptId),
          });
        }
      } catch (error) {
        console.error('[Quiz YouTube API] Database storage error:', error);
        // Continue even if storage fails
      }
    }

    return NextResponse.json({
      recommendations: recommendations.map(video => ({
        videoId: video.videoId,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        channelTitle: video.channelTitle,
        duration: video.duration,
        viewCount: video.viewCount,
        publishedAt: video.publishedAt,
        relevanceScore: (video as any).relevanceScore || 0,
        videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      })),
      topics: uniqueTopics,
      totalFound: recommendations.length,
      quizAttemptId: parseInt(quizAttemptId),
    });

  } catch (error: any) {
    console.error('[Quiz YouTube API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get quiz-specific YouTube recommendations' }, 
      { status: 500 }
    );
  }
}
