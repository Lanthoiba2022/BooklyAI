"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { useQuizStore } from "@/store/quiz";
import { QuizConfig } from "./QuizConfig";
import { QuizResults } from "./QuizResults";
import { useState, useEffect } from "react";

export function QuizModal() {
  const {
    isQuizModalOpen,
    currentQuiz,
    quizAnswers,
    quizResults,
    currentQuestionIndex,
    isSubmitting,
    toggleQuizModal,
    setAnswer,
    setCurrentQuestionIndex,
    submitQuiz,
    resetQuiz
  } = useQuizStore();

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

  const handleClose = () => {
    if (quizResults) {
      resetQuiz();
    }
    toggleQuizModal(false);
    setTimeStarted(null);
    setTimeElapsed(0);
  };

  const currentQuestion = currentQuiz?.questions[currentQuestionIndex];
  const progress = currentQuiz ? ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100 : 0;
  const isLastQuestion = currentQuestionIndex === (currentQuiz?.questions.length || 0) - 1;

  return (
    <Dialog open={isQuizModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {quizResults ? "Quiz Results" : currentQuiz ? "Taking Quiz" : "Quiz Configuration"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quiz Configuration */}
          {!currentQuiz && !quizResults && <QuizConfig />}

          {/* Quiz Taking */}
          {currentQuiz && !quizResults && (
            <>
              {/* Progress Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Question {currentQuestionIndex + 1} of {currentQuiz.questions.length}
                    </Badge>
                    <Badge variant={currentQuestion?.type === "mcq" ? "default" : currentQuestion?.type === "saq" ? "secondary" : "outline"}>
                      {currentQuestion?.type.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Question */}
              {currentQuestion && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">{currentQuestion.question}</h3>
                    
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

                  {/* Navigation */}
                  <div className="flex justify-between">
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
              )}
            </>
          )}

          {/* Quiz Results */}
          {quizResults && <QuizResults />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
