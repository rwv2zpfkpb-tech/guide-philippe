// Hardcoded primary admin (site owner). This account is bootstrapped as
// admin via migration 20260715000004_hardcode_primary_admin.sql and can
// never be demoted or deleted through the admin UI (see assertNotPrimaryAdmin
// in app/actions/profiles.ts) — regardless of who's logged in or how many
// other admins exist. Guarantees the app can never end up locked out of
// its own admin dashboard.
export const PRIMARY_ADMIN_EMAIL = "uhllucas@icloud.com";
