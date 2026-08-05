-- Keep deterministic local retrieval useful for natural questions without
-- weakening its private scope. Exact lexical matches rank first. When a
-- question adds non-source wording (for example, "what part of the cell"), a
-- sufficiently strong partial overlap can still surface the relevant chunk.

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
    select
      websearch_to_tsquery('english', p_query) as strict_terms,
      to_tsquery(
        'english',
        replace(plainto_tsquery('english', p_query)::text, ' & ', ' | ')
      ) as fallback_terms
  ),
  scoped_chunks as (
    select
      chunk.id,
      chunk.document_id,
      document_row.title as document_title,
      chunk.page_number,
      chunk.heading,
      chunk.content,
      to_tsvector(
        'english',
        concat_ws(' ', document_row.title, chunk.heading, chunk.content)
      ) as source_vector
    from public.document_chunks as chunk
    inner join public.documents as document_row
      on document_row.id = chunk.document_id
    inner join public.courses as course_row
      on course_row.id = document_row.course_id
    where document_row.owner_id = (select auth.uid())
      and course_row.owner_id = (select auth.uid())
      and document_row.course_id = p_course_id
      and document_row.status = 'ready'
      and (
        coalesce(array_length(p_document_ids, 1), 0) = 0
        or chunk.document_id = any(p_document_ids)
      )
  ),
  ranked as (
    select
      scoped_chunks.*,
      scoped_chunks.source_vector @@ query_terms.strict_terms as is_strict_match,
      case
        when scoped_chunks.source_vector @@ query_terms.strict_terms
          then 1 + ts_rank_cd(scoped_chunks.source_vector, query_terms.strict_terms)
        else ts_rank_cd(scoped_chunks.source_vector, query_terms.fallback_terms)
      end::double precision as similarity
    from scoped_chunks
    cross join query_terms
    where query_terms.strict_terms <> ''::tsquery
      and query_terms.fallback_terms <> ''::tsquery
      and scoped_chunks.source_vector @@ query_terms.fallback_terms
  )
  select
    ranked.id,
    ranked.document_id,
    ranked.document_title,
    ranked.page_number,
    ranked.heading,
    ranked.content,
    ranked.similarity
  from ranked
  where ranked.is_strict_match
    or ranked.similarity >= 0.1
  order by ranked.is_strict_match desc, ranked.similarity desc
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
