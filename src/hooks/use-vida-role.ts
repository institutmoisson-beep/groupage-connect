import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type VidaRole = "agent" | "courier" | "vendor";

/** Vérifie si l'utilisateur connecté a le rôle ViDa donné, approuvé et non suspendu. */
export function useVidaRole(role: VidaRole) {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["vida-role", role, user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_roles")
        .select("is_approved, is_suspended")
        .eq("user_id", user!.id)
        .eq("role", role)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const hasRole = !!data && data.is_approved && !data.is_suspended;
  const isPending = !!data && !data.is_approved && !data.is_suspended;

  return { hasRole, isPending, loading: loading || isLoading };
}
