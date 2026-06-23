import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: string;
  displayName: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

interface SessionResponse {
  user: User;
  isAdmin: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.ok) {
        const data: SessionResponse = await res.json();
        setUser(data.user);
        // isAdmin comes ONLY from the backend response — never derived client-side
        setIsAdmin(data.isAdmin);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // 4.2 On app mount, call GET /api/auth/session to populate AuthContext
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // 4.6 signOut: call POST /api/auth/signout, clear context, re-render as Visitor
  const signOut = useCallback(() => {
    fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
    }).finally(() => {
      setUser(null);
      setIsAdmin(false);
      navigate("/");
    });
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, loading, refreshSession, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
