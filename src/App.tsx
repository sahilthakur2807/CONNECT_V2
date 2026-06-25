import { Routes, Route, Navigate } from 'react-router';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { HomeDashboard } from '@/pages/HomeDashboard';
import { RoomDiscovery } from '@/pages/RoomDiscovery';
import { DiscussionsDashboard } from '@/pages/DiscussionsDashboard';
import { DiscussionRoom } from '@/pages/DiscussionRoom';
import { UserProfile } from '@/pages/UserProfile';
import { NotificationCenter } from '@/pages/NotificationCenter';
import { ModeratorDashboard } from '@/pages/ModeratorDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { Navbar } from '@/components/layout/Navbar';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/hooks/use-auth';

function RoomLayout() {
  return (
    <div className="flex flex-col h-screen bg-secondary/40 overflow-hidden">
      <Navbar />
      <DiscussionRoom />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:font-medium"
        >
          Skip to main content
        </a>

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomeDashboard />} />
            <Route path="/discover" element={<RoomDiscovery />} />
            <Route path="/discussions" element={<DiscussionsDashboard />} />
            <Route path="/notifications" element={<NotificationCenter />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/profile/:id" element={<UserProfile />} />
            <Route path="/moderator" element={<ModeratorDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route path="/room/:roomId" element={<RoomLayout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
