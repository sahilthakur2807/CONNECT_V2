import { Routes, Route, Navigate } from "react-router";
import { useAppSelector } from "@/store";
import { AppLayout } from "@/components/layout/AppLayout";
import AppealsView from "@/components/shared/AppealsView";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import OnboardingPage from "@/pages/OnboardingPage";
import HomeDashboard from "@/pages/HomeDashboard";
import RoomDiscovery from "@/pages/RoomDiscovery";
import DiscussionsDashboard from "@/pages/DiscussionsDashboard";
import DiscussionRoom from "@/pages/DiscussionRoom";
import UserProfile from "@/pages/UserProfile";
import NotificationCenter from "@/pages/NotificationCenter";
import ModeratorDashboard from "@/pages/ModeratorDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import CommunitiesPage from "@/pages/CommunitiesPage";
import WorldChatPage from "@/pages/WorldChatPage";
import VerifyEmail from "@/pages/VerifyEmail";

// Route protection wrapper for authenticated routes
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Route protection wrapper for moderator actions
function ModeratorRoute({ children }) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  const isMod =
    user && ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(user.role);
  if (!isMod) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

// Route protection wrapper for admin controls
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  const isAdmin = user && ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role);
  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function App() {
  const { refreshSession, user } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const { userRestriction } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (user) {
          await refreshSession();
        }
      } catch (err) {
        console.error("Failed to refresh session on startup:", err);
      } finally {
        setInitialized(true);
      }
    };
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialized && user) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Restoring session...
        </p>
      </div>
    );
  }

  if (userRestriction) {
    return <AppealsView />;
  }

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Standalone Protected Onboarding Flow */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* Protected Pages wrapped in AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<HomeDashboard />} />
        <Route path="/discover" element={<RoomDiscovery />} />
        <Route path="/discussions" element={<DiscussionsDashboard />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/world-chat" element={<WorldChatPage />} />
        <Route path="/room/:roomId" element={<DiscussionRoom />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/profile/:id" element={<UserProfile />} />
        <Route path="/notifications" element={<NotificationCenter />} />

        {/* Moderator Command */}
        <Route
          path="/moderator"
          element={
            <ModeratorRoute>
              <ModeratorDashboard />
            </ModeratorRoute>
          }
        />

        {/* Admin Center */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
