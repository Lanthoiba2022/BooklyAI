"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, ExternalLink, Clock, Eye, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  duration: string;
  viewCount: number;
  publishedAt: string;
  relevanceScore: number;
}

interface YouTubeRecommendationsProps {
  videos: YouTubeVideo[];
  topics: string[];
  onVideoClick?: (videoId: string) => void;
  onVideoWatch?: (videoId: string, duration?: number) => void;
  className?: string;
}

export function YouTubeRecommendations({ 
  videos, 
  topics, 
  onVideoClick, 
  onVideoWatch,
  className 
}: YouTubeRecommendationsProps) {
  const [loading, setLoading] = React.useState(false);
  const uniqueVideos = React.useMemo(() => {
    const seen = new Set<string>();
    return (videos || []).filter((v) => {
      if (!v || !v.videoId) return false;
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });
  }, [videos]);

  const handleVideoClick = async (video: YouTubeVideo) => {
    setLoading(true);
    try {
      // Track video click
      await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          videoId: video.videoId,
          interactionType: 'clicked'
        })
      });

      onVideoClick?.(video.videoId);
    } catch (error) {
      console.error('Error tracking video click:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: string) => {
    // Convert ISO 8601 duration to readable format
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 20) return "bg-green-100 text-green-800";
    if (score >= 10) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  if (videos.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No video recommendations available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-semibold">Recommended Videos</h3>
        </div>
        {topics.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Based on:</span>
            {topics.slice(0, 2).map((topic, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
            {topics.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{topics.length - 2} more
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Video Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {uniqueVideos.map((video) => (
          <Card 
            key={video.videoId} 
            className="group cursor-pointer transition-all hover:shadow-md"
            onClick={() => handleVideoClick(video)}
          >
            <div className="relative">
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-32 object-cover rounded-t-lg"
              />
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
                {formatDuration(video.duration)}
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            
            <CardHeader className="p-3">
              <CardTitle className="text-sm line-clamp-2 leading-tight">
                {video.title}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{video.channelTitle}</span>
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {formatViewCount(video.viewCount)}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getRelevanceColor(video.relevanceScore))}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {video.relevanceScore.toFixed(0)}
                  </Badge>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank');
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Watch
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Videos are ranked by relevance to your current study topics
        </p>
      </div>
    </div>
  );
}

// Compact version for chat integration
export function YouTubeRecommendationsCompact({ 
  videos, 
  onVideoClick,
  className 
}: {
  videos: YouTubeVideo[];
  onVideoClick?: (videoId: string) => void;
  className?: string;
}) {
  const uniqueVideos = React.useMemo(() => {
    const seen = new Set<string>();
    return (videos || []).filter((v) => {
      if (!v || !v.videoId) return false;
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });
  }, [videos]);
  if (uniqueVideos.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Play className="h-4 w-4 text-red-500" />
        <span>Recommended Videos</span>
      </div>
      
      <div className="grid gap-2">
        {uniqueVideos.slice(0, 3).map((video) => (
          <div
            key={video.videoId}
            className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onVideoClick?.(video.videoId)}
          >
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-12 h-8 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{video.title}</p>
              <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank');
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
