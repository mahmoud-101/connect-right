import { Navigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
