import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { accountApi, api } from './api';

// Who is signed in, what they have, and the public catalog: shared by every customer page.
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    subscriptions: [],
    access: new Set(),
    ai: false,
    payments: 'demo', // 'stripe' when real payments are on
    billing: false, // has a Stripe customer (invoices, card)
    products: [],
    error: false,
  });

  const apply = (account) =>
    setState((s) => ({
      ...s,
      user: account.user,
      subscriptions: account.subscriptions,
      access: new Set(account.access),
      ai: Boolean(account.ai),
      payments: account.payments ?? s.payments,
      billing: Boolean(account.billing),
    }));

  useEffect(() => {
    Promise.all([accountApi.me(), api.products()])
      .then(([account, products]) => {
        setState((s) => ({ ...s, loading: false, products }));
        apply(account);
      })
      .catch(() => setState((s) => ({ ...s, loading: false, error: true })));
  }, []);

  const logout = useCallback(async () => {
    await accountApi.logout().catch(() => {});
    window.location.href = '/';
  }, []);

  return <SessionContext.Provider value={{ ...state, apply, logout }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

// Subscription for a product (not expired), if any.
export const subscriptionFor = (session, productId) => session.subscriptions.find((s) => s.productId === productId);

// The active plan that already includes this product, if any.
export const includedBy = (session, productId) =>
  session.products.find((p) => p.includes?.includes(productId) && subscriptionFor(session, p.id));

// Only allow same-site relative redirects after login.
export const safeNext = (value) => (typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : null);

export const goToLogin = (next = window.location.pathname) => {
  window.location.href = `/registro?next=${encodeURIComponent(next)}`;
};

export const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
