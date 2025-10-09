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
  RefreshCw,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { useUiStore } from "@/store/ui";
import { QuizHistoryDetail } from "./QuizHistoryDetail";

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


type QuizHistoryItem = {
  id: number;
  quizId: number;
  pdfId: number;
  pdfName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken: number;
  createdAt: string;
  questionTypes: {
    mcq: number;
    saq: number;
    laq: number;
  };
  answers: Record<number, string>;
  questionScores: number[];
};

export function ProgressDashboard() {
  const { setCenterView } = useUiStore();
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuizHistory, setLoadingQuizHistory] = useState(false);
  const [selectedQuizAttempt, setSelectedQuizAttempt] = useState<number | null>(null);

  useEffect(() => {
    fetchProgressData();
    fetchQuizHistory();
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


  const fetchQuizHistory = async () => {
    setLoadingQuizHistory(true);
    try {
      const response = await fetch("/api/progress/quiz-history?limit=20", {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuizHistory(data.quizHistory || []);
      } else {
        const errorData = await response.json();
        console.error("Quiz history error:", errorData);
      }
    } catch (error) {
      console.error("Error fetching quiz history:", error);
    } finally {
      setLoadingQuizHistory(false);
    }
  };


  const handleClose = () => {
    setCenterView("chat");
  };

  const handleQuizClick = (attemptId: number) => {
    setSelectedQuizAttempt(attemptId);
  };

  const handleBackToHistory = () => {
    setSelectedQuizAttempt(null);
  };

  // Show detailed quiz view if selected
  if (selectedQuizAttempt) {
    return <QuizHistoryDetail attemptId={selectedQuizAttempt} onBack={handleBackToHistory} />;
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Progress Dashboard</h1>
            <p className="text-muted-foreground">Track your learning journey and performance</p>
          </div>
          <Button onClick={handleClose} variant="outline" size="sm">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading progress data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Progress Dashboard</h1>
            <p className="text-muted-foreground">Track your learning journey and performance</p>
          </div>
          <Button onClick={handleClose} variant="outline" size="sm">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Progress Data</h3>
          <p className="text-muted-foreground">Take some quizzes to see your progress here.</p>
        </div>
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
        <div className="flex items-center gap-2">
          <Button onClick={fetchProgressData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleClose} variant="outline" size="sm">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
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


      {/* Quiz History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Quiz History</h3>
          <Button 
            onClick={fetchQuizHistory} 
            variant="outline" 
            size="sm"
            disabled={loadingQuizHistory}
          >
            {loadingQuizHistory ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
        
        {loadingQuizHistory ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            <span>Loading quiz history...</span>
          </div>
        ) : quizHistory.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No quiz attempts yet</p>
            <p className="text-sm text-muted-foreground">Take some quizzes to see your history here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizHistory.map((quiz) => (
              <div 
                key={quiz.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleQuizClick(quiz.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">{quiz.pdfName}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatDate(quiz.createdAt)}</span>
                      <span>•</span>
                      <span>{formatTime(quiz.timeTaken)}</span>
                      <span>•</span>
                      <span>
                        {quiz.questionTypes.mcq} MCQ, {quiz.questionTypes.saq} SAQ, {quiz.questionTypes.laq} LAQ
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={quiz.percentage >= 80 ? "default" : quiz.percentage >= 60 ? "secondary" : "destructive"}
                    >
                      {quiz.percentage}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {quiz.score}/{quiz.totalQuestions} correct
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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
