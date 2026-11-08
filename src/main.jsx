import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Store from './Store.jsx';
import Admin from './Admin.jsx';
import Booking from './Booking.jsx';
import ToolPage from './ToolPage.jsx';
import Profile from './Profile.jsx';
import { Login, Register } from './Auth.jsx';
import { SessionProvider } from './session.jsx';
import NotFound from './NotFound.jsx';
import AuthCallback from './AuthCallback.jsx';
import MonchysChat from './MonchysChat.jsx';
import ChatPage from './ChatPage.jsx';
import Legal, { LEGAL_PATHS } from './Legal.jsx';
import './index.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';

// Old address of the free converter
if (path === '/convertir') window.location.replace('/herramientas/convertidor');

const bookingSlug = path.match(/^\/reservar\/([a-z0-9-]+)$/)?.[1];
// The guide chat appears on store pages, not in admin, booking or sign-in screens
const showGuide = !bookingSlug && !['/admin', '/entrar', '/registro', '/auth/callback', '/chat'].includes(path);

function page() {
  if (path === '/admin') return <Admin />;
  if (bookingSlug) return <Booking slug={bookingSlug} />;
  if (path.startsWith('/herramientas/')) return <ToolPage path={path} />;
  if (path === '/chat') return <ChatPage />;
  if (path === '/perfil') return <Profile />;
  if (path === '/entrar') return <Login />;
  if (path === '/registro') return <Register />;
  if (path === '/auth/callback') return <AuthCallback />;
  if (LEGAL_PATHS.includes(path)) return <Legal path={path} />;
  if (path === '/') return <Store />;
  return <NotFound />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SessionProvider>
      {page()}
      {showGuide && <MonchysChat />}
    </SessionProvider>
  </StrictMode>
);
