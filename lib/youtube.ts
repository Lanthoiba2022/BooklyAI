import { getEnv } from "./env";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  duration: string;
  viewCount: number;
  publishedAt: string;
}

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  nextPageToken?: string;
  totalResults: number;
}

export interface RecommendationContext {
  pdfId?: number;
  chatHistory?: string[];
  currentQuestion?: string;
  topics?: string[];
}

// Search YouTube for educational videos
export async function searchYouTubeVideos(
  query: string,
  maxResults: number = 10
): Promise<YouTubeSearchResult> {
  const { youtubeApiKey } = getEnv();
  if (!youtubeApiKey) {
    throw new Error("YouTube API key not configured");
  }

  try {
    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoCategoryId: '27', // Education category
      maxResults: maxResults.toString(),
      order: 'relevance',
      key: youtubeApiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams}`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Get video details for each result
    const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${youtubeApiKey}`
    );

    if (!detailsResponse.ok) {
      throw new Error(`YouTube API details error: ${detailsResponse.status}`);
    }

    const detailsData = await detailsResponse.json();

    const videos: YouTubeVideo[] = detailsData.items.map((item: any) => ({
      videoId: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      channelTitle: item.snippet.channelTitle,
      duration: item.contentDetails.duration,
      viewCount: parseInt(item.statistics.viewCount || '0'),
      publishedAt: item.snippet.publishedAt,
    }));

    return {
      videos,
      nextPageToken: data.nextPageToken,
      totalResults: data.pageInfo.totalResults,
    };
  } catch (error) {
    console.error('[YouTube] Search error:', error);
    throw new Error('Failed to search YouTube videos');
  }
}

// Extract topics from text using Gemini
export async function extractTopicsFromText(text: string): Promise<string[]> {
  const { geminiApiKey } = getEnv();
  if (!geminiApiKey) {
    console.warn('[YouTube] Gemini API key not configured, using fallback topic extraction');
    return extractTopicsFallback(text);
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Analyze the following text and extract key physics/educational topics that students might need additional help with.
    Focus on:
    1. Main physics concepts mentioned
    2. Complex topics that typically cause confusion
    3. Fundamental concepts that need reinforcement
    4. Topics that usually require additional explanation
    
    Text: "${text}"
    
    Return only a JSON array of topic strings, maximum 5 topics.
    Example: ["Newton's Laws", "Thermodynamics", "Wave Mechanics"]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const topicsText = response.text();

    try {
      const topics = JSON.parse(topicsText);
      return Array.isArray(topics) ? topics : [];
    } catch {
      return extractTopicsFallback(text);
    }
  } catch (error) {
    console.error('[YouTube] Topic extraction error:', error);
    return extractTopicsFallback(text);
  }
}

// Fallback topic extraction using simple keyword matching
function extractTopicsFallback(text: string): string[] {
  const physicsTopics = [
    'Newton\'s Laws', 'Thermodynamics', 'Wave Mechanics', 'Optics', 'Electricity',
    'Magnetism', 'Quantum Physics', 'Mechanics', 'Energy', 'Momentum',
    'Force', 'Motion', 'Gravity', 'Friction', 'Acceleration', 'Velocity',
    'Kinematics', 'Dynamics', 'Work', 'Power', 'Heat', 'Temperature',
    'Pressure', 'Density', 'Frequency', 'Wavelength', 'Amplitude'
  ];

  const foundTopics = physicsTopics.filter(topic => 
    text.toLowerCase().includes(topic.toLowerCase())
  );

  return foundTopics.slice(0, 5);
}

// Analyze chat history for weakness indicators
export function analyzeChatForWeaknesses(chatHistory: string[]): string[] {
  const weaknessPatterns = [
    { pattern: /explain again|explain it again/i, topic: 'explanation_needed' },
    { pattern: /don't understand|don't get it|confused/i, topic: 'confusion' },
    { pattern: /make it simpler|simpler explanation/i, topic: 'complexity' },
    { pattern: /what does this mean|what is this/i, topic: 'definition_needed' },
    { pattern: /help me with|can you help/i, topic: 'assistance_needed' },
    { pattern: /newton|newton's laws/i, topic: 'Newton\'s Laws' },
    { pattern: /thermodynamics|heat|temperature/i, topic: 'Thermodynamics' },
    { pattern: /wave|frequency|wavelength/i, topic: 'Wave Mechanics' },
    { pattern: /electric|magnetic|charge/i, topic: 'Electromagnetism' },
    { pattern: /force|acceleration|velocity/i, topic: 'Mechanics' },
  ];

  const detectedWeaknesses: string[] = [];

  chatHistory.forEach(message => {
    weaknessPatterns.forEach(({ pattern, topic }) => {
      if (pattern.test(message) && !detectedWeaknesses.includes(topic)) {
        detectedWeaknesses.push(topic);
      }
    });
  });

  return detectedWeaknesses;
}

// Generate search queries for YouTube
export function generateSearchQueries(topics: string[]): string[] {
  const baseQueries = topics.map(topic => 
    `${topic} physics tutorial education`
  );

  // Add some generic educational queries
  const genericQueries = [
    'physics concepts explained',
    'physics fundamentals tutorial',
    'physics problem solving',
    'physics education channel'
  ];

  return [...baseQueries, ...genericQueries].slice(0, 8); // Limit to 8 queries
}

// Rank videos by relevance
export function rankVideosByRelevance(
  videos: YouTubeVideo[],
  topics: string[]
): YouTubeVideo[] {
  return videos.map(video => {
    let relevanceScore = 0;

    // Check title relevance
    topics.forEach(topic => {
      if (video.title.toLowerCase().includes(topic.toLowerCase())) {
        relevanceScore += 10;
      }
    });

    // Check description relevance
    topics.forEach(topic => {
      if (video.description.toLowerCase().includes(topic.toLowerCase())) {
        relevanceScore += 5;
      }
    });

    // Prefer educational channels
    const educationalChannels = [
      'khan academy', 'crash course', 'physics girl', 'veritasium',
      'minutephysics', '3blue1brown', 'sci show', 'ted-ed'
    ];
    
    if (educationalChannels.some(channel => 
      video.channelTitle.toLowerCase().includes(channel)
    )) {
      relevanceScore += 15;
    }

    // Prefer recent videos (within last 2 years)
    const publishedDate = new Date(video.publishedAt);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    if (publishedDate > twoYearsAgo) {
      relevanceScore += 5;
    }

    // Prefer videos with good view counts (not too low, not too high)
    if (video.viewCount > 1000 && video.viewCount < 1000000) {
      relevanceScore += 3;
    }

    return { ...video, relevanceScore };
  }).sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore);
}
