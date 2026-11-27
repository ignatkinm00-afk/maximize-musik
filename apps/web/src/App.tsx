import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { ThemeRuntime } from './components/ThemeFx';
import { ToastHost } from './components/ui';
import { useAuth } from './store/auth';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { DownloadsPage } from './pages/DownloadsPage';
import { FeedPage } from './pages/FeedPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { RoomPage } from './pages/RoomPage';
import { RoomsPage } from './pages/RoomsPage';
import { YearReviewPage } from './pages/YearReviewPage';
import { LibraryPage } from './pages/LibraryPage';
import { LocalPage } from './pages/LocalPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { ThemesPage } from './pages/ThemesPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminTracks } from './pages/admin/AdminTracks';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminBroadcast } from './pages/admin/AdminBroadcast';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  const ready = useAuth((state) => state.ready);
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  const ready = useAuth((state) => state.ready);
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <ThemeRuntime />
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="themes" element={<ThemesPage />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route
            path="year"
            element={
              <RequireAuth>
                <YearReviewPage />
              </RequireAuth>
            }
          />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="room/:id" element={<RoomPage />} />
          <Route path="u/:id" element={<ProfilePage />} />
          <Route path="local" element={<LocalPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route
            path="library"
            element={
              <RequireAuth>
                <LibraryPage />
              </RequireAuth>
            }
          />
          <Route
            path="playlist/:id"
            element={
              <RequireAuth>
                <PlaylistPage />
              </RequireAuth>
            }
          />
          <Route
            path="notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="tracks" element={<AdminTracks />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="broadcast" element={<AdminBroadcast />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <ToastHost />
    </HashRouter>
  );
}
