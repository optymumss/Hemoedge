-- handle_new_user's CASE expression resolves to text (both branches are
-- string literals with no other type context), but profiles.role is the
-- app_role enum — there's no implicit text->app_role assignment cast, so
-- every signup/invite has been failing with "Database error saving new
-- user" (42804) since this trigger was first created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    (case when new.email = 'consultant@optymumss.com' then 'super_admin' else 'member' end)::app_role
  );
  return new;
end;
$$;
