-- ============================================================
-- Fix: handle_new_user() never persisted the signup username.
-- Found while testing the registration-approval admin UI (2026-07-15) —
-- signUp() passes `data: { username }` to auth.signUp(), which lands in
-- auth.users.raw_user_meta_data, but the trigger only ever inserted the id,
-- so profiles.username stayed null for every normal (email-confirmation)
-- signup. Admins had no way to tell pending accounts apart.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;
