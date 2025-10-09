import { getEnv } from "./env";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseServer } from "./supabaseServer";
import { embedText, searchChunks, RetrievedChunk } from "./rag";

// Utility function to safely parse JSON from Gemini responses
function safeParseJSON(text: string): any {
  // Try multiple strategies to extract and parse JSON
  
  // Strategy 1: Look for JSON object boundaries
  let jsonText = text;
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    jsonText = text.substring(jsonStart, jsonEnd + 1);
  } else {
    throw new Error("No valid JSON found in response");
  }
  
  // Strategy 2: Try parsing as-is first
  try {
    return JSON.parse(jsonText);
  } catch (firstError) {
    console.log("First JSON parse attempt failed, trying cleanup...");
  }
  
  // Strategy 3: Clean up common JSON issues (fixed - removed problematic \b replacement)
  let cleanedJson = jsonText
    .replace(/\n/g, '\\n')   // Convert newlines to escaped
    .replace(/\t/g, '\\t')   // Convert tabs to escaped
    .replace(/\r/g, '\\r')   // Convert carriage returns to escaped
    .replace(/\f/g, '\\f')   // Convert form feeds to escaped
    .replace(/\v/g, '\\v');  // Convert vertical tabs to escaped
  
  try {
    return JSON.parse(cleanedJson);
  } catch (secondError) {
    console.log("Second JSON parse attempt failed, trying regex extraction...");
  }
  
  // Strategy 4: Use regex to extract JSON more aggressively
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (thirdError) {
      console.log("Third JSON parse attempt failed");
    }
  }
  
  // Strategy 5: Try to fix common issues manually
  try {
    let fixedJson = jsonText
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
      .replace(/:\s*([^",{\[\s][^,}]*?)(\s*[,}])/g, ': "$1"$2') // Quote unquoted string values
      .replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":') // Escape quotes in string values
      .replace(/"([^"]*)"([^"]*)"([^"]*)"/g, '"$1\\"$2\\"$3"'); // Escape quotes in standalone strings
    
    return JSON.parse(fixedJson);
  } catch (finalError) {
    console.error("All JSON parsing strategies failed");
    console.error("Original text:", text);
    console.error("Extracted JSON:", jsonText);
    console.error("Cleaned JSON:", cleanedJson);
    throw new Error(`JSON parsing failed after all strategies: ${finalError}`);
  }
}

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
  if (!supabaseServer) throw new Error("Server not configured");

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  // Get random chunks from PDF for context
  const randomQuery = "physics concepts laws principles formulas equations definitions examples problems solutions";
  const queryEmbedding = await embedText(randomQuery);
  if (!queryEmbedding) throw new Error("Failed to embed query");

  let chunks: RetrievedChunk[] = await searchChunks(pdfId, queryEmbedding, 10, 10) as RetrievedChunk[];
  
  // If no chunks found, try to get any chunks from the PDF
  if (chunks.length === 0) {
    console.log(`No chunks found for PDF ${pdfId}, trying to get any available chunks...`);
    
    // Try a broader search with different queries
    const fallbackQueries = [
      "text content information data",
      "chapter section paragraph",
      "content material information"
    ];
    
    for (const query of fallbackQueries) {
      const fallbackEmbedding = await embedText(query);
      if (fallbackEmbedding) {
        chunks = await searchChunks(pdfId, fallbackEmbedding, 10, 10);
        if (chunks.length > 0) {
          console.log(`Found ${chunks.length} chunks using fallback query: ${query}`);
          break;
        }
      }
    }
    
    // If still no chunks, try to get chunks directly from database
    if (chunks.length === 0 && supabaseServer) {
      console.log(`Trying direct database query for PDF ${pdfId}...`);
      const { data: directChunks, error } = await supabaseServer
        .from("chunks")
        .select("*")
        .eq("pdf_id", pdfId)
        .limit(10);
      
      if (error) {
        console.error("Direct chunk query error:", error);
      } else if (directChunks && directChunks.length > 0) {
        chunks = (directChunks as unknown as RetrievedChunk[]) || [];
        console.log(`Found ${chunks.length} chunks via direct query`);
      }
    }
    
    if (chunks.length === 0) {
      throw new Error(`No content found in PDF. The PDF may not be processed yet or may not contain extractable text. Please ensure the PDF is uploaded and processed successfully.`);
    }
  }

  // Determine difficulty if auto
  let difficulty = config.difficulty;
  if (difficulty === "auto") {
    difficulty = await calculateDifficulty(pdfId);
  }

  // Build context for quiz generation
  const context = chunks.map((c: RetrievedChunk, i: number) => 
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
    
    const quizData = safeParseJSON(text);
    
    // Validate and format questions
    // Fetch page_count to clamp page numbers into valid range
    let pageCount: number | null = null;
    if (supabaseServer) {
      try {
        const { data: pdfRow } = await supabaseServer
          .from("pdfs")
          .select("page_count")
          .eq("id", pdfId)
          .maybeSingle();
        pageCount = (pdfRow as any)?.page_count ?? null;
      } catch {}
    }

    const clampPage = (p: number | undefined | null): number => {
      const page = typeof p === 'number' && isFinite(p) ? Math.floor(p) : 1;
      if (pageCount && pageCount > 0) {
        return Math.max(1, Math.min(page, pageCount));
      }
      return Math.max(1, page);
    };

    const questions: Question[] = quizData.questions.map((q: any, index: number) => ({
      id: index + 1,
      type: q.type,
      question: q.question,
      options: q.options || undefined,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      page: clampPage(q.page),
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
    
    const evaluation = safeParseJSON(text);
    
    // Validate the response structure
    if (typeof evaluation.score !== 'number' || 
        evaluation.score < 0 || evaluation.score > 1) {
      throw new Error("Invalid score in evaluation");
    }
    
    // Convert to whole number: 50%+ = 1 (correct), <50% = 0 (incorrect)
    const isCorrect = evaluation.score >= 0.5;
    return {
      correct: isCorrect,
      score: isCorrect ? 1 : 0,
      feedback: evaluation.feedback || "No feedback provided"
    };
  } catch (error) {
    console.error("SAQ evaluation error:", error);
    // Fallback to keyword matching
    const keywordScore = calculateKeywordScore(userAnswer, correctAnswer);
    // Convert to whole number: 50%+ = 1 (correct), <50% = 0 (incorrect)
    const isCorrect = keywordScore >= 0.5;
    return {
      correct: isCorrect,
      score: isCorrect ? 1 : 0,
      feedback: "Evaluation completed using keyword matching due to parsing error"
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
    
    const evaluation = safeParseJSON(text);
    
    // Validate the response structure
    if (typeof evaluation.overallScore !== 'number' || 
        evaluation.overallScore < 0 || evaluation.overallScore > 1) {
      throw new Error("Invalid overallScore in evaluation");
    }
    
    // Convert to whole number: 50%+ = 1 (correct), <50% = 0 (incorrect)
    const isCorrect = evaluation.overallScore >= 0.5;
    return {
      correct: isCorrect,
      score: isCorrect ? 1 : 0,
      feedback: evaluation.feedback || "No detailed feedback provided"
    };
  } catch (error) {
    console.error("LAQ evaluation error:", error);
    const keywordScore = calculateKeywordScore(userAnswer, correctAnswer);
    // Convert to whole number: 50%+ = 1 (correct), <50% = 0 (incorrect)
    const isCorrect = keywordScore >= 0.5;
    return {
      correct: isCorrect,
      score: isCorrect ? 1 : 0,
      feedback: "Evaluation completed using keyword matching due to parsing error"
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
    // Convert each attempt to a percentage (0-100) based on its total questions
    const attemptPercentages = attempts.map((a: any) => {
      const totalQuestions = a?.quiz?.config?.questions?.length || 0;
      const rawScore = a.score || 0;
      return totalQuestions > 0 ? (rawScore / totalQuestions) * 100 : 0;
    });
    const averageScore = attemptPercentages.reduce((sum: number, pct: number) => sum + pct, 0) / attemptPercentages.length;
    
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
    
    attempts.forEach((attempt: any) => {
      const config = attempt?.quiz?.config;
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
      ? recentAttempts.reduce((sum: number, attempt: any) => {
          const totalQuestions = attempt?.quiz?.config?.questions?.length || 0;
          const rawScore = attempt.score || 0;
          const pct = totalQuestions > 0 ? (rawScore / totalQuestions) * 100 : 0;
          return sum + pct;
        }, 0) / recentAttempts.length
      : 0;

    // Consistency (inverse of standard deviation)
    const mean = averageScore;
    const variance = attemptPercentages.reduce((sum: number, pct: number) => sum + Math.pow(pct - mean, 2), 0) / attemptPercentages.length;
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
