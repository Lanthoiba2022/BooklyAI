import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { supabaseServer } from "@/lib/supabaseServer";
import { 
  searchYouTubeVideos, 
  extractTopicsFromText, 
  analyzeChatForWeaknesses,
  generateSearchQueries,
  rankVideosByRelevance,
  type RecommendationContext 
} from "@/lib/youtube";

export const runtime = "nodejs";

interface YouTubeRecommendationRequest {
  pdfId?: number;
  chatHistory?: string[];
  currentQuestion?: string;
  topics?: string[];
  maxResults?: number;
}

export async function GET(req: NextRequest) {
  const { user } = await getAuthenticatedUserFromCookies(req);
  if (!user) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
  
  const dbUser = await ensureUserProvisioned(user as any);
  if (!dbUser) return new Response(JSON.stringify({ error: "User not provisioned" }), { status: 500 });

  if (!supabaseServer) return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });

  try {
    const { searchParams } = new URL(req.url);
    const pdfId = searchParams.get('pdfId');
    const maxResults = parseInt(searchParams.get('maxResults') || '8');

    // Get chat history if pdfId provided
    let chatHistory: string[] = [];
    if (pdfId) {
      const { data: messages } = await supabaseServer
        .from('messages')
        .select('content')
        .eq('chat_id', pdfId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      chatHistory = messages?.map(m => m.content) || [];
    }

    // Extract topics from multiple sources
    const topics: string[] = [];

    // 1. Extract from PDF content if available
    if (pdfId) {
      try {
        const { data: chunks } = await supabaseServer
          .from('chunks')
          .select('text')
          .eq('pdf_id', pdfId)
          .limit(5);
        
        if (chunks && chunks.length > 0) {
          const pdfContent = chunks.map(c => c.text).join(' ');
          const pdfTopics = await extractTopicsFromText(pdfContent);
          topics.push(...pdfTopics);
        }
      } catch (error) {
        console.error('[YouTube API] PDF topic extraction error:', error);
      }
    }

    // 2. Analyze chat history for weaknesses
    if (chatHistory.length > 0) {
      const chatWeaknesses = analyzeChatForWeaknesses(chatHistory);
      topics.push(...chatWeaknesses);
    }

    // 3. Extract from current question if provided
    const currentQuestion = searchParams.get('currentQuestion');
    if (currentQuestion) {
      const questionTopics = await extractTopicsFromText(currentQuestion);
      topics.push(...questionTopics);
    }

    // Remove duplicates and filter out generic topics
    const uniqueTopics = [...new Set(topics)].filter(topic => 
      topic !== 'explanation_needed' && 
      topic !== 'confusion' && 
      topic !== 'complexity' &&
      topic !== 'definition_needed' &&
      topic !== 'assistance_needed'
    );

    console.log('[YouTube API] Extracted topics:', uniqueTopics);

    // If no specific topics found, use generic physics education queries
    const searchQueries = uniqueTopics.length > 0 
      ? generateSearchQueries(uniqueTopics)
      : ['physics tutorial education', 'physics concepts explained'];

    // Search YouTube for each query
    const allVideos = [];
    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries to avoid rate limits
      try {
        const result = await searchYouTubeVideos(query, Math.ceil(maxResults / 3));
        allVideos.push(...result.videos);
      } catch (error) {
        console.error('[YouTube API] Search error for query:', query, error);
      }
    }

    // Remove duplicates and rank by relevance
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.videoId === video.videoId)
    );

    const rankedVideos = rankVideosByRelevance(uniqueVideos, uniqueTopics);
    const recommendations = rankedVideos.slice(0, maxResults);

    // Store recommendations in database (prevent duplicates)
    if (recommendations.length > 0) {
      try {
        // Get existing video IDs for this user to prevent duplicates
        const existingVideoIds = new Set<string>();
        const { data: existingVideos } = await supabaseServer
          .from('youtube_recommendations')
          .select('video_id')
          .eq('owner_id', dbUser.id);
        
        if (existingVideos) {
          existingVideos.forEach(video => existingVideoIds.add(video.video_id));
        }

        // Filter out duplicates and prepare new recommendations
        const newRecommendations = recommendations.filter(video => 
          !existingVideoIds.has(video.videoId)
        );

        if (newRecommendations.length > 0) {
          // Use the safe insert function to prevent duplicates
          for (const video of newRecommendations) {
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
              p_source_type: uniqueTopics.length > 0 ? 'content' : 'generic',
              p_source_topic: uniqueTopics[0] || 'general_physics',
              p_video_url: `https://www.youtube.com/watch?v=${video.videoId}`,
              p_quiz_attempt_id: null, // Global recommendations don't have quiz context
            });
          }
        }
      } catch (error) {
        console.error('[YouTube API] Database storage error:', error);
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
    });

  } catch (error: any) {
    console.error('[YouTube API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get YouTube recommendations' }, 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { user } = await getAuthenticatedUserFromCookies(req);
  if (!user) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
  
  const dbUser = await ensureUserProvisioned(user as any);
  if (!dbUser) return new Response(JSON.stringify({ error: "User not provisioned" }), { status: 500 });

  if (!supabaseServer) return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });

  try {
    const body: { videoId: string; interactionType: string; durationWatched?: number } = await req.json();
    const { videoId, interactionType, durationWatched } = body;

    if (!videoId || !interactionType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Record video interaction
    await supabaseServer
      .from('video_interactions')
      .insert({
        owner_id: dbUser.id,
        video_id: videoId,
        interaction_type: interactionType,
        duration_watched: durationWatched || null,
      });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[YouTube API] Interaction tracking error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to track video interaction' }, 
      { status: 500 }
    );
  }
}
