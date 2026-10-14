-- Two new kinds of notification, for the person running the service: someone sent feedback, someone asked
-- for a plan. This has to be its own migration: Postgres won't let a new enum value be used in the same
-- transaction that adds it.
alter type public.notification_kind add value if not exists 'feedback_received';
alter type public.notification_kind add value if not exists 'plan_requested';
