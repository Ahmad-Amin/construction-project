-- Which guided tours a person has already been shown, so each one starts by itself only once per account,
-- on whatever device they sign in from.
alter table public.profiles
  add column tours_seen text[] not null default '{}';

-- People record a tour through this function only (no direct write to the column), and only the known tours.
create function public.mark_tour_seen(p_tour text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_tour not in ('dashboard', 'project') then
    raise exception 'Unknown tour.' using errcode = 'P0001';
  end if;

  update public.profiles
  set tours_seen = array_append(tours_seen, p_tour)
  where id = auth.uid()
    and not (p_tour = any (tours_seen));
end;
$$;

revoke all on function public.mark_tour_seen(text) from public, anon;
grant execute on function public.mark_tour_seen(text) to authenticated;
