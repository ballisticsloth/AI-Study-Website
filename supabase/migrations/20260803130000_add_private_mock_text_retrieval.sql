-- Provide deterministic, no-credit source lookup for local mock mode. This
-- is deliberately lexical (not semantic), but uses the same private scope and
-- citation fields as vector retrieval.

create or replace function public.match_document_chunks_by_text(
  p_course_id uuid,
  p_document_ids uuid[] default null,
  p_query text default null,
  p_match_count integer default 6
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
  with query_terms as (
    select websearch_to_tsquery('english', p_query) as terms
  )
  select
    chunk.id,
    chunk.document_id,
    document_row.title as document_title,
    chunk.page_number,
    chunk.heading,
    chunk.content,
    ts_rank_cd(
      to_tsvector(
        'english',
        concat_ws(' ', document_row.title, chunk.heading, chunk.content)
      ),
      query_terms.terms
    )::double precision as similarity
  from public.document_chunks as chunk
  inner join public.documents as document_row
    on document_row.id = chunk.document_id
  inner join public.courses as course_row
    on course_row.id = document_row.course_id
  cross join query_terms
  where document_row.owner_id = (select auth.uid())
    and course_row.owner_id = (select auth.uid())
    and document_row.course_id = p_course_id
    and document_row.status = 'ready'
    and query_terms.terms <> ''::tsquery
    and (
      coalesce(array_length(p_document_ids, 1), 0) = 0
      or chunk.document_id = any(p_document_ids)
    )
    and to_tsvector(
      'english',
      concat_ws(' ', document_row.title, chunk.heading, chunk.content)
    ) @@ query_terms.terms
  order by ts_rank_cd(
    to_tsvector(
      'english',
      concat_ws(' ', document_row.title, chunk.heading, chunk.content)
    ),
    query_terms.terms
  ) desc
  limit least(greatest(p_match_count, 1), 6);
$function$;

revoke all on function public.match_document_chunks_by_text(
  uuid,
  uuid[],
  text,
  integer
) from public, anon;

grant execute on function public.match_document_chunks_by_text(
  uuid,
  uuid[],
  text,
  integer
) to authenticated;
