-- Add private, source-scoped semantic retrieval for processed document chunks.
-- The matching function is intentionally invoked as the signed-in user. It
-- filters ownership and the selected source scope before it ranks embeddings.

create extension if not exists vector with schema extensions;

alter table public.document_chunks
  add column if not exists embedding extensions.vector(1536);

create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create or replace function public.match_document_chunks(
  p_course_id uuid,
  p_document_ids uuid[] default null,
  p_query_embedding extensions.vector(1536) default null,
  p_match_count integer default 6,
  p_match_threshold double precision default 0.35
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  heading text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    chunk.id,
    chunk.document_id,
    document_row.title as document_title,
    chunk.page_number,
    chunk.heading,
    chunk.content,
    1 - (chunk.embedding OPERATOR(extensions.<=>) p_query_embedding) as similarity
  from public.document_chunks as chunk
  inner join public.documents as document_row
    on document_row.id = chunk.document_id
  inner join public.courses as course_row
    on course_row.id = document_row.course_id
  where document_row.owner_id = (select auth.uid())
    and course_row.owner_id = (select auth.uid())
    and document_row.course_id = p_course_id
    and document_row.status = 'ready'
    and chunk.embedding is not null
    and (
      coalesce(array_length(p_document_ids, 1), 0) = 0
      or chunk.document_id = any(p_document_ids)
    )
    and 1 - (chunk.embedding OPERATOR(extensions.<=>) p_query_embedding)
      >= greatest(0, least(p_match_threshold, 1))
  order by chunk.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(greatest(p_match_count, 1), 6);
$function$;

revoke all on function public.match_document_chunks(
  uuid,
  uuid[],
  extensions.vector,
  integer,
  double precision
) from public, anon;

grant execute on function public.match_document_chunks(
  uuid,
  uuid[],
  extensions.vector,
  integer,
  double precision
) to authenticated;
