"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuizStore, type QuizConfig } from "@/store/quiz";
import { usePdfStore } from "@/store/pdf";
import { useState } from "react";

export function QuizConfig() {
  const { config, setConfig, setGenerating, setCurrentQuiz } = useQuizStore();
  const { current } = usePdfStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateQuiz = async () => {
    if (!current?.id) {
      alert("Please select a PDF first");
      return;
    }

    setIsGenerating(true);
    setGenerating(true);

    try {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pdfId: current.id,
          config
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate quiz");
      }

      const data = await response.json();
      setCurrentQuiz({
        id: data.quizId,
        pdfId: current.id,
        pdfName: current.name,
        config,
        questions: data.questions,
        createdAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Quiz generation error:", error);
      const errorMessage = error.message || "Failed to generate quiz. Please try again.";
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
      setGenerating(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Quiz Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure your quiz settings and generate questions from the selected PDF.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mcq">Multiple Choice Questions</Label>
            <Input
              id="mcq"
              type="number"
              min="0"
              max="20"
              value={config.mcq}
              onChange={(e) => setConfig({ mcq: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="saq">Short Answer Questions</Label>
            <Input
              id="saq"
              type="number"
              min="0"
              max="10"
              value={config.saq}
              onChange={(e) => setConfig({ saq: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="laq">Long Answer Questions</Label>
            <Input
              id="laq"
              type="number"
              min="0"
              max="5"
              value={config.laq}
              onChange={(e) => setConfig({ laq: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={config.difficulty}
              onValueChange={(value: "easy" | "medium" | "hard" | "auto") => 
                setConfig({ difficulty: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="auto">Auto (Recommended)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleGenerateQuiz}
            disabled={isGenerating || !current?.id || (config.mcq + config.saq + config.laq === 0)}
            className="w-full"
          >
            {isGenerating ? "Generating Quiz..." : "Generate Quiz"}
          </Button>
        </div>

        {!current?.id && (
          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
            Please select a PDF from the files panel to generate a quiz.
          </div>
        )}
      </div>
    </Card>
  );
}
