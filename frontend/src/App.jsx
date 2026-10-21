import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from './store/auth';
import { useTheme } from './lib/theme';
import { FullScreenLoader } from './components/ui/Spinner';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import RoomPage from './pages/RoomPage';
import Invite from './pages/Invite';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

function RequireAuth({ children }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'guest') return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

function GuestOnly({ children }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authed') {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') ? next : '/'} replace />;
  }
  return children;
}

export default function App() {
  const init = useAuth((s) => s.init);
  const theme = useTheme((s) => s.theme);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="messages" element={<Messages />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="r/:roomId" element={<RoomPage />} />
          <Route path="invite/:code" element={<Invite />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/:tab" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster
        theme={theme === 'light' ? 'light' : 'dark'}
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }}
      />
    </>
  );
}
