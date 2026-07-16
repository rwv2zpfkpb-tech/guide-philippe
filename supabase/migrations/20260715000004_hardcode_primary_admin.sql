-- ============================================================
-- Bootstrap the hardcoded primary admin (site owner).
-- Kept in sync with PRIMARY_ADMIN_EMAIL in lib/admin.ts, which is used to
-- permanently protect this account from demotion/deletion in the admin UI
-- (see assertNotPrimaryAdmin in app/actions/profiles.ts).
-- Safe to re-run: no-op if the account is already admin/approved.
-- ============================================================

update public.profiles
set role = 'admin', status = 'approved'
where id = (select id from auth.users where email = 'uhllucas@icloud.com');
