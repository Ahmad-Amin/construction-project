-- A homeowner who sees the "get updates on WhatsApp" card and taps "Not now" is not asked again.
alter table public.profiles add column whatsapp_prompt_dismissed_at timestamptz;
grant update (whatsapp_prompt_dismissed_at) on public.profiles to authenticated;
