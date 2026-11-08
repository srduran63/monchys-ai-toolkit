import { createClient } from '@supabase/supabase-js';

// Only used for Google / Apple sign-in (PKCE flow). After the redirect we hand the
// access token to our server, which creates its own session cookie.
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anon ? createClient(url, anon, { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true } }) : null;
export const socialLoginEnabled = Boolean(supabase);
