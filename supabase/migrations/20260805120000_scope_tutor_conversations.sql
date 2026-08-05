-- Keep the exact private materials selected at the start of a tutor
-- conversation. The server validates every id again before retrieval; an empty
-- scope is intentionally not treated as permission to search every upload.

alter table public.tutor_conversations
  add column source_document_ids jsonb not null default '[]'::jsonb
  check (jsonb_typeof(source_document_ids) = 'array');
