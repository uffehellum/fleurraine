import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-text/60">Loading…</p>
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(
      location.pathname + location.search + location.hash
    );
    return <Navigate to={`/sign-in?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
