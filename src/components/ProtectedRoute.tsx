import { Navigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
