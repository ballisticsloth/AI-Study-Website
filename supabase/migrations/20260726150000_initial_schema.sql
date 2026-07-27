-- AI Study Website: first application schema and private-storage policies.
-- Apply this migration through the Supabase SQL Editor after reviewing it.

create type public.document_status as enum (
  'uploading',
  'processing',
  'ready',
  'failed'
);

create type public.material_type as enum ('multiple_choice_test', 'worksheet');

create type public.material_status as enum ('draft', 'generating', 'ready', 'failed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_owner_id_idx on public.courses (owner_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 255),
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  status public.document_status not null default 'uploading',
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_owner_id_idx on public.documents (owner_id);
create index documents_course_id_idx on public.documents (course_id);

create table public.document_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  section_index integer not null check (section_index >= 0),
  page_number integer check (page_number > 0),
  heading text,
  source_text text not null,
  created_at timestamptz not null default now(),
  unique (document_id, section_index)
);

create index document_sections_document_id_idx
  on public.document_sections (document_id);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  section_id uuid references public.document_sections (id) on delete set null,
  chunk_index integer not null check (chunk_index >= 0),
  page_number integer check (page_number > 0),
  heading text,
  content text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_document_id_idx on public.document_chunks (document_id);

create table public.generated_materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  type public.material_type not null,
  status public.material_status not null default 'draft',
  title text not null default 'Untitled material',
  directions text not null default '',
  generation_settings jsonb not null default '{}'::jsonb,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generated_materials_owner_id_idx
  on public.generated_materials (owner_id);
create index generated_materials_course_id_idx
  on public.generated_materials (course_id);

create table public.material_questions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.generated_materials (id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  prompt text not null,
  question_type text not null check (question_type in ('multiple_choice', 'short_answer', 'other')),
  options jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text not null default '',
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, question_index)
);

create index material_questions_material_id_idx
  on public.material_questions (material_id);

create table public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  title text not null default 'New conversation',
  topic_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tutor_conversations_owner_id_idx
  on public.tutor_conversations (owner_id);
create index tutor_conversations_course_id_idx
  on public.tutor_conversations (course_id);

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tutor_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index tutor_messages_conversation_id_idx
  on public.tutor_messages (conversation_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger courses_set_updated_at
before update on public.courses
for each row execute procedure public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute procedure public.set_updated_at();

create trigger generated_materials_set_updated_at
before update on public.generated_materials
for each row execute procedure public.set_updated_at();

create trigger material_questions_set_updated_at
before update on public.material_questions
for each row execute procedure public.set_updated_at();

create trigger tutor_conversations_set_updated_at
before update on public.tutor_conversations
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.documents enable row level security;
alter table public.document_sections enable row level security;
alter table public.document_chunks enable row level security;
alter table public.generated_materials enable row level security;
alter table public.material_questions enable row level security;
alter table public.tutor_conversations enable row level security;
alter table public.tutor_messages enable row level security;

create policy "Users can view their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can manage their own courses"
on public.courses for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can manage their own documents"
on public.documents for all to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.courses
    where courses.id = documents.course_id
      and courses.owner_id = (select auth.uid())
  )
);

create policy "Users can manage sections from their own documents"
on public.document_sections for all to authenticated
using (
  exists (
    select 1 from public.documents
    where documents.id = document_sections.document_id
      and documents.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.documents
    where documents.id = document_sections.document_id
      and documents.owner_id = (select auth.uid())
  )
);

create policy "Users can manage chunks from their own documents"
on public.document_chunks for all to authenticated
using (
  exists (
    select 1 from public.documents
    where documents.id = document_chunks.document_id
      and documents.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.documents
    where documents.id = document_chunks.document_id
      and documents.owner_id = (select auth.uid())
  )
);

create policy "Users can manage their own generated materials"
on public.generated_materials for all to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and (
    course_id is null
    or exists (
      select 1 from public.courses
      where courses.id = generated_materials.course_id
        and courses.owner_id = (select auth.uid())
    )
  )
);

create policy "Users can manage questions in their own materials"
on public.material_questions for all to authenticated
using (
  exists (
    select 1 from public.generated_materials
    where generated_materials.id = material_questions.material_id
      and generated_materials.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.generated_materials
    where generated_materials.id = material_questions.material_id
      and generated_materials.owner_id = (select auth.uid())
  )
);

create policy "Users can manage their own tutor conversations"
on public.tutor_conversations for all to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and (
    course_id is null
    or exists (
      select 1 from public.courses
      where courses.id = tutor_conversations.course_id
        and courses.owner_id = (select auth.uid())
    )
  )
);

create policy "Users can manage messages in their own conversations"
on public.tutor_messages for all to authenticated
using (
  exists (
    select 1 from public.tutor_conversations
    where tutor_conversations.id = tutor_messages.conversation_id
      and tutor_conversations.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.tutor_conversations
    where tutor_conversations.id = tutor_messages.conversation_id
      and tutor_conversations.owner_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy "Users can manage files in their own course-materials folder"
on storage.objects for all to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
