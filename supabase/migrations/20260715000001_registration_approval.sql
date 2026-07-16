-- ============================================================
-- Guide Philippe – Zugriffsmodell: Login-Pflicht + Registrierungs-Freischaltung
-- ============================================================

-- ── profiles.status ─────────────────────────────────────────
-- Default 'approved' backfills existing rows (niemand wird ausgesperrt),
-- danach wird der Default auf 'pending' umgestellt, damit NEUE Signups
-- erst durch einen Admin freigeschaltet werden müssen.
alter table public.profiles
  add column status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected'));

alter table public.profiles
  alter column status set default 'pending';

-- ── is_approved() ────────────────────────────────────────────
create or replace function public.is_approved()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from   public.profiles
    where  id = auth.uid()
    and    status = 'approved'
  );
$$;

-- ── profiles: Lesezugriff einschränken ───────────────────────
-- Bisher "public read" (using true) — jetzt: eigenes Profil immer lesbar,
-- Admins lesen alle (Freischalt-Dashboard), sonst nur wenn selbst approved
-- (nötig, um z.B. Kommentar-Autoren-Usernamen anzuzeigen).
drop policy if exists "profiles: public read" on public.profiles;

create policy "profiles: approved or self or admin read"
  on public.profiles for select
  using (public.is_approved() or auth.uid() = id or public.is_admin());

-- ── restaurants: nur approved lesen ───────────────────────────
drop policy if exists "restaurants: public read" on public.restaurants;

create policy "restaurants: approved read"
  on public.restaurants for select
  using (public.is_approved() or public.is_admin());

-- ── comments: nur approved lesen ──────────────────────────────
drop policy if exists "comments: public read" on public.comments;

create policy "comments: approved read"
  on public.comments for select
  using (public.is_approved() or public.is_admin());

-- Pending/rejected accounts dürfen nicht kommentieren (nur approved)
drop policy if exists "comments: authenticated insert" on public.comments;

create policy "comments: approved insert"
  on public.comments for insert
  with check (auth.uid() = user_id and public.is_approved());
