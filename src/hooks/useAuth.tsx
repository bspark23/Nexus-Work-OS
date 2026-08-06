import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Profile } from "@/lib/types";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => void;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  profile: null,
  role: null,
  isAdmin: false,
  loading: true,
  refreshProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setReady(true);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      return (data as unknown as Profile) ?? null;
    },
  });

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["my-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .maybeSingle();
      return ((data as unknown as { role: AppRole } | null)?.role ?? null) as AppRole | null;
    },
  });

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profile ?? null,
      role: role ?? null,
      isAdmin: role === "super_admin",
      loading: !ready || (!!userId && (profileLoading || roleLoading)),
      refreshProfile: () => {
        queryClient.invalidateQueries({ queryKey: ["me", userId] });
        queryClient.invalidateQueries({ queryKey: ["my-role", userId] });
      },
    }),
    [session, profile, role, ready, userId, profileLoading, roleLoading, queryClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
