-- Notifications for invoices. Their own migration: Postgres won't let a new enum value be used in the same transaction
-- that adds it.
alter type public.notification_kind add value if not exists 'invoice_sent';
alter type public.notification_kind add value if not exists 'invoice_cancelled';
