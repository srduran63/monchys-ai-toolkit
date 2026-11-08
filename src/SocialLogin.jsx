import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
// The Supabase client is loaded only when a button is pressed (keeps other pages light)
const socialLoginEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const AppleLogo = () => (
  <svg width="18" height="20" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
  </svg>
);

// "Continuar con Apple / Google". next = where to go after signing in.
export default function SocialLogin({ next }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  if (!socialLoginEnabled) return null;

  const start = async (provider) => {
    setBusy(provider);
    setError('');
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    const { supabase } = await import('./supabase');
    const { error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (err) {
      setError('No pudimos abrir el inicio de sesión. Inténtalo de nuevo.');
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => start('apple')}
        disabled={!!busy}
        className="w-full min-h-12 rounded-full bg-black text-white font-semibold flex items-center justify-center gap-3 hover:bg-ink disabled:opacity-60"
      >
        {busy === 'apple' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <AppleLogo />} Continuar con Apple
      </button>
      <button
        type="button"
        onClick={() => start('google')}
        disabled={!!busy}
        className="w-full min-h-12 rounded-full bg-white border-2 border-ink/15 text-ink font-semibold flex items-center justify-center gap-3 hover:bg-cream disabled:opacity-60"
      >
        {busy === 'google' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <GoogleLogo />} Continuar con Google
      </button>
      {error && <p className="text-sm font-bold text-mouth">{error}</p>}
      <div className="flex items-center gap-3 text-xs font-bold text-ink/45 pt-1">
        <span className="h-px flex-1 bg-ink/15" /> o con tu correo <span className="h-px flex-1 bg-ink/15" />
      </div>
    </div>
  );
}
