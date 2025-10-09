-- Bookly AI - Consolidated Database Schema for Local Setup
-- This script combines all migrations from db/migrations into a single file
-- Apply this in Supabase SQL editor for a fresh local/dev database

-- ========= 0001_init.sql =========
-- Core tables with integer IDs and public UUIDs
create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table if not exists users (
  id serial primary key,
  public_id uuid not null default uuid_generate_v4(),
  email text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists pdfs (
  id serial primary key,
  public_id uuid not null default uuid_generate_v4(),
  owner_id int not null references users(id),
  name text not null,
  storage_path text not null,
  page_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists chats (
  id serial primary key,
  public_id uuid not null default uuid_generate_v4(),
  owner_id int not null references users(id),
  pdf_id int references pdfs(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists messages (
  id serial primary key,
  chat_id int not null references chats(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists chunks (
  id serial primary key,
  pdf_id int not null references pdfs(id) on delete cascade,
  page int not null,
  line_start int,
  line_end int,
  text text not null,
  embedding vector(1536)
);

create table if not exists quizzes (
  id serial primary key,
  public_id uuid not null default uuid_generate_v4(),
  owner_id int not null references users(id),
  pdf_id int references pdfs(id),
  config jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id serial primary key,
  quiz_id int not null references quizzes(id) on delete cascade,
  owner_id int not null references users(id),
  score numeric,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ivfflat index; adjust lists later via migration
create index if not exists idx_chunks_pdf_page on chunks(pdf_id, page);
create index if not exists idx_chunks_embedding on chunks using ivfflat (embedding vector_l2_ops) with (lists = 200);

-- RLS policies (example ownership)
alter table users enable row level security;
alter table pdfs enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table quizzes enable row level security;
alter table quiz_attempts enable row level security;

-- Simplified RLS functions assume auth.uid() mapped to users.email; adjust per project setup
create policy users_self on users for select using (true);
create policy pdfs_owner_policy on pdfs for all using (true) with check (true);
create policy chats_owner_policy on chats for all using (true) with check (true);
create policy messages_chat_policy on messages for all using (true) with check (true);
create policy quizzes_owner_policy on quizzes for all using (true) with check (true);
create policy quiz_attempts_owner_policy on quiz_attempts for all using (true) with check (true);

-- ========= 0002_rls.sql =========
-- Fix RLS policies to properly map auth.uid() to users table
-- Drop existing permissive policies
drop policy if exists users_self on users;
drop policy if exists pdfs_owner_policy on pdfs;
drop policy if exists chats_owner_policy on chats;
drop policy if exists messages_chat_policy on messages;
drop policy if exists quizzes_owner_policy on quizzes;
drop policy if exists quiz_attempts_owner_policy on quiz_attempts;

-- Create proper RLS policies that map auth.uid() to users table
-- Users can only see their own profile
create policy users_own_policy on users 
  for all using (auth.uid()::text = public_id::text);

-- PDFs: users can only access their own PDFs
create policy pdfs_own_policy on pdfs 
  for all using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

-- Chats: users can only access their own chats
create policy chats_own_policy on chats 
  for all using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

-- Messages: users can only access messages from their own chats
create policy messages_own_policy on messages 
  for all using (
    chat_id in (
      select id from chats where owner_id in (
        select id from users where public_id::text = auth.uid()::text
      )
    )
  );

-- Quizzes: users can only access their own quizzes
create policy quizzes_own_policy on quizzes 
  for all using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

-- Quiz attempts: users can only access their own attempts
create policy quiz_attempts_own_policy on quiz_attempts 
  for all using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

-- Chunks: users can only access chunks from their own PDFs
create policy chunks_own_policy on chunks 
  for all using (
    pdf_id in (
      select id from pdfs where owner_id in (
        select id from users where public_id::text = auth.uid()::text
      )
    )
  );

-- Enable RLS on chunks table (if not already enabled)
alter table chunks enable row level security;

-- ========= 0003_phase1_extend.sql =========
-- Extend schema for Phase 1 completion

-- Add status to pdfs for processing state tracking
alter table if exists pdfs
  add column if not exists status text not null default 'pending',
  add column if not exists page_count int;

-- Soft deletes for remaining tables
alter table if exists messages add column if not exists deleted_at timestamptz;
alter table if exists quizzes add column if not exists deleted_at timestamptz;
alter table if exists quiz_attempts add column if not exists deleted_at timestamptz;

-- Answers table (for future quiz features)
create table if not exists answers (
  id serial primary key,
  quiz_attempt_id int not null references quiz_attempts(id) on delete cascade,
  question_index int not null,
  user_answer jsonb,
  correct_answer jsonb,
  is_correct boolean,
  created_at timestamptz not null default now()
);

-- User progress table (aggregate metrics)
create table if not exists user_progress (
  id serial primary key,
  owner_id int not null references users(id),
  metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_pdfs_owner on pdfs(owner_id);
create index if not exists idx_chats_owner on chats(owner_id);
create index if not exists idx_quizzes_owner on quizzes(owner_id);
create index if not exists idx_messages_chat_created on messages(chat_id, created_at);

-- RPC: match_chunks for vector similarity search within a PDF
create or replace function match_chunks(
  p_pdf_id int,
  p_query vector(1536),
  p_match_count int default 5,
  p_probes int default 10
)
returns table(
  id int,
  pdf_id int,
  page int,
  text text,
  distance float
) language plpgsql as $$
begin
  perform setseed(0);
  perform set_config('ivfflat.probes', p_probes::text, true);
  return query
  select c.id, c.pdf_id, c.page, c.text, (c.embedding <-> p_query) as distance
  from chunks c
  where c.pdf_id = p_pdf_id and c.embedding is not null
  order by c.embedding <-> p_query
  limit p_match_count;
end;
$$;

-- ========= 0004_gemini_embeddings.sql =========
-- Switch embeddings to Gemini (768 dims) and update RPC + index safely
-- Note: Using 768 dimensions to stay within PostgreSQL limits

-- 1) Drop the vector index before altering the column dimension
drop index if exists idx_chunks_embedding;

-- 2) Change embedding dimension to 768 (truncated from Gemini's 3072)
alter table if exists chunks
  alter column embedding type vector(768);

-- 3) Drop the previous function (signature uses 'vector' w/o dimension)
drop function if exists public.match_chunks(integer, vector, integer, integer);

-- 4) Recreate function with updated return columns and 768-d query vector
create function public.match_chunks(
  p_pdf_id int,
  p_query vector(768),
  p_match_count int default 5,
  p_probes int default 10
)
returns table(
  id int,
  pdf_id int,
  page int,
  line_start int,
  line_end int,
  text text,
  distance float
) language plpgsql as $$
begin
  perform setseed(0);
  perform set_config('ivfflat.probes', p_probes::text, true);
  return query
  select c.id, c.pdf_id, c.page, c.line_start, c.line_end, c.text, (c.embedding <-> p_query) as distance
  from chunks c
  where c.pdf_id = p_pdf_id and c.embedding is not null
  order by c.embedding <-> p_query
  limit p_match_count;
end;
$$;

-- 5) Recreate vector index using IVFFLAT (works with 768 dimensions)
create index if not exists idx_chunks_embedding
  on chunks using ivfflat (embedding vector_l2_ops) with (lists = 200);

-- ========= 0005_RAG.sql =========
-- Switch embeddings to Gemini (768 dims) and update RPC + index safely

-- 1) Drop the vector index before altering the column dimension
drop index if exists idx_chunks_embedding;

-- 2) Change embedding dimension to 768
alter table if exists chunks
  alter column embedding type vector(768);

-- 3) Drop the previous function (signature uses 'vector' w/o dimension)
drop function if exists public.match_chunks(integer, vector, integer, integer);

-- 4) Recreate function with updated return columns and 768-d query vector
create function public.match_chunks(
  p_pdf_id int,
  p_query vector(768),
  p_match_count int default 5,
  p_probes int default 10
)
returns table(
  id int,
  pdf_id int,
  page int,
  line_start int,
  line_end int,
  text text,
  distance float
) language plpgsql as $$
begin
  perform setseed(0);
  perform set_config('ivfflat.probes', p_probes::text, true);
  return query
  select c.id, c.pdf_id, c.page, c.line_start, c.line_end, c.text, (c.embedding <-> p_query) as distance
  from chunks c
  where c.pdf_id = p_pdf_id and c.embedding is not null
  order by c.embedding <-> p_query
  limit p_match_count;
