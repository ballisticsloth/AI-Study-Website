-- Pre-alpha AI cost controls. Usage events intentionally record operational
-- metadata only; prompts, source text, responses, and keys are never logged.

-- Keep already-uploaded 10–20 MB documents intact, while rejecting every new
-- or newly-sized upload above the lower pre-alpha cap.
create or replace function public.enforce_prealpha_document_size_limit()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.byte_size > 10485760 then
    raise exception 'document_size_limit_exceeded';
  end if;
  return new;
end;
$function$;

drop trigger if exists documents_prealpha_size_limit on public.documents;

create trigger documents_prealpha_size_limit
before insert or update of byte_size on public.documents
for each row execute function public.enforce_prealpha_document_size_limit();

update storage.buckets
set file_size_limit = 10485760
where id = 'course-materials';

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('assessment_generation', 'tutor_message')),
  model text not null check (char_length(model) between 1 and 120),
  generation_mode text not null check (generation_mode in ('mock', 'openai')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12, 8) not null default 0 check (estimated_cost_usd >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed')),
  provider_error_code text check (provider_error_code is null or char_length(provider_error_code) <= 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ai_usage_events_owner_feature_created_at_idx
  on public.ai_usage_events (owner_id, feature, created_at desc);

alter table public.ai_usage_events enable row level security;

-- A user can reserve only their own daily quota. The function owns the limits
-- so a browser cannot raise them by sending a different number.
create or replace function public.reserve_ai_usage(
  p_feature text,
  p_model text,
  p_generation_mode text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requesting_user_id uuid := auth.uid();
  daily_limit integer;
  current_usage_count integer;
  usage_event_id uuid;
begin
  if requesting_user_id is null then
    raise exception 'authentication_required';
  end if;

  case p_feature
    when 'assessment_generation' then daily_limit := 5;
    when 'tutor_message' then daily_limit := 30;
    else raise exception 'invalid_ai_usage_feature';
  end case;

  if p_generation_mode not in ('mock', 'openai') then
    raise exception 'invalid_ai_generation_mode';
  end if;

  if char_length(trim(coalesce(p_model, ''))) = 0 or char_length(p_model) > 120 then
    raise exception 'invalid_ai_model';
  end if;

  -- Serialize checks for the same user and feature so concurrent requests
  -- cannot both pass the final available quota slot.
  perform pg_advisory_xact_lock(hashtextextended(requesting_user_id::text || ':' || p_feature, 0));

  select count(*)
  into current_usage_count
  from public.ai_usage_events
  where owner_id = requesting_user_id
    and feature = p_feature
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  if current_usage_count >= daily_limit then
    raise exception 'daily_ai_usage_limit_reached';
  end if;

  insert into public.ai_usage_events (owner_id, feature, model, generation_mode)
  values (requesting_user_id, p_feature, p_model, p_generation_mode)
  returning id into usage_event_id;

  return usage_event_id;
end;
$function$;

-- Only the server's Supabase admin client may finalize a record with actual
-- provider usage. This keeps a browser from changing its cost history.
create or replace function public.complete_ai_usage(
  p_usage_event_id uuid,
  p_status text,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0,
  p_estimated_cost_usd numeric default 0,
  p_provider_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'invalid_ai_usage_status';
  end if;

  if p_input_tokens < 0 or p_output_tokens < 0 or p_estimated_cost_usd < 0 then
    raise exception 'invalid_ai_usage_values';
  end if;

  update public.ai_usage_events
  set
    status = p_status,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    estimated_cost_usd = p_estimated_cost_usd,
    provider_error_code = left(p_provider_error_code, 120),
    completed_at = now()
  where id = p_usage_event_id;

  if not found then
    raise exception 'ai_usage_event_not_found';
  end if;
end;
$function$;

revoke all on table public.ai_usage_events from anon, authenticated;
revoke all on function public.reserve_ai_usage(text, text, text) from public, anon;
revoke all on function public.complete_ai_usage(uuid, text, integer, integer, numeric, text) from public, anon, authenticated;

grant execute on function public.reserve_ai_usage(text, text, text) to authenticated;
grant execute on function public.complete_ai_usage(uuid, text, integer, integer, numeric, text) to service_role;
