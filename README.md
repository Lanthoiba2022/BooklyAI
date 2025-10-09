# Bookly AI

<p align="center">
  <img src="./public/Booklylogofinal1.png" alt="Bookly AI" height="120" />
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white&style=for-the-badge" alt="Next.js"/></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-222222?logo=react&logoColor=61DAFB&style=for-the-badge" alt="React"/></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-0F172A?logo=tailwindcss&logoColor=06B6D4&style=for-the-badge" alt="Tailwind CSS"/></a>
  <a href="https://ui.shadcn.com"><img src="https://img.shields.io/badge/shadcn%2Fui-111111?style=for-the-badge" alt="shadcn/ui"/></a>
  <a href="https://www.radix-ui.com"><img src="https://img.shields.io/badge/Radix_UI-161618?style=for-the-badge" alt="Radix UI"/></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-1A1F2B?logo=supabase&logoColor=3FCF8E&style=for-the-badge" alt="Supabase"/></a>
  <a href="https://ai.google.dev"><img src="https://img.shields.io/badge/Google_Gemini-2B2D31?style=for-the-badge" alt="Google Gemini"/></a>
  <a href="https://developers.google.com/youtube"><img src="https://img.shields.io/badge/YouTube_API-0F0F0F?logo=youtube&logoColor=FF0000&style=for-the-badge" alt="YouTube API"/></a>
  <a href="https://zustand-demo.pmnd.rs/"><img src="https://img.shields.io/badge/Zustand-222222?style=for-the-badge" alt="Zustand"/></a>
</p>

Bookly AI is an AI-powered study assistant that lets you upload PDFs, chat with retrieval-augmented answers, generate quizzes, review progress, and explore related YouTube content. It uses Supabase for authentication and persistence, Google Gemini for generation, and a lightweight RAG pipeline for grounded responses.

## Highlights
- **Chat with RAG**: Ask questions; answers cite relevant PDF pages when available.
- **PDF ingestion**: Upload, parse, embed, and search your documents.
- **Quizzes and progress**: Generate quizzes, track attempts, view weaknesses and dashboard.
- **YouTube suggestions**: Surface related topics and recommended videos.
- **Auth & sessions**: Supabase auth with middleware-protected routes.

## User Flow

