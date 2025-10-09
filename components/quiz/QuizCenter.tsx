"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { useQuizStore } from "@/store/quiz";
import { useUiStore } from "@/store/ui";
import { usePdfStore } from "@/store/pdf";
import { QuizConfig } from "./QuizConfig";
import { QuizResults } from "./QuizResults";
import { useState, useEffect } from "react";

export function QuizCenter() {
  const {
    currentQuiz,
    quizAnswers,
    quizResults,
    currentQuestionIndex,
    isSubmitting,
    setAnswer,
    setCurrentQuestionIndex,
    submitQuiz,
    resetQuiz
  } = useQuizStore();
  
  const { setCenterView } = useUiStore();
  const { jumpToPage, setRightPanelOpen } = usePdfStore();

  const [timeStarted, setTimeStarted] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Start timer when quiz begins
  useEffect(() => {
    if (currentQuiz && !quizResults && timeStarted === null) {
      setTimeStarted(Date.now());
    }
  }, [currentQuiz, quizResults, timeStarted]);

  // Update elapsed time
  useEffect(() => {
    if (timeStarted && !quizResults) {
      const interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - timeStarted) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timeStarted, quizResults]);

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswer(questionId, answer);
  };

  const handleNext = () => {
    if (currentQuiz && currentQuestionIndex < currentQuiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentQuiz) return;

    try {
      const response = await fetch("/api/quiz/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quizId: currentQuiz.id,
          answers: quizAnswers,
          timeTaken: timeElapsed
        })
      });

      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }

      const results = await response.json();
      submitQuiz(results);
    } catch (error) {
      console.error("Quiz submission error:", error);
      alert("Failed to submit quiz. Please try again.");
    }
  };

  const handleBackToChat = () => {
    resetQuiz();
    setCenterView("chat");
    setTimeStarted(null);
    setTimeElapsed(0);
  };

  const currentQuestion = currentQuiz?.questions[currentQuestionIndex];
  const progress = currentQuiz ? ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100 : 0;
  const isLastQuestion = currentQuestionIndex === (currentQuiz?.questions.length || 0) - 1;

  // Show quiz configuration if no quiz is active
  if (!currentQuiz && !quizResults) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={handleBackToChat}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
            <h1 className="text-2xl font-bold">Quiz Generator</h1>
            <p className="text-muted-foreground">Configure and generate a quiz from your selected PDF</p>
          </div>
          <QuizConfig />
        </div>
      </div>
    );
  }

  // Show quiz results
  if (quizResults) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={handleBackToChat}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
            <h1 className="text-2xl font-bold">Quiz Results</h1>
            <p className="text-muted-foreground">Review your performance and learn from feedback</p>
          </div>
          <QuizResults />
        </div>
      </div>
    );
  }

  // Show quiz taking interface
  if (currentQuiz) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={handleBackToChat}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Taking Quiz</h1>
                <p className="text-sm text-muted-foreground">{currentQuiz.pdfName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
              </div>
              <Badge variant="outline">
                Question {currentQuestionIndex + 1} of {currentQuiz.questions.length}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {currentQuestion && (
              <Card className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <Badge variant={currentQuestion.type === "mcq" ? "default" : currentQuestion.type === "saq" ? "secondary" : "outline"}>
                      {currentQuestion.type.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Page {currentQuestion.page}
                      {currentQuestion.lineStart && ` (Lines ${currentQuestion.lineStart}-${currentQuestion.lineEnd || currentQuestion.lineStart})`}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold">{currentQuestion.question}</h3>
                  
                  {/* MCQ Options */}
                  {currentQuestion.type === "mcq" && currentQuestion.options && (
                    <div className="space-y-2">
                      {currentQuestion.options.map((option, index) => (
                        <label key={index} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${currentQuestion.id}`}
                            value={option}
                            checked={quizAnswers[currentQuestion.id] === option}
                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* SAQ/LAQ Textarea */}
                  {(currentQuestion.type === "saq" || currentQuestion.type === "laq") && (
                    <div className="space-y-2">
                      <textarea
                        value={quizAnswers[currentQuestion.id] || ""}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        placeholder={
                          currentQuestion.type === "saq" 
                            ? "Provide a brief answer (2-3 sentences)..."
                            : "Provide a detailed answer (5-10 sentences)..."
                        }
                        className="w-full p-3 border rounded-lg resize-none"
                        rows={currentQuestion.type === "saq" ? 3 : 6}
                      />
                      <div className="text-xs text-muted-foreground">
                        {currentQuestion.type === "saq" ? "2-3 sentences expected" : "5-10 sentences expected"}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {isLastQuestion ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? "Submitting..." : "Submit Quiz"}
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
