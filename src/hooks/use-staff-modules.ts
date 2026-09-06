import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { STAFF_MODULE_ROUTES, type StaffModule } from "@/lib/staff-modules";
import { useAuth } from "./use-auth";
import { useIsAdmin } from "./use-admin";

/** Modules confiés à l'utilisateur connecté (délégations actives). */
export function useStaffModules() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["staff-modules", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_assignments")
        .select("module, is_active, note")
        .eq("user_id", user!.id)
        .eq("is_active", true);
      if (error) return [];
      return (data ?? []).map((r) => r.module as StaffModule);
    },
  });

  const modules = data ?? [];
  const allowedRoutes = modules.flatMap((m) => STAFF_MODULE_ROUTES[m] ?? []);

  return {
    modules,
    allowedRoutes,
    isStaff: modules.length > 0,
    isAdmin,
    canAccessAdmin: isAdmin || modules.length > 0,
    loading: loading || isLoading || adminLoading,
  };
}
