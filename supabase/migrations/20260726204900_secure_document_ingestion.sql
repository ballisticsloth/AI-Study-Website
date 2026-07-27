-- Add an atomic, server-only ingestion path for parsed source text.
--
-- The browser may request processing through an authenticated Server Action,
-- but only the backend's Supabase secret key can execute the functions below.
-- That prevents users from forging document chunks or their future citations.

alter table public.documents
  add column processing_token uuid,
  add column processing_started_at timestamptz,
  add column processing_attempts integer not null default 0
    check (processing_attempts >= 0);

alter table public.documents
  add constraint documents_processing_state_check
    check (
      (
        status = 'processing'
        and processing_token is not null
        and processing_started_at is not null
        and processing_error is null
      )
      or (
        status = 'failed'
        and processing_token is null
        and processing_started_at is null
        and processing_error is not null
      )
      or (
        status in ('uploading', 'ready')
        and processing_token is null
        and processing_started_at is null
        and processing_error is null
      )
    );

-- A chunk must belong to a section from the same document. The older foreign
-- key checked only section_id, which allowed an inconsistent pairing.
alter table public.document_sections
  add constraint document_sections_document_id_id_key unique (document_id, id);

alter table public.document_chunks
  drop constraint document_chunks_section_id_fkey,
  add constraint document_chunks_document_section_fkey
    foreign key (document_id, section_id)
    references public.document_sections (document_id, id)
    on delete cascade;

-- Atomically claim an uploaded or previously failed document. The expected
-- owner is rechecked here as a defense in depth measure; the Server Action
-- separately authorizes the caller before invoking this service-only function.
create or replace function public.claim_document_processing(
  p_document_id uuid,
  p_expected_owner_id uuid
)
returns table (
  id uuid,
  storage_path text,
  mime_type text,
  byte_size bigint,
  processing_token uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  update public.documents as document_row
  set
    status = 'processing',
    processing_token = gen_random_uuid(),
    processing_started_at = now(),
    processing_error = null,
    processing_attempts = document_row.processing_attempts + 1
  where document_row.id = p_document_id
    and document_row.owner_id = p_expected_owner_id
    and document_row.status in ('uploading', 'failed')
  returning
    document_row.id,
    document_row.storage_path,
    document_row.mime_type,
    document_row.byte_size,
    document_row.processing_token;
end;
$function$;

-- Replace all parsed source text and mark the matching processing attempt as
-- ready in one database transaction. Chunks receive their page/heading only
-- from the newly inserted section, so citation metadata cannot disagree.
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
      content text
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
    content
  )
  select
    p_document_id,
    section_row.id,
    source_chunk.chunk_index,
    section_row.page_number,
    section_row.heading,
    source_chunk.content
  from jsonb_to_recordset(p_chunks) as source_chunk(
    section_index integer,
    chunk_index integer,
    content text
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

-- Fail only the matching processing attempt. A stale job cannot overwrite the
-- status of a newer retry, and the error remains a short safe user message.
create or replace function public.fail_document_ingestion(
  p_document_id uuid,
  p_processing_token uuid,
  p_safe_error text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  did_fail boolean;
begin
  update public.documents
  set
    status = 'failed',
    processing_token = null,
    processing_started_at = null,
    processing_error = left(
      coalesce(nullif(btrim(p_safe_error), ''), 'This file could not be processed.'),
      500
    )
  where id = p_document_id
    and status = 'processing'
    and processing_token = p_processing_token
  returning true into did_fail;

  return coalesce(did_fail, false);
end;
$function$;

revoke all on function public.claim_document_processing(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_document_ingestion(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_document_ingestion(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_document_processing(uuid, uuid) to service_role;
grant execute on function public.complete_document_ingestion(uuid, uuid, jsonb, jsonb)
  to service_role;
grant execute on function public.fail_document_ingestion(uuid, uuid, text)
  to service_role;
