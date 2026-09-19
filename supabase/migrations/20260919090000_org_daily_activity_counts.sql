-- Org dashboard hero card: 60 daily activity counts (quiz_attempts +
-- slide_views combined) for the org's members, computed in Postgres so it
-- scales the same way the rest of the org dashboard's aggregates do (orgs
-- range from 2 to 10,000 learners — fetching raw event timestamps into
-- Node for this would not scale).
create function public.org_daily_activity_counts(p_org_id uuid)
returns table (
  day_offset integer,
  event_count integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized';
  end if;

  return query
  with days as (
    select gs as day_offset, (current_date - (59 - gs)) as day_date
    from generate_series(0, 59) as gs
  ),
  events as (
    select qa.created_at::date as event_date
    from public.quiz_attempts qa
    join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
    where qa.created_at >= now() - interval '60 days'
    union all
    select sv.viewed_at::date as event_date
    from public.slide_views sv
    join public.organization_memberships m on m.user_id = sv.user_id and m.org_id = p_org_id
    where sv.viewed_at >= now() - interval '60 days'
  )
  select d.day_offset, count(e.event_date)::integer as event_count
  from days d
  left join events e on e.event_date = d.day_date
  group by d.day_offset
  order by d.day_offset;
end;
$$;
