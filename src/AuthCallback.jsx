import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AppHeader from './AppHeader';
import { accountApi } from './api';
import { safeNext } from './session';

// Return page of Google / Apple sign-in: exchange the code with Supabase, then open our own session.
export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = safeNext(params.get('next')) ?? '/perfil';
    (async () => {
      try {
        if (params.get('error')) throw new Error(params.get('error_description') || 'Cancelaste el inicio de sesión.');
        const code = params.get('code');
        const { supabase } = await import('./supabase');
        if (!supabase || !code) throw new Error('Falta la respuesta del inicio de sesión.');
        const { data, error: err } = await supabase.auth.exchangeCodeForSession(code);
        if (err) throw err;
        await accountApi.oauth(data.session.access_token);
        await supabase.auth.signOut({ scope: 'local' }); // our cookie is the session from now on
        window.location.replace(next);
      } catch (err) {
        setError(err.message || 'No pudimos completar el inicio de sesión.');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-cream text-ink font-sans">
      <AppHeader />
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        {error ? (
          <>
            <h1 className="font-display font-bold text-fluid-h1">No pudimos iniciar tu sesión</h1>
            <p className="text-ink/65 mt-2">{error}</p>
            <a href="/entrar" className="btn btn-red px-6 py-3 mt-6">
              Volver a intentarlo
            </a>
          </>
        ) : (
          <p className="font-bold text-ink/60 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Iniciando sesión…
          </p>
        )}
      </main>
    </div>
  );
}
