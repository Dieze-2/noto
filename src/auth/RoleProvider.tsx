import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getUserRoles, AppRole } from "@/db/roles";
import { useAuth } from "@/auth/AuthProvider";

interface RoleContextType {
  roles: AppRole[];
  isCoach: boolean;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => void;
}

const RoleContext = createContext<RoleContextType>({
  roles: [],
  isCoach: false,
  isAdmin: false,
  loading: true,
  refresh: () => {},
});

export function useRoles() {
  return useContext(RoleContext);
}

export default function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = () => {
    if (!user) { setRoles([]); setLoading(false); return; }
    setLoading(true);
    getUserRoles()
      .then(setRoles)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoles(); }, [user?.id]);

  return (
    <RoleContext.Provider value={{
      roles,
      isCoach: roles.includes("coach"),
      isAdmin: roles.includes("admin"),
      loading,
      refresh: fetchRoles,
    }}>
      {children}
    </RoleContext.Provider>
  );
}