```mermaid
graph TD
    Start([Student Opens App]) --> Auth{Authenticated?}
    Auth -->|No| Login[Login/Signup Page]
    Login --> Dashboard
    Auth -->|Yes| Dashboard[Main Dashboard]
    
    Dashboard --> LeftPanel[Left Sidebar]
    Dashboard --> CenterPanel[Center Chat Area]
    Dashboard --> RightPanel[Right PDF Preview]
    
    %% Left Sidebar Flow
    LeftPanel --> NewChat[New Chat Button]
    LeftPanel --> UploadedFiles[Uploaded Files Section]
    LeftPanel --> ProgressDash[Progress Dashboard]
    LeftPanel --> ChatHistory[Chat History List]
    
    NewChat --> CreateNewChat[Create New Chat]
    CreateNewChat --> CenterPanel
    
    UploadedFiles --> ViewFiles[View All PDFs]
    ViewFiles --> SelectPDF[Select PDF]
    SelectPDF --> LoadPDF[Load PDF in Right Panel]
    SelectPDF --> SetContext[Set as Chat Context]
    
    ProgressDash --> ViewStats[View Statistics]
    ViewStats --> QuizScores[Quiz Scores & History]
    ViewStats --> Strengths[Strength Areas]
    ViewStats --> Weaknesses[Weak Areas]
    ViewStats --> AIAnalysis[AI-Generated Analysis]
    ViewStats --> Activity[Activity Timeline]
    
    ChatHistory --> SwitchChat[Click Chat]
    SwitchChat --> LoadChat[Load Chat Context]
    LoadChat --> CenterPanel
    
    %% Center Chat Area Flow
    CenterPanel --> InputBox[Chat Input Box]
    InputBox --> TextInput{Input Type}
    TextInput -->|Text| TypeMessage[Type Question/Message]
    TextInput -->|Voice| VoiceInput[Voice Input]
    TextInput -->|PDF Upload| UploadPDF[Upload New PDF]
    
    TypeMessage --> SendMessage[Send Message]
    VoiceInput --> TranscribeVoice[Transcribe Audio]
    TranscribeVoice --> SendMessage
    
    UploadPDF --> ProcessPDF[Process & Store PDF]
    ProcessPDF --> ExtractText[Extract Text Content]
    ExtractText --> ChunkEmbed[Chunk & Embed Text]
    ChunkEmbed --> StoreVectors[Store in pgvector]
    StoreVectors --> ShowUpload[Show in Uploaded Files]
    ShowUpload --> LoadPDF
    
    SendMessage --> QuizOption{Quiz Generation?}
    QuizOption -->|Checkbox Selected| GenerateQuiz[Generate Quiz Immediately]
    QuizOption -->|Not Selected| NormalChat[Process as Chat Message]
    
    NormalChat --> RAGQuery[RAG Query Process]
    RAGQuery --> EmbedQuery[Embed User Query]
    EmbedQuery --> VectorSearch[Search Similar Chunks]
    VectorSearch --> RetrieveContext[Retrieve Relevant Context]
    RetrieveContext --> LLMResponse[Generate LLM Response]
    LLMResponse --> CitedAnswer[Answer with Citations]
    CitedAnswer --> DisplayAnswer[Display in Chat]
    DisplayAnswer --> ShowCitations[Show Page Numbers & Quotes]
    
    %% Quiz Generation Flow
    GenerateQuiz --> QuizType[Select Quiz Type]
    QuizType --> MCQ[MCQ Generator]
    QuizType --> SAQ[SAQ Generator]
    QuizType --> LAQ[LAQ Generator]
    QuizType --> Mixed[Mixed Quiz]
    
    MCQ --> GenMCQ[Generate MCQ Questions]
    SAQ --> GenSAQ[Generate SAQ Questions]
    LAQ --> GenLAQ[Generate LAQ Questions]
    Mixed --> GenMixed[Generate Mixed Questions]
    
    GenMCQ --> RenderQuiz[Render Quiz UI]
    GenSAQ --> RenderQuiz
    GenLAQ --> RenderQuiz
    GenMixed --> RenderQuiz
    
    RenderQuiz --> TakeQuiz[Student Takes Quiz]
    TakeQuiz --> AnswerQs[Answer Questions]
    AnswerQs --> SubmitQuiz[Submit Quiz]
    
    SubmitQuiz --> EvaluateQuiz[Evaluate Answers]
    EvaluateQuiz --> MCQScore[Auto-Score MCQs]
    EvaluateQuiz --> AIScore[AI Score SAQs/LAQs]
    
    MCQScore --> CalcScore[Calculate Total Score]
    AIScore --> CalcScore
    CalcScore --> ShowResults[Show Results]
    
    ShowResults --> DetailedFeedback[Detailed Feedback]
    DetailedFeedback --> CorrectAnswers[Show Correct Answers]
    DetailedFeedback --> Explanations[Provide Explanations]
    DetailedFeedback --> ConceptReview[Concept Review Links]
    
    ShowResults --> StoreAttempt[Store Quiz Attempt]
    StoreAttempt --> UpdateProgress[Update Progress Data]
    UpdateProgress --> AnalyzePerformance[Analyze Performance]
    AnalyzePerformance --> IdentifyWeakness[Identify Weak Topics]
    AnalyzePerformance --> IdentifyStrength[Identify Strong Topics]
    AnalyzePerformance --> UpdateDashboard[Update Dashboard Stats]
    
    ShowResults --> RegenerateOption{Regenerate Quiz?}
    RegenerateOption -->|Yes| GenerateQuiz
    RegenerateOption -->|No| ContinueChat[Continue Chat Session]
    
    %% Additional Features
    DisplayAnswer --> YouTubeRec[YouTube Recommendations]
    YouTubeRec --> FetchVideos[Fetch Related Videos]
    FetchVideos --> DisplayVideos[Display Video Cards]
    DisplayVideos --> WatchVideo[Student Watches Video]
    
    %% Right Panel Flow
    RightPanel --> PDFDisplay[PDF Display Component]
    PDFDisplay --> TogglePDF{Toggle Visibility}
    TogglePDF -->|Hide| CollapsePDF[Collapse Panel]
    TogglePDF -->|Show| ExpandPDF[Expand Panel]
    
    PDFDisplay --> ResizePanel[Resize Panel Width]
    ResizePanel --> DragResize[Drag to Resize]
    
    PDFDisplay --> NavigatePDF[Navigate PDF]
    NavigatePDF --> PageControls[Page Navigation]
    NavigatePDF --> SearchPDF[Search in PDF]
    NavigatePDF --> JumpToPage[Jump to Cited Page]
    
    ShowCitations -.->|Click Citation| JumpToPage
    
    ContinueChat --> InputBox
    WatchVideo --> ContinueChat
    
    UpdateDashboard --> ProgressDash
    
    style Start fill:#e1f5e1
    style Dashboard fill:#e3f2fd
    style GenerateQuiz fill:#fff3e0
    style ShowResults fill:#f3e5f5
    style StoreAttempt fill:#fce4ec
```

