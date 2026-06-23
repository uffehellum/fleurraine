import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Forbidden from "../pages/Forbidden";

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-text/60">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in?returnTo=%2Fadmin%2Fqueue" replace />;
  }

  if (!isAdmin) {
    return <Forbidden />;
  }

  return <>{children}</>;
}
