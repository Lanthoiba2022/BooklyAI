"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Target, 
  Clock, 
  BookOpen,
  BarChart3,
  RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";

type ProgressData = {
  totalQuizzes: number;
  averageScore: number;
  streak: number;
  topicScores: Record<string, number>;
  lastQuizDate: string;
  accuracyByTopic: Record<string, number>;
  averageTimePerQuestion: number;
  masteryScore: number;
  consistency: number;
  completionRate: number;
  totalEngagementTime: number;
  scoreHistory: Array<{ date: string; score: number; percentage: number }>;
  topicPerformance: Record<string, { total: number; correct: number; average: number }>;
  questionTypePerformance: {
    mcq: { total: number; correct: number; average: number };
    saq: { total: number; correct: number; average: number };
    laq: { total: number; correct: number; average: number };
  };
  recentActivity: Array<{
    id: number;
    score: number;
    totalQuestions: number;
    percentage: number;
    pdfName: string;
    createdAt: string;
    timeTaken: number;
  }>;
  improvement: number;
};

type WeaknessData = {
  weaknesses: Array<{
    topic: string;
    incorrectCount: number;
    totalAttempts: number;
    accuracy: number;
    commonMistakes: string[];
    lastIncorrect: string;
  }>;
  totalIncorrect: number;
};

export function ProgressDashboard() {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [weaknessData, setWeaknessData] = useState<WeaknessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showYouTube, setShowYouTube] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [loadingYouTube, setLoadingYouTube] = useState(false);

  useEffect(() => {
    fetchProgressData();
    fetchWeaknessData();
  }, []);

  const fetchProgressData = async () => {
    try {
      const response = await fetch("/api/progress/dashboard", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setProgressData(data);
      }
    } catch (error) {
      console.error("Error fetching progress data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeaknessData = async () => {
    try {
      const response = await fetch("/api/progress/weaknesses", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setWeaknessData(data);
      }
    } catch (error) {
      console.error("Error fetching weakness data:", error);
    }
  };

  const fetchYouTubeRecommendations = async () => {
    if (showYouTube) return; // Already showing

    setLoadingYouTube(true);
    try {
      const response = await fetch("/api/youtube?maxResults=5", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setYoutubeVideos(data.recommendations || []);
        setShowYouTube(true);
      }
    } catch (error) {
      console.error("Error fetching YouTube recommendations:", error);
    } finally {
      setLoadingYouTube(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading progress data...</span>
        </div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Progress Data</h3>
        <p className="text-muted-foreground">Take some quizzes to see your progress here.</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Progress Dashboard</h1>
          <p className="text-muted-foreground">Track your learning journey and performance</p>
        </div>
        <Button onClick={fetchProgressData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Quizzes</p>
              <p className="text-2xl font-bold">{progressData.totalQuizzes}</p>
            </div>
            <BookOpen className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Average Score</p>
              <p className="text-2xl font-bold">{Math.round(progressData.averageScore)}%</p>
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
              <p className="text-2xl font-bold">{progressData.streak}</p>
            </div>
            <Award className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mastery Score</p>
              <p className="text-2xl font-bold">{Math.round(progressData.masteryScore)}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Trend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Score Trend</h3>
          <div className="space-y-2">
            {progressData.scoreHistory.slice(-5).map((entry, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{formatDate(entry.date)}</span>
                <div className="flex items-center gap-2">
                  <Progress value={entry.percentage} className="w-20 h-2" />
                  <span className="text-sm font-medium">{entry.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
          {progressData.improvement !== 0 && (
            <div className="mt-4 flex items-center gap-2">
              {progressData.improvement > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm text-muted-foreground">
                {progressData.improvement > 0 ? "+" : ""}{Math.round(progressData.improvement)}% 
                vs previous period
              </span>
            </div>
          )}
        </Card>

        {/* Question Type Performance */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Question Type Performance</h3>
          <div className="space-y-4">
            {Object.entries(progressData.questionTypePerformance).map(([type, perf]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium uppercase">{type}</span>
                  <span className="text-sm text-muted-foreground">{Math.round(perf.average)}%</span>
                </div>
                <Progress value={perf.average} className="h-2" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Topic Performance */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Topic Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(progressData.topicPerformance).map(([topic, perf]) => (
            <div key={topic} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{topic}</span>
                <span className="text-sm text-muted-foreground">{Math.round(perf.average)}%</span>
              </div>
              <Progress value={perf.average} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {perf.correct} / {perf.total} correct
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Weaknesses Analysis */}
      {weaknessData && weaknessData.weaknesses.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Areas for Improvement</h3>
            <Button
              onClick={fetchYouTubeRecommendations}
              disabled={loadingYouTube}
              variant="outline"
              size="sm"
            >
              {loadingYouTube ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4 mr-2" />
              )}
              Get Study Resources
            </Button>
          </div>
          
          <div className="space-y-4">
            {weaknessData.weaknesses.map((weakness, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{weakness.topic}</span>
                  <Badge variant="destructive">
                    {Math.round(weakness.accuracy)}% accuracy
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {weakness.incorrectCount} incorrect out of {weakness.totalAttempts} attempts
                </div>
                {weakness.commonMistakes.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-muted-foreground">Common mistakes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {weakness.commonMistakes.map((mistake, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {mistake.slice(0, 30)}...
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* YouTube Recommendations */}
          {showYouTube && youtubeVideos.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-md font-semibold mb-4">Recommended Study Videos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {youtubeVideos.map((video) => (
                  <div key={video.videoId} className="border rounded-lg p-4">
                    <div className="aspect-video bg-gray-100 rounded mb-2 flex items-center justify-center">
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <h5 className="font-medium text-sm line-clamp-2 mb-1">{video.title}</h5>
                    <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{video.duration}</span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(video.relevanceScore * 100)}% relevant
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {progressData.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium">{activity.pdfName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(activity.createdAt)} • {formatTime(activity.timeTaken)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{activity.percentage}%</p>
                <p className="text-sm text-muted-foreground">
                  {activity.score}/{activity.totalQuestions}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
