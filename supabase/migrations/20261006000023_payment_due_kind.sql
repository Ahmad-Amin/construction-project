-- A new kind of notification, for "a scheduled payment is due". This has to be its own
-- migration: Postgres won't let a new enum value be used in the same transaction that adds it.
alter type public.notification_kind add value if not exists 'payment_due';