## Tech Stack
- **Framework**: Next.js 15 (App Router), React 19
- **Styling/UI**: Tailwind CSS v4, shadcn/ui components, Radix UI primitives, `lucide-react`
- **State**: Zustand
- **Auth/DB**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **LLM**: Google Gemini (`@google/generative-ai`)
- **PDF**: `pdf-parse`, `@react-pdf-viewer/*`

## Monorepo structure (key paths)
- `app/` — Next.js routes (App Router) and API routes under `app/api/*`
- `components/` — UI components (layout, chat, files, quiz, progress)
- `lib/` — Server/client utilities: auth, env, RAG, quiz, Supabase clients
- `store/` — Zustand stores (auth, chat, pdf, quiz, ui)
- `db/migrations/` — SQL migrations for Supabase schema and features

---

## Local Development Setup

### 0) Prerequisites
- Node.js 18+ (LTS recommended)
- npm (comes with Node) or yarn/pnpm
- A Supabase project (free tier is fine)
- API keys for Google Gemini and optionally YouTube Data API v3

### 1) Get the code

```bash
# Clone the repository and enter the project
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>/bookly
```

### 2) Create and configure Supabase
1. Create a new project at `https://supabase.com`.
2. In your project settings, locate:
   - `Project URL` (Supabase URL)
   - `anon` public key (Client)
   - `service_role` key (Server; keep private, server-only)
3. Apply the SQL migrations from /testDB/dbSchema.sql using the Supabase SQL Editor.

Note: Some features (RAG, quizzes, recommendations) require the later migrations.

### 3) Configure environment variables
Create a `.env.local` file in `bookly/` with:

```bash
# Google Gemini (required for chat and quizzes)
GEMINI_API=your_gemini_api_key

# YouTube Data API (optional; enables recommendations)
YT_API_KEY=your_youtube_api_key

# Server-side Supabase (service role used by API routes)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_API_KEY=your_anon_public_key
SUPABASE_SERVICE_KEY=your_service_role_key

# Public (browser) Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
```

Environment resolution:
- Server utilities use `SUPABASE_URL`, `SUPABASE_ANON_API_KEY`, `SUPABASE_SERVICE_KEY`.
- Browser client prefers `NEXT_PUBLIC_*` and falls back to server vars in dev.

### 4) Install dependencies

```bash
npm install
```

### 5) Run the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## How Authentication Works
- Sign in/up pages: `/signin`, `/signup`.
- Middleware (`middleware.ts`) allows public paths and protects the rest by checking Supabase session cookies.
- Server APIs use `@supabase/ssr` to read/write session cookies and get the user.

