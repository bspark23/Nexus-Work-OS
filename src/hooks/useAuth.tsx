import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/config";
import type { AppRole, Profile } from "@/lib/types";

type AuthCtx = {
  user: (User & { id: string }) | null;
  profile: Profile | null;
  role: AppRole | null;
  /** Super Admin — unrestricted, company-wide access. */
  isAdmin: boolean;
  /** Department Admin — scoped to their own department. */
  isDeptAdmin: boolean;
  /** Either kind of admin. */
  canManage: boolean;
  departmentId: string | null;
  loading: boolean;
  refreshProfile: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  role: null,
  isAdmin: false,
  isDeptAdmin: false,
  canManage: false,
  departmentId: null,
  loading: true,
  refreshProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User & { id: string }) | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // Add `id` as an alias for `uid` for backward compatibility
      setUser(u ? Object.assign(u, { id: u.uid }) : null);
      setAuthReady(true);
      if (!u) {
        setProfile(null);
        setRole(null);
        setProfileReady(true);
      }
    });
    return unsub;
  }, []);

  // Listen to Firestore profile + role in real time
  useEffect(() => {
    if (!user) return;
    setProfileReady(false);

    // Profile listener
    const unsubProfile = onSnapshot(
      doc(db, "profiles", user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() } as Profile);
        } else {
          setProfile(null);
        }
        setProfileReady(true);
      },
      () => setProfileReady(true),
    );

    // Role listener
    const unsubRole = onSnapshot(
      doc(db, "user_roles", user.uid),
      (snap) => {
        if (snap.exists()) {
          setRole((snap.data()?.["role"] as AppRole) ?? null);
        } else {
          setRole(null);
        }
      },
    );

    return () => {
      unsubProfile();
      unsubRole();
    };
  }, [user, refreshKey]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      profile,
      role,
      isAdmin: role === "super_admin",
      isDeptAdmin: role === "admin",
      canManage: role === "super_admin" || role === "admin",
      departmentId: profile?.department_id ?? null,
      loading: !authReady || (!!user && !profileReady),
      refreshProfile: () => setRefreshKey((k) => k + 1),
    }),
    [user, profile, role, authReady, profileReady],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
