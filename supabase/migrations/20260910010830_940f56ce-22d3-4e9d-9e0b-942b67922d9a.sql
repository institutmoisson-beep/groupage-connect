-- Remove broad downline profile read (exposed phone/PII) and replace with a
-- column-limited security definer function.
drop policy if exists "Referrers view their downline profiles" on public.profiles;

create or replace function public.list_my_referrals()
returns table (
  id uuid,
  full_name text,
  referral_code text,
  city text,
  created_at timestamptz,
  delivered_referrals_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.referral_code, p.city, p.created_at, p.delivered_referrals_count
  from public.profiles p
  where p.referred_by = auth.uid()
$$;

revoke all on function public.list_my_referrals() from public, anon;
grant execute on function public.list_my_referrals() to authenticated;