If auth is not configured, protected routes will redirect to `/signin`.

---

## Core Features & Flows

### Feature Checklist (from ProjectPlan)

- [x] **Source selector**: It has been implemented to allow choosing across all uploaded PDFs or a specific PDF, with file uploads supported. The upload flow and file listing are provided via `app/upload/page.tsx`, `app/files/page.tsx`, and the `components/files/*` and `components/shell/*` panels.

- [x] **PDF viewer**: It has been implemented to display the selected PDF alongside the chat. The right panel provides page navigation, search, and resizing controls (see `components/shell/pdf/*` and the resizable layout in `components/ui/resizable.tsx`).

- [x] **Quiz Generator Engine (MCQ, SAQ, LAQ)**: It has been implemented to generate and render quizzes, capture answers, score submissions, store attempts, and provide explanations. Generation and evaluation routes exist under `app/api/quiz/*`, with UI in `components/quiz/*` and progress storage in `quiz_attempts`/`answers` tables.

- [x] **Progress tracking**: It has been implemented to persist strengths/weaknesses and surface a dashboard. APIs live under `app/api/progress/*`, UI under `components/progress/*`, and storage in `user_progress` and `user_weaknesses` tables.

- [x] **Chat UI (ChatGPT-inspired)**: It has been implemented with a left drawer for chats, a main chat area, and an input box, supporting new chat creation and switching. The layout is responsive across devices (see `components/shell/*` and `components/layout/MainLayout.tsx`).

- [x] **RAG answers with citations**: It has been implemented with PDF ingestion (chunk + embed), similarity search, and citation surfaces in responses. The pipeline lives in `lib/rag.ts` and related API routes (`app/api/pdf/*`, `app/api/chat`), returning cited page numbers and quotes when available.

- [x] **YouTube Videos Recommender**: It has been implemented to recommend educational videos relevant to context and detected weaknesses. Endpoints are under `app/api/youtube/*`, with UI in `components/youtube/*` and persistence in `youtube_recommendations`.

### Operational Endpoints and Flows

- **Chat with Retrieval**: `POST /api/chat` — Session is validated, user provisioned, optional rate limiting applied. When a `pdfId` is provided and ready, the query is embedded, top chunks are retrieved, and a response is streamed from Gemini with citations; messages are persisted in `messages`.
- **Messages History**: `GET /api/messages?chatId=...` — Chat ownership is enforced and ordered messages are returned.
- **PDFs**: Uploading, parsing, embedding, and search are performed via `app/api/pdf/*`, with status tracked in `pdfs` and chunk vectors in `chunks`.
- **Quizzes & Progress**: Quiz generation/evaluation under `app/api/quiz/*`; dashboard and history powered by `app/api/progress/*` and visualized in `components/progress/*`.
- **YouTube Recommendations**: Recommendation APIs live under `app/api/youtube/*` and are driven by content/topics and weaknesses, gated by `YT_API_KEY`.

---

## Scripts
- `npm run dev` — Start Next.js dev server
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

---

## Troubleshooting
- "Authentication required" on protected pages:
  - Confirm `.env.local` has valid `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Ensure your Supabase Auth providers are enabled and redirect URLs include `http://localhost:3000`.

- Chat returns 500 "GEMINI_API missing":
  - Set `GEMINI_API` in `.env.local`.

- Missing data or SQL errors:
  - Verify all migrations in `db/migrations/` were applied in order.

- Windows or local TLS/cookie oddities:
  - The middleware and server helpers will try to decode the Supabase access token from cookies as a fallback.
  - Make sure third-party cookies are not blocked in the browser during local testing.

- PDF viewer issues (canvas/pdfjs):
  - The app stubs `canvas` in `next.config.ts`; ensure you’re not bundling `canvas` on the client.

---

## Security Notes
- Never expose `SUPABASE_SERVICE_KEY` to the browser or commit it to VCS.
- Use separate environment files or secrets for production vs. development.

---

## License
Proprietary. All rights reserved.

