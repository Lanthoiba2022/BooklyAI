import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { generateQuizFromPDF, QuizConfig } from "@/lib/quiz";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type GenerateQuizBody = {
  pdfId: number;
  config: QuizConfig;
};

export async function POST(req: NextRequest) {
  const { user } = await getAuthenticatedUserFromCookies(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const dbUser = await ensureUserProvisioned(user as any);
  if (!dbUser) {
    return NextResponse.json({ error: "User not provisioned" }, { status: 500 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const body: GenerateQuizBody = await req.json();
    const { pdfId, config } = body;

    if (!pdfId || !config) {
      return NextResponse.json({ error: "Missing pdfId or config" }, { status: 400 });
    }

    // Validate config
    if (config.mcq < 0 || config.saq < 0 || config.laq < 0) {
      return NextResponse.json({ error: "Invalid question counts" }, { status: 400 });
    }

    if (config.mcq + config.saq + config.laq === 0) {
      return NextResponse.json({ error: "At least one question type required" }, { status: 400 });
    }

    // Check PDF ownership and status
    const { data: pdf } = await supabaseServer
      .from("pdfs")
      .select("id, owner_id, status")
      .eq("id", pdfId)
      .eq("owner_id", dbUser.id)
      .eq("status", "ready")
      .single();

    if (!pdf) {
      return NextResponse.json({ error: "PDF not found or not ready" }, { status: 404 });
    }

    // Check if PDF has been processed and has chunks
    console.log(`Checking chunks for PDF ${pdfId}...`);
    const { data: chunks, error: chunksError } = await supabaseServer
      .from("chunks")
      .select("id, text")
      .eq("pdf_id", pdfId)
      .limit(5);

    if (chunksError) {
      console.error("Error checking chunks:", chunksError);
      return NextResponse.json({ error: "Failed to verify PDF content" }, { status: 500 });
    }

    console.log(`Found ${chunks?.length || 0} chunks for PDF ${pdfId}`);
    if (chunks && chunks.length > 0) {
      console.log("Sample chunk text:", chunks[0].text?.substring(0, 100) + "...");
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ 
        error: "PDF has not been processed yet or contains no extractable text. Please wait for processing to complete or try uploading a different PDF." 
      }, { status: 400 });
    }

    // Generate quiz
    const result = await generateQuizFromPDF(pdfId, config);

    // Update the quiz with correct owner_id
    await supabaseServer
      .from("quizzes")
      .update({ owner_id: dbUser.id })
      .eq("id", result.quizId);

    return NextResponse.json({
      quizId: result.quizId,
      questions: result.questions
    });

  } catch (error: any) {
    console.error("Quiz generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
