import { getEnv } from "./env";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseServer } from "./supabaseServer";
import { embedText, searchChunks, RetrievedChunk } from "./rag";

export type QuizConfig = {
  mcq: number;
  saq: number;
  laq: number;
  difficulty: "easy" | "medium" | "hard" | "auto";
};

export type Question = {
  id: number;
  type: "mcq" | "saq" | "laq";
  question: string;
  options?: string[]; // For MCQ
  correctAnswer: string;
  explanation: string;
  page: number;
  lineStart?: number;
  lineEnd?: number;
  topic: string;
};

export type Quiz = {
  id: number;
  pdfId: number;
  config: QuizConfig;
  questions: Question[];
  createdAt: string;
};

export type QuizResults = {
  score: number;
  totalScore: number;
  percentage: number;
  feedback: Array<{
    questionId: number;
    correct: boolean;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    score: number;
  }>;
};

export type ProgressMetrics = {
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
};

// Generate quiz from PDF using RAG and Gemini
export async function generateQuizFromPDF(
  pdfId: number,
  config: QuizConfig
): Promise<{ quizId: number; questions: Question[] }> {
  const { geminiApiKey } = getEnv();
  if (!geminiApiKey) throw new Error("GEMINI_API missing");

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  // Get random chunks from PDF for context
  const randomQuery = "physics concepts laws principles formulas equations definitions examples problems solutions";
  const queryEmbedding = await embedText(randomQuery);
  if (!queryEmbedding) throw new Error("Failed to embed query");

  const chunks = await searchChunks(pdfId, queryEmbedding, 10, 10);
  if (chunks.length === 0) throw new Error("No content found in PDF");

  // Determine difficulty if auto
  let difficulty = config.difficulty;
  if (difficulty === "auto") {
    difficulty = await calculateDifficulty(pdfId);
  }

  // Build context for quiz generation
  const context = chunks.map((c, i) => 
    `[Chunk ${i + 1} | Page ${c.page}${c.line_start ? `, Lines ${c.line_start}-${c.line_end || c.line_start}` : ''}]\n${c.text}`
  ).join("\n\n");

  const systemPrompt = `You are an expert physics tutor creating educational quizzes. Generate questions based ONLY on the provided PDF content. Each question must be directly answerable from the given context.

Requirements:
- MCQ: 4 options, only one correct
- SAQ: 2-3 sentence answers expected
- LAQ: 5-10 sentence answers expected
- Include page citations for each question
- Extract topic from question content
- Provide clear explanations
- Ensure questions test understanding, not memorization

Return JSON format:
{
  "questions": [
    {
      "type": "mcq|saq|laq",
      "question": "string",
      "options": ["string"] (only for MCQ),
      "correctAnswer": "string",
      "explanation": "string",
      "page": number,
      "lineStart": number (optional),
      "lineEnd": number (optional),
      "topic": "string"
    }
  ]
}`;

  const userPrompt = `Generate a quiz with:
- ${config.mcq} MCQ questions
- ${config.saq} SAQ questions  
- ${config.laq} LAQ questions
- Difficulty: ${difficulty}

PDF Content:
${context}

Focus on key physics concepts, laws, and principles from the content.`;

  try {
    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in response");
    
    const quizData = JSON.parse(jsonMatch[0]);
    
    // Validate and format questions
    const questions: Question[] = quizData.questions.map((q: any, index: number) => ({
      id: index + 1,
      type: q.type,
      question: q.question,
      options: q.options || undefined,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      page: q.page || 1,
      lineStart: q.lineStart || undefined,
      lineEnd: q.lineEnd || undefined,
      topic: q.topic || "General"
    }));

    // Store quiz in database
    const { data: quiz, error } = await supabaseServer
      .from("quizzes")
      .insert({
        owner_id: 1, // Will be set by API
        pdf_id: pdfId,
        config: {
          ...config,
          difficulty,
          questions
        }
      })
      .select("id")
      .single();

    if (error) throw new Error(`Database error: ${error.message}`);

    return {
      quizId: quiz.id,
      questions
    };
  } catch (error) {
    console.error("Quiz generation error:", error);
    throw new Error("Failed to generate quiz");
  }
}

