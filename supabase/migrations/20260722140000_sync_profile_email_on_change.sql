-- Self-service email change (Settings -> Profile) goes through Supabase's
-- own confirm-link flow: auth.users.email only updates once the user
-- clicks the confirmation link, at which point this keeps profiles.email
-- (used everywhere in the app) in sync.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
