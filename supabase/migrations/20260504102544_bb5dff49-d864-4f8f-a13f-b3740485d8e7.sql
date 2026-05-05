
-- Lock search_path on all functions
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_deal_number() SET search_path = public;

-- Restrict SECURITY DEFINER functions: revoke from public/anon, allow only authenticated
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_role(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_role(UUID) TO authenticated;
-- handle_new_user is only called by trigger, no direct execute needed
