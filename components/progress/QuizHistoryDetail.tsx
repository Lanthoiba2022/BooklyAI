"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  BookOpen,
  Calendar,
  Target,
  RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";

type DetailedQuiz = {
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
  questions: Array<{
    id: number;
    type: "mcq" | "saq" | "laq";
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    page: number;
    lineStart?: number;
    lineEnd?: number;
    topic: string;
    userAnswer: string;
    isCorrect: boolean;
    score: number;
    feedback: string;
  }>;
};

interface QuizHistoryDetailProps {
  attemptId: number;
  onBack: () => void;
}

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

export function QuizHistoryDetail({ attemptId, onBack }: QuizHistoryDetailProps) {
  const [quiz, setQuiz] = useState<DetailedQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [weaknessData, setWeaknessData] = useState<WeaknessData | null>(null);
  const [showYouTube, setShowYouTube] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [loadingYouTube, setLoadingYouTube] = useState(false);

  useEffect(() => {
    fetchQuizDetails();
    fetchWeaknessData();
    loadPersistentYouTubeVideos();
  }, [attemptId]);

  const fetchQuizDetails = async () => {
    try {
      const response = await fetch(`/api/progress/quiz-history/${attemptId}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setQuiz(data);
      }
    } catch (error) {
      console.error("Error fetching quiz details:", error);
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

  const loadPersistentYouTubeVideos = async () => {
    try {
      const response = await fetch(`/api/youtube/quiz-specific/persistent?quizAttemptId=${attemptId}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        if (data.recommendations && data.recommendations.length > 0) {
          setYoutubeVideos(data.recommendations);
          setShowYouTube(true);
        }
      }
    } catch (error) {
      console.error("Error loading persistent YouTube videos:", error);
    }
  };

  const fetchYouTubeRecommendations = async () => {
    if (showYouTube) return; // Already showing

    setLoadingYouTube(true);
    try {
      const response = await fetch(`/api/youtube/quiz-specific?quizAttemptId=${attemptId}&maxResults=5`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        const videos = data.recommendations || [];
        setYoutubeVideos(videos);
        setShowYouTube(true);
        // Videos are automatically saved to database by the API
      }
    } catch (error) {
      console.error("Error fetching YouTube recommendations:", error);
    } finally {
      setLoadingYouTube(false);
    }
  };

  const handleVideoClick = (videoUrl: string, videoId: string) => {
    // Track video click interaction
    fetch("/api/youtube", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        videoId: videoId,
        interactionType: "clicked"
      })
    }).catch(error => {
      console.error("Error tracking video click:", error);
    });

    // Open video in new tab
    window.open(videoUrl, "_blank", "noopener,noreferrer");
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quiz Details</h1>
            <p className="text-muted-foreground">Loading quiz information...</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quiz Details</h1>
            <p className="text-muted-foreground">Quiz not found</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Unable to load quiz details</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quiz Details</h1>
          <p className="text-muted-foreground">{quiz.pdfName}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to History
        </Button>
      </div>

      {/* Quiz Summary */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{quiz.percentage}%</div>
            <div className="text-sm text-muted-foreground">Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{quiz.score}/{quiz.totalQuestions}</div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{formatTime(quiz.timeTaken)}</div>
            <div className="text-sm text-muted-foreground">Time Taken</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{formatDate(quiz.createdAt)}</div>
            <div className="text-sm text-muted-foreground">Date</div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Question Types</span>
            <span>{quiz.questionTypes.mcq} MCQ • {quiz.questionTypes.saq} SAQ • {quiz.questionTypes.laq} LAQ</span>
          </div>
          <Progress value={quiz.percentage} className="h-2" />
        </div>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {quiz.questions.map((question, index) => (
          <Card key={question.id} className="p-6">
            <div className="space-y-4">
              {/* Question Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={question.type === "mcq" ? "default" : question.type === "saq" ? "secondary" : "outline"}>
                    {question.type.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Question {index + 1}
                  </span>
                  {question.page && (
                    <span className="text-sm text-muted-foreground">
                      • Page {question.page}
                      {question.lineStart && ` (Lines ${question.lineStart}-${question.lineEnd || question.lineStart})`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {question.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <Badge variant={question.isCorrect ? "default" : "destructive"}>
                    {Math.round(question.score * 100)}%
                  </Badge>
                </div>
              </div>

              {/* Question */}
              <h3 className="text-lg font-semibold">{question.question}</h3>

              {/* MCQ Options */}
              {question.type === "mcq" && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`p-3 border rounded-lg ${
                        option === question.correctAnswer
                          ? "bg-green-50 border-green-200"
                          : option === question.userAnswer && !question.isCorrect
                          ? "bg-red-50 border-red-200"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {option === question.correctAnswer && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        {option === question.userAnswer && !question.isCorrect && (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm">{option}</span>
                        {option === question.correctAnswer && (
                          <Badge variant="outline" className="text-xs">Correct</Badge>
                        )}
                        {option === question.userAnswer && !question.isCorrect && (
                          <Badge variant="destructive" className="text-xs">Your Answer</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SAQ/LAQ Answers */}
              {(question.type === "saq" || question.type === "laq") && (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Your Answer:</div>
                    <div className="p-3 border rounded-lg bg-gray-50">
                      <p className="text-sm">{question.userAnswer || "No answer provided"}</p>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Correct Answer:</div>
                    <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                      <p className="text-sm">{question.correctAnswer}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Explanation */}
              {question.explanation && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Explanation:</div>
                  <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                    <p className="text-sm">{question.explanation}</p>
                  </div>
                </div>
              )}

              {/* Detailed Feedback */}
              {question.feedback && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Detailed Feedback:</div>
                  <div className="p-3 border rounded-lg bg-yellow-50 border-yellow-200">
                    <p className="text-sm">{question.feedback}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Areas for Improvement */}
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
              Get Quiz-Specific Videos
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
                {youtubeVideos.map((video, index) => (
                  <div 
                    key={video.id || `${video.videoId}-${index}`} 
                    className="border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow duration-200 hover:border-blue-300"
                    onClick={() => handleVideoClick(video.videoUrl || `https://www.youtube.com/watch?v=${video.videoId}`, video.videoId)}
                  >
                    <div className="aspect-video bg-gray-100 rounded mb-2 flex items-center justify-center relative group">
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          // Fallback to YouTube's default thumbnail if the original fails
                          const target = e.target as HTMLImageElement;
                          target.src = `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
                        }}
                      />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <h5 className="font-medium text-sm line-clamp-2 mb-1 hover:text-blue-600 transition-colors">{video.title}</h5>
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
    </div>
  );
}