end;
$$;

-- 5) Recreate vector index for new dimension
create index if not exists idx_chunks_embedding
  on chunks using ivfflat (embedding vector_l2_ops) with (lists = 200);

-- ========= 0006_youtube_recommendations.sql =========
-- YouTube recommendations and weakness tracking
-- Progressive approach: works with content analysis now, scales with quiz data later

-- YouTube recommendations cache
create table if not exists youtube_recommendations (
  id serial primary key,
  owner_id int not null references users(id) on delete cascade,
  video_id text not null,
  title text not null,
  description text,
  thumbnail_url text,
  channel_title text,
  duration text,
  view_count bigint,
  relevance_score float not null default 0.0,
  source_type text not null, -- 'content', 'chat_weakness', 'quiz_weakness', 'topic'
  source_topic text not null, -- The topic that triggered this recommendation
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- User weaknesses tracking (future-proof for quiz integration)
create table if not exists user_weaknesses (
  id serial primary key,
  owner_id int not null references users(id) on delete cascade,
  topic text not null,
  confidence_score float not null default 0.0,
  source text not null, -- 'quiz', 'chat', 'content', 'manual'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Video interactions tracking
create table if not exists video_interactions (
  id serial primary key,
  owner_id int not null references users(id) on delete cascade,
  video_id text not null,
  interaction_type text not null, -- 'viewed', 'clicked', 'completed'
  duration_watched int, -- seconds watched
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_youtube_recs_owner on youtube_recommendations(owner_id);
create index if not exists idx_youtube_recs_expires on youtube_recommendations(expires_at);
create index if not exists idx_youtube_recs_source on youtube_recommendations(source_type, source_topic);
create index if not exists idx_user_weaknesses_owner on user_weaknesses(owner_id);
create index if not exists idx_user_weaknesses_topic on user_weaknesses(topic);
create index if not exists idx_video_interactions_owner on video_interactions(owner_id);

-- RLS policies
alter table youtube_recommendations enable row level security;
alter table user_weaknesses enable row level security;
alter table video_interactions enable row level security;

-- YouTube recommendations RLS
create policy "Users can view own youtube recommendations" on youtube_recommendations
  for select using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

create policy "Users can insert own youtube recommendations" on youtube_recommendations
  for insert with check (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

create policy "Users can update own youtube recommendations" on youtube_recommendations
  for update using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

-- User weaknesses RLS
create policy "Users can view own weaknesses" on user_weaknesses
  for select using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

create policy "Users can insert own weaknesses" on user_weaknesses
  for insert with check (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

create policy "Users can update own weaknesses" on user_weaknesses
  for update using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

-- Video interactions RLS
create policy "Users can view own video interactions" on video_interactions
  for select using (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

create policy "Users can insert own video interactions" on video_interactions
  for insert with check (
    owner_id in (
      select id from users where public_id::text = auth.uid()::text
    )
  );

-- Function to clean up expired recommendations
create or replace function cleanup_expired_recommendations()
returns void language plpgsql as $$
begin
  delete from youtube_recommendations where expires_at < now();
end;
$$;

-- Function to get user's current weaknesses (combines all sources)
create or replace function get_user_weaknesses(p_user_id int)
returns table(topic text, confidence_score float, source text) language plpgsql as $$
begin
  return query
  select uw.topic, uw.confidence_score, uw.source
  from user_weaknesses uw
  where uw.owner_id = p_user_id
  order by uw.confidence_score desc, uw.updated_at desc;
end;
$$;

-- ========= 0007_persistent_youtube_videos.sql =========
-- Make YouTube videos persistent and add clickable URLs
-- Remove expiration and add video URL field

-- Add video_url column for clickable YouTube links
alter table youtube_recommendations 
  add column if not exists video_url text;

-- Remove expiration constraint to make videos persistent
alter table youtube_recommendations 
  drop column if exists expires_at;

-- Update the cleanup function to only clean up very old videos (older than 30 days)
create or replace function cleanup_old_youtube_recommendations()
returns void language plpgsql as $$
begin
  -- Only delete videos older than 30 days to keep them persistent but not forever
  delete from youtube_recommendations 
  where created_at < (now() - interval '30 days');
end;
$$;

-- Add index for video_url
create index if not exists idx_youtube_recs_video_url on youtube_recommendations(video_url);

-- Function to get user's persistent YouTube recommendations
create or replace function get_user_youtube_recommendations(p_user_id int)
returns table(
  id int,
  video_id text,
  title text,
  description text,
  thumbnail_url text,
  channel_title text,
  duration text,
  view_count bigint,
  relevance_score float,
  source_type text,
  source_topic text,
  video_url text,
  created_at timestamptz
) language plpgsql as $$
begin
  return query
  select 
    yr.id,
    yr.video_id,
    yr.title,
    yr.description,
    yr.thumbnail_url,
    yr.channel_title,
    yr.duration,
    yr.view_count,
    yr.relevance_score,
    yr.source_type,
    yr.source_topic,
    yr.video_url,
    yr.created_at
  from youtube_recommendations yr
  where yr.owner_id = p_user_id
  order by yr.relevance_score desc, yr.created_at desc;
end;
$$;

-- ========= 0008_cleanup_duplicate_videos.sql =========
-- Clean up duplicate YouTube videos and add unique constraint
-- This migration removes duplicate videos and prevents future duplicates

-- Remove duplicate videos, keeping only the most recent one for each video_id per user
DELETE FROM youtube_recommendations 
WHERE id NOT IN (
  SELECT DISTINCT ON (owner_id, video_id) id
  FROM youtube_recommendations
  ORDER BY owner_id, video_id, created_at DESC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE youtube_recommendations 
ADD CONSTRAINT unique_user_video 
UNIQUE (owner_id, video_id);

-- Add index for better performance on the unique constraint
CREATE INDEX IF NOT EXISTS idx_youtube_recs_owner_video 
ON youtube_recommendations(owner_id, video_id);

-- Function to safely insert YouTube recommendations (prevents duplicates)
CREATE OR REPLACE FUNCTION insert_youtube_recommendation(
  p_owner_id int,
  p_video_id text,
  p_title text,
  p_description text,
  p_thumbnail_url text,
  p_channel_title text,
  p_duration text,
  p_view_count bigint,
  p_relevance_score float,
  p_source_type text,
  p_source_topic text,
  p_video_url text
)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  result_id int;
BEGIN
  -- Try to insert, but handle duplicate key violations gracefully
  INSERT INTO youtube_recommendations (
    owner_id, video_id, title, description, thumbnail_url,
    channel_title, duration, view_count, relevance_score,
    source_type, source_topic, video_url
  ) VALUES (
    p_owner_id, p_video_id, p_title, p_description, p_thumbnail_url,
    p_channel_title, p_duration, p_view_count, p_relevance_score,
    p_source_type, p_source_topic, p_video_url
  ) RETURNING id INTO result_id;
  
  RETURN result_id;
EXCEPTION
  WHEN unique_violation THEN
    -- If duplicate, update the existing record with new data
    UPDATE youtube_recommendations 
    SET 
      title = p_title,
      description = p_description,
      thumbnail_url = p_thumbnail_url,
      channel_title = p_channel_title,
      duration = p_duration,
      view_count = p_view_count,
      relevance_score = p_relevance_score,
      source_type = p_source_type,
      source_topic = p_source_topic,
      video_url = p_video_url,
      created_at = now()
    WHERE owner_id = p_owner_id AND video_id = p_video_id
    RETURNING id INTO result_id;
    
    RETURN result_id;
END;
$$;

-- ========= 0009_quiz_specific_youtube_videos.sql =========
-- Add quiz-specific context to YouTube recommendations
-- Link YouTube videos to specific quiz attempts

-- Add quiz_attempt_id column to link videos to specific quiz attempts
ALTER TABLE youtube_recommendations 
ADD COLUMN IF NOT EXISTS quiz_attempt_id int REFERENCES quiz_attempts(id) ON DELETE CASCADE;

-- Add index for quiz-specific queries
CREATE INDEX IF NOT EXISTS idx_youtube_recs_quiz_attempt 
ON youtube_recommendations(quiz_attempt_id);

-- Update the unique constraint to include quiz_attempt_id
-- This allows the same video to be recommended for different quiz attempts
ALTER TABLE youtube_recommendations 
DROP CONSTRAINT IF EXISTS unique_user_video;

ALTER TABLE youtube_recommendations 
ADD CONSTRAINT unique_user_video_quiz 
UNIQUE (owner_id, video_id, quiz_attempt_id);

-- Update the safe insert function to handle quiz-specific recommendations
CREATE OR REPLACE FUNCTION insert_youtube_recommendation(
  p_owner_id int,
  p_video_id text,
  p_title text,
  p_description text,
  p_thumbnail_url text,
  p_channel_title text,
  p_duration text,
  p_view_count bigint,
  p_relevance_score float,
  p_source_type text,
  p_source_topic text,
  p_video_url text,
  p_quiz_attempt_id int DEFAULT NULL
)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  result_id int;
BEGIN
  -- Try to insert, but handle duplicate key violations gracefully
  INSERT INTO youtube_recommendations (
    owner_id, video_id, title, description, thumbnail_url,
    channel_title, duration, view_count, relevance_score,
    source_type, source_topic, video_url, quiz_attempt_id
  ) VALUES (
    p_owner_id, p_video_id, p_title, p_description, p_thumbnail_url,
    p_channel_title, p_duration, p_view_count, p_relevance_score,
    p_source_type, p_source_topic, p_video_url, p_quiz_attempt_id
  ) RETURNING id INTO result_id;
  
  RETURN result_id;
EXCEPTION
  WHEN unique_violation THEN
    -- If duplicate, update the existing record with new data
    UPDATE youtube_recommendations 
    SET 
      title = p_title,
      description = p_description,
      thumbnail_url = p_thumbnail_url,
      channel_title = p_channel_title,
      duration = p_duration,
      view_count = p_view_count,
      relevance_score = p_relevance_score,
      source_type = p_source_type,
      source_topic = p_source_topic,
      video_url = p_video_url,
      created_at = now()
    WHERE owner_id = p_owner_id 
      AND video_id = p_video_id 
      AND (quiz_attempt_id = p_quiz_attempt_id OR (quiz_attempt_id IS NULL AND p_quiz_attempt_id IS NULL))
    RETURNING id INTO result_id;
    
    RETURN result_id;
END;
$$;

-- Function to get quiz-specific YouTube recommendations
CREATE OR REPLACE FUNCTION get_quiz_youtube_recommendations(p_quiz_attempt_id int)
RETURNS TABLE(
  id int,
  video_id text,
  title text,
  description text,
  thumbnail_url text,
  channel_title text,
  duration text,
  view_count bigint,
  relevance_score float,
  source_type text,
  source_topic text,
  video_url text,
  created_at timestamptz
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    yr.id,
    yr.video_id,
    yr.title,
    yr.description,
    yr.thumbnail_url,
    yr.channel_title,
    yr.duration,
    yr.view_count,
    yr.relevance_score,
    yr.source_type,
    yr.source_topic,
    yr.video_url,
    yr.created_at
  FROM youtube_recommendations yr
  WHERE yr.quiz_attempt_id = p_quiz_attempt_id
  ORDER BY yr.relevance_score DESC, yr.created_at DESC;
END;
$$;


