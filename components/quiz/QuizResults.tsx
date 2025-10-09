"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, BookOpen } from "lucide-react";
import { useQuizStore } from "@/store/quiz";
import { usePdfStore } from "@/store/pdf";
import { useUiStore } from "@/store/ui";

export function QuizResults() {
  const { quizResults, currentQuiz, resetQuiz } = useQuizStore();
  const { jumpToPage } = usePdfStore();
  const { setCenterView } = useUiStore();

  if (!quizResults || !currentQuiz) return null;

  const handleJumpToPage = (page: number) => {
    try {
      if (typeof jumpToPage === 'function') {
        const pageZeroBased = Math.max(0, page - 1);
        jumpToPage(pageZeroBased);
        // Open right panel via UI store if required elsewhere
      }
    } catch (error) {
      console.error("Jump to page error:", error);
    }
  };

  const handleNewQuiz = () => {
    resetQuiz();
  };

  const handleRegenerateQuiz = async () => {
    // Reset quiz and go back to quiz config
    resetQuiz();
  };

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-4xl font-bold text-primary">
            {quizResults.percentage}%
          </div>
          <div className="text-lg text-muted-foreground">
            {quizResults.score} out of {quizResults.totalScore} questions correct
          </div>
          <div className="flex justify-center">
            <Badge 
              variant={quizResults.percentage >= 80 ? "default" : quizResults.percentage >= 60 ? "secondary" : "destructive"}
              className="text-sm"
            >
              {quizResults.percentage >= 80 ? "Excellent!" : 
               quizResults.percentage >= 60 ? "Good Job!" : "Keep Practicing!"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Question-by-Question Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Question Review</h3>
        <div className="space-y-4">
          {quizResults.feedback.map((item, index) => {
            const question = currentQuiz.questions.find(q => q.id === item.questionId);
            if (!question) return null;

            return (
              <div key={item.questionId} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Question {index + 1}</span>
                    <Badge variant={question.type === "mcq" ? "default" : question.type === "saq" ? "secondary" : "outline"}>
                      {question.type.toUpperCase()}
                    </Badge>
                    {item.correct ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round(item.score * 100)}%
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-medium">{question.question}</p>
                  
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-green-700">Your Answer:</span>
                      <p className="text-sm bg-green-50 p-2 rounded">{item.userAnswer || "No answer provided"}</p>
                    </div>
                    
                    {!item.correct && (
                      <div>
                        <span className="text-sm font-medium text-blue-700">Correct Answer:</span>
                        <p className="text-sm bg-blue-50 p-2 rounded">{item.correctAnswer}</p>
                      </div>
                    )}
                    
                    <div>
                      <span className="text-sm font-medium">Explanation:</span>
                      <p className="text-sm bg-gray-50 p-2 rounded">{item.explanation}</p>
                    </div>

                    {item.feedback && (
                      <div>
                        <span className="text-sm font-medium">Feedback:</span>
                        <p className="text-sm bg-yellow-50 p-2 rounded">{item.feedback}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleJumpToPage(question.page)}
                        className="text-xs"
                      >
                        <BookOpen className="h-3 w-3 mr-1" />
                        View Page {question.page}
                        {question.lineStart && ` (Lines ${question.lineStart}-${question.lineEnd || question.lineStart})`}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <Button onClick={handleNewQuiz} variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button onClick={handleRegenerateQuiz}>
          Generate New Quiz
        </Button>
      </div>
    </div>
  );
}
