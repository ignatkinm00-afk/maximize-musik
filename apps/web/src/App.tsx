import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { ToastHost } from './components/ui';
import { useAuth } from './store/auth';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
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
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
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
