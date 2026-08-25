create or replace function public.auth_email()
returns text
language sql
stable
set search_path = public
as $$ select lower(auth.jwt() ->> 'email') $$;

revoke execute on function public.auth_email() from public, anon;
revoke execute on function public.current_profile_id() from public, anon;
revoke execute on function public.current_profile_role() from public, anon;