-- The daily reminder of lead follow-ups that are due (migration 50). A new kind has to be committed before anything can
-- use it, so it gets a migration of its own.
alter type public.notification_kind add value if not exists 'lead_follow_up';