// Evaluate MCQ answers
export function evaluateMCQ(userAnswer: string, correctAnswer: string): { correct: boolean; score: number } {
  const normalizedUser = userAnswer.trim().toLowerCase();
  const normalizedCorrect = correctAnswer.trim().toLowerCase();
  
  return {
    correct: normalizedUser === normalizedCorrect,
    score: normalizedUser === normalizedCorrect ? 1 : 0
  };
}

// Evaluate SAQ answers (hybrid approach)
export async function evaluateSAQ(
  userAnswer: string,
  correctAnswer: string,
  question: string
): Promise<{ correct: boolean; score: number; feedback: string }> {
  const { geminiApiKey } = getEnv();
  if (!geminiApiKey) {
    // Fallback to keyword matching only
    const keywordScore = calculateKeywordScore(userAnswer, correctAnswer);
    return {
      correct: keywordScore > 0.5,
      score: keywordScore,
      feedback: keywordScore > 0.5 ? "Good answer" : "Incorrect or incomplete"
    };
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = `Evaluate this short answer question:

Question: ${question}
Correct Answer: ${correctAnswer}
Student Answer: ${userAnswer}

Rate the student's answer on a scale of 0-1 where:
- 1.0 = Perfect answer, covers all key points
- 0.8-0.9 = Good answer, minor details missing
- 0.6-0.7 = Partially correct, some key points covered
- 0.4-0.5 = Some understanding, major gaps
- 0.0-0.3 = Incorrect or very incomplete

Consider:
- Key concepts mentioned
- Accuracy of information
- Completeness of answer
- Clarity of expression

Return JSON: {"score": number, "feedback": "string"}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in evaluation");
    
    const evaluation = JSON.parse(jsonMatch[0]);
    
    return {
      correct: evaluation.score >= 0.6,
      score: Math.max(0, Math.min(1, evaluation.score)),
      feedback: evaluation.feedback || "No feedback provided"
    };
  } catch (error) {
    console.error("SAQ evaluation error:", error);
    // Fallback to keyword matching
    const keywordScore = calculateKeywordScore(userAnswer, correctAnswer);
    return {
      correct: keywordScore > 0.5,
      score: keywordScore,
      feedback: "Evaluation completed using keyword matching"
    };
  }
}

// Evaluate LAQ answers (full Gemini analysis)
export async function evaluateLAQ(
  userAnswer: string,
  correctAnswer: string,
  question: string
): Promise<{ correct: boolean; score: number; feedback: string }> {
  const { geminiApiKey } = getEnv();
  if (!geminiApiKey) {
    const keywordScore = calculateKeywordScore(userAnswer, correctAnswer);
    return {
      correct: keywordScore > 0.6,
      score: keywordScore,
      feedback: "Evaluation completed using keyword matching"
    };
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = `Evaluate this long answer question using a detailed rubric:

Question: ${question}
Model Answer: ${correctAnswer}
Student Answer: ${userAnswer}

Rubric (40/40/20):
- Content (40%): Accuracy, depth, key concepts covered
- Clarity (40%): Organization, explanation quality, logical flow
- Completeness (20%): Addresses all parts of question

Rate each dimension 0-1, then calculate weighted average.

Return JSON: {
  "contentScore": number,
  "clarityScore": number, 
  "completenessScore": number,
  "overallScore": number,
  "feedback": "Detailed feedback string"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in evaluation");
    
    const evaluation = JSON.parse(jsonMatch[0]);
    
    return {
      correct: evaluation.overallScore >= 0.6,
      score: Math.max(0, Math.min(1, evaluation.overallScore)),
      feedback: evaluation.feedback || "No detailed feedback provided"
    };
  } catch (error) {
    console.error("LAQ evaluation error:", error);
    const keywordScore = calculateKeywordScore(userAnswer, correctAnswer);
    return {
      correct: keywordScore > 0.6,
      score: keywordScore,
      feedback: "Evaluation completed using keyword matching"
    };
  }
}

// Calculate difficulty based on user's past performance
async function calculateDifficulty(pdfId: number): Promise<"easy" | "medium" | "hard"> {
  if (!supabaseServer) return "medium";

  try {
    // Get user's last 5 quiz attempts for this PDF
    const { data: attempts } = await supabaseServer
      .from("quiz_attempts")
      .select("score, details")
      .eq("quiz_id", pdfId) // This should be quiz_id, not pdf_id
      .order("created_at", { ascending: false })
      .limit(5);

    if (!attempts || attempts.length === 0) return "medium";

    const avgScore = attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / attempts.length;

    if (avgScore >= 0.8) return "hard";
    if (avgScore >= 0.6) return "medium";
    return "easy";
  } catch (error) {
    console.error("Difficulty calculation error:", error);
    return "medium";
  }
}

// Calculate keyword matching score
function calculateKeywordScore(userAnswer: string, correctAnswer: string): number {
  const userWords = userAnswer.toLowerCase().split(/\s+/);
  const correctWords = correctAnswer.toLowerCase().split(/\s+/);
  
  const commonWords = userWords.filter(word => correctWords.includes(word));
  return commonWords.length / Math.max(userWords.length, correctWords.length);
}

// Get user progress metrics
export async function getUserProgress(userId: number): Promise<ProgressMetrics> {
  if (!supabaseServer) {
    return {
      totalQuizzes: 0,
      averageScore: 0,
      streak: 0,
      topicScores: {},
      lastQuizDate: "",
      accuracyByTopic: {},
      averageTimePerQuestion: 0,
      masteryScore: 0,
      consistency: 0,
      completionRate: 0,
      totalEngagementTime: 0
    };
  }

  try {
    // Get all quiz attempts for user
    const { data: attempts } = await supabaseServer
      .from("quiz_attempts")
      .select(`
        score,
        details,
        created_at,
        quiz:quizzes(config)
      `)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (!attempts || attempts.length === 0) {
      return {
        totalQuizzes: 0,
        averageScore: 0,
        streak: 0,
        topicScores: {},
        lastQuizDate: "",
        accuracyByTopic: {},
        averageTimePerQuestion: 0,
        masteryScore: 0,
        consistency: 0,
        completionRate: 0,
        totalEngagementTime: 0
      };
    }

    // Calculate basic metrics
    const totalQuizzes = attempts.length;
    const scores = attempts.map(a => a.score || 0);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calculate streak
    let streak = 0;
    const today = new Date();
    for (const attempt of attempts) {
      const attemptDate = new Date(attempt.created_at);
      const daysDiff = Math.floor((today.getTime() - attemptDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === streak) {
        streak++;
      } else {
        break;
      }
    }

    // Calculate topic scores
    const topicScores: Record<string, number[]> = {};
    const accuracyByTopic: Record<string, number> = {};
    
    attempts.forEach(attempt => {
      const config = attempt.quiz?.config;
      if (config?.questions) {
        config.questions.forEach((q: Question) => {
          if (!topicScores[q.topic]) {
            topicScores[q.topic] = [];
          }
          topicScores[q.topic].push(attempt.score || 0);
        });
      }
    });

    Object.keys(topicScores).forEach(topic => {
      const topicAttempts = topicScores[topic];
      accuracyByTopic[topic] = topicAttempts.reduce((sum, score) => sum + score, 0) / topicAttempts.length;
    });

    // Calculate other metrics
    const timeTaken = attempts.map(a => a.details?.timeTaken || 0);
    const averageTimePerQuestion = timeTaken.length > 0 ? timeTaken.reduce((sum, time) => sum + time, 0) / timeTaken.length : 0;
    
    // Mastery score (weighted average of recent attempts)
    const recentAttempts = attempts.slice(0, 5);
    const masteryScore = recentAttempts.length > 0 
      ? recentAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / recentAttempts.length 
      : 0;

    // Consistency (inverse of standard deviation)
    const mean = averageScore;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const consistency = 1 - Math.sqrt(variance);

    // Completion rate (assuming all started quizzes are completed)
    const completionRate = 1.0;

    // Total engagement time
    const totalEngagementTime = timeTaken.reduce((sum, time) => sum + time, 0);

    return {
      totalQuizzes,
      averageScore,
      streak,
      topicScores: accuracyByTopic,
      lastQuizDate: attempts[0]?.created_at || "",
      accuracyByTopic,
      averageTimePerQuestion,
      masteryScore,
      consistency: Math.max(0, consistency),
      completionRate,
      totalEngagementTime
    };
  } catch (error) {
    console.error("Progress calculation error:", error);
    return {
      totalQuizzes: 0,
      averageScore: 0,
      streak: 0,
      topicScores: {},
      lastQuizDate: "",
      accuracyByTopic: {},
      averageTimePerQuestion: 0,
      masteryScore: 0,
      consistency: 0,
      completionRate: 0,
      totalEngagementTime: 0
    };
  }
}
