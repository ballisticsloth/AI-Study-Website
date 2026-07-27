-- Lock down the client-side portion of private document uploads. The browser
-- may create only a narrowly defined upload record, and Storage accepts only
-- an object whose exact path has a matching record owned by that user.

alter table public.documents
  add constraint documents_supported_mime_type_check
    check (
      mime_type in (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      )
    ),
  add constraint documents_byte_size_limit_check
    check (byte_size between 1 and 20971520),
  add constraint documents_filename_extension_check
    check (
      (mime_type = 'application/pdf' and lower(original_filename) like '%.pdf')
      or (
        mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        and lower(original_filename) like '%.docx'
      )
      or (mime_type = 'text/plain' and lower(original_filename) like '%.txt')
    ),
  add constraint documents_storage_path_check
    check (
      storage_path = concat(
        owner_id::text,
        '/',
        id::text,
        '/original.',
        case mime_type
          when 'application/pdf' then 'pdf'
          when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
          when 'text/plain' then 'txt'
          else ''
        end
      )
    );

revoke insert on public.documents from authenticated;
grant insert (
  id,
  course_id,
  owner_id,
  title,
  original_filename,
  storage_path,
  mime_type,
  byte_size
) on public.documents to authenticated;

drop policy "Users can manage their own documents" on public.documents;

create policy "Users can view their own documents"
on public.documents for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own document upload records"
on public.documents for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and status = 'uploading'
  and processing_error is null
  and exists (
    select 1 from public.courses
    where courses.id = documents.course_id
      and courses.owner_id = (select auth.uid())
  )
);

create policy "Users can rename their own documents"
on public.documents for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own documents"
on public.documents for delete to authenticated
using ((select auth.uid()) = owner_id);

drop policy "Users can manage files in their own course-materials folder"
on storage.objects;

create policy "Users can read files in their own course-materials folder"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload prepared course-material files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.documents
    where documents.owner_id = (select auth.uid())
      and documents.storage_path = storage.objects.name
      and documents.status = 'uploading'
  )
);

create policy "Users can delete files in their own course-materials folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
