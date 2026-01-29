import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Verifica se o usuário logado possui role admin.
 * Usa user_roles (RLS: usuário vê apenas seus próprios roles).
 * Backend: policies existentes; sem novas tabelas/enums.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
    enabled: !!user?.id,
  });

  const isAdmin = useMemo(
    () => Array.isArray(roles) && roles.includes("admin"),
    [roles]
  );

  return { isAdmin, loading: isLoading };
}
