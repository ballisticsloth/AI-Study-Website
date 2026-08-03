-- Save validated embeddings in the same transaction as newly extracted chunks.
-- A document reaches the ready state only after every chunk can be retrieved.

create or replace function public.complete_document_ingestion(
  p_document_id uuid,
  p_processing_token uuid,
  p_sections jsonb,
  p_chunks jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if jsonb_typeof(p_sections) is distinct from 'array'
    or jsonb_typeof(p_chunks) is distinct from 'array'
    or jsonb_array_length(p_sections) = 0
    or jsonb_array_length(p_chunks) = 0 then
    raise exception 'Source sections and chunks must be non-empty JSON arrays';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_chunks) as source_chunk(
      section_index integer,
      chunk_index integer,
      content text,
      embedding jsonb
    )
    where jsonb_typeof(source_chunk.embedding) is distinct from 'array'
      or jsonb_array_length(source_chunk.embedding) != 1536
  ) then
    raise exception 'Every chunk must include a 1536-dimension embedding';
  end if;

  perform 1
  from public.documents as document_row
  where document_row.id = p_document_id
    and document_row.status = 'processing'
    and document_row.processing_token = p_processing_token
  for update;

  if not found then
    return false;
  end if;

  delete from public.document_chunks
  where document_id = p_document_id;

  delete from public.document_sections
  where document_id = p_document_id;

  insert into public.document_sections (
    document_id,
    section_index,
    page_number,
    heading,
    source_text
  )
  select
    p_document_id,
    source_section.section_index,
    source_section.page_number,
    nullif(btrim(source_section.heading), ''),
    source_section.source_text
  from jsonb_to_recordset(p_sections) as source_section(
    section_index integer,
    page_number integer,
    heading text,
    source_text text
  )
  order by source_section.section_index;

  if exists (
    select 1
    from jsonb_to_recordset(p_chunks) as source_chunk(
      section_index integer,
      chunk_index integer,
      content text,
      embedding jsonb
    )
    left join public.document_sections as section_row
      on section_row.document_id = p_document_id
      and section_row.section_index = source_chunk.section_index
    where section_row.id is null
  ) then
    raise exception 'Every chunk must reference a section from this document';
  end if;

  insert into public.document_chunks (
    document_id,
    section_id,
    chunk_index,
    page_number,
    heading,
    content,
    embedding
  )
  select
    p_document_id,
    section_row.id,
    source_chunk.chunk_index,
    section_row.page_number,
    section_row.heading,
    source_chunk.content,
    source_chunk.embedding::text::extensions.vector
  from jsonb_to_recordset(p_chunks) as source_chunk(
    section_index integer,
    chunk_index integer,
    content text,
    embedding jsonb
  )
  inner join public.document_sections as section_row
    on section_row.document_id = p_document_id
    and section_row.section_index = source_chunk.section_index
  order by source_chunk.chunk_index;

  update public.documents
  set
    status = 'ready',
    processing_token = null,
    processing_started_at = null,
    processing_error = null
  where id = p_document_id
    and status = 'processing'
    and processing_token = p_processing_token;

  return true;
end;
$function$;
