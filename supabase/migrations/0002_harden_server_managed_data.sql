-- Harden server-managed source-processing data after the initial schema has
-- been applied. Client users may read their own parsed text but cannot forge
-- chunks, citations, document processing state, or account-trigger behavior.

revoke execute on function public.handle_new_user() from public;

revoke all privileges on public.document_sections from authenticated;
revoke all privileges on public.document_chunks from authenticated;
grant select on public.document_sections to authenticated;
grant select on public.document_chunks to authenticated;

revoke update on public.documents from authenticated;
grant update (title) on public.documents to authenticated;
