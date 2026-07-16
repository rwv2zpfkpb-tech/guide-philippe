-- ============================================================
-- Fix: admins could not actually approve/reject registrations.
-- Found while testing the Freischalten/Ablehnen buttons (2026-07-15) —
-- profiles only had a "self update" RLS policy (auth.uid() = id), so
-- approveProfile()/rejectProfile() silently updated 0 rows (no error,
-- no match) whenever an admin tried to change *someone else's* status.
-- The UI looked like it worked (no thrown error, optimistic row removal)
-- while the database never changed.
-- ============================================================

create policy "profiles: admin update"
  on public.profiles for update
  using     (public.is_admin())
  with check (public.is_admin());
