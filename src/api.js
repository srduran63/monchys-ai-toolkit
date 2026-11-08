async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  products: () => request('/api/products'),
  me: () => request('/api/auth/me'),
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  adminProducts: () => request('/api/admin/products'),
  createProduct: (product) => request('/api/admin/products', { method: 'POST', body: product }),
  updateProduct: (id, product) =>
    request(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: product }),
  deleteProduct: (id) => request(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const assistantApi = {
  chat: (messages) => request('/api/asistente/chat', { method: 'POST', body: { messages } }),
  // XHR for upload progress
  upload(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/asistente/archivos');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* not JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data?.error || (xhr.status === 413 ? 'El archivo es demasiado grande.' : 'No se pudo subir el archivo.')));
      };
      xhr.onerror = () => reject(new Error('Sin conexión. Revisa tu internet.'));
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },
};

export const guideApi = {
  chat: (messages) => request('/api/guide/chat', { method: 'POST', body: { messages } }),
};

export const bookingApi = {
  business: (slug) => request(`/api/booking/${encodeURIComponent(slug)}`),
  slots: (slug, service, date) =>
    request(`/api/booking/${encodeURIComponent(slug)}/slots?service=${encodeURIComponent(service)}&date=${date}`),
  book: (slug, data) => request(`/api/booking/${encodeURIComponent(slug)}/bookings`, { method: 'POST', body: data }),
  chat: (slug, messages) => request(`/api/booking/${encodeURIComponent(slug)}/chat`, { method: 'POST', body: { messages } }),
  // admin
  list: () => request('/api/admin/businesses'),
  get: (id) => request(`/api/admin/businesses/${encodeURIComponent(id)}`),
  create: (b) => request('/api/admin/businesses', { method: 'POST', body: b }),
  update: (id, b) => request(`/api/admin/businesses/${encodeURIComponent(id)}`, { method: 'PUT', body: b }),
  remove: (id) => request(`/api/admin/businesses/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setBookingStatus: (id, bookingId, status) =>
    request(`/api/admin/businesses/${encodeURIComponent(id)}/bookings/${encodeURIComponent(bookingId)}`, {
      method: 'PATCH',
      body: { status },
    }),
};

export const accountApi = {
  me: () => request('/api/account/me'),
  register: (data) => request('/api/account/register', { method: 'POST', body: data }),
  login: (email, password) => request('/api/account/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/account/logout', { method: 'POST' }),
  updateProfile: (name) => request('/api/account/profile', { method: 'PUT', body: { name } }),
  changePassword: (current, next) => request('/api/account/password', { method: 'PUT', body: { current, next } }),
  // Returns the account (demo or resumed) or { checkoutUrl } to pay with Stripe
  activate: (productId, returnPath) => request('/api/account/subscriptions', { method: 'POST', body: { productId, returnPath } }),
  confirmCheckout: (sessionId) => request('/api/account/checkout/confirm', { method: 'POST', body: { sessionId } }),
  billingPortal: () => request('/api/account/billing-portal', { method: 'POST' }),
  cancel: (productId) => request(`/api/account/subscriptions/${encodeURIComponent(productId)}/cancel`, { method: 'POST' }),
  businesses: () => request('/api/account/businesses'),
  // admin
  adminUsers: () => request('/api/admin/users'),
  adminAiUsage: () => request('/api/admin/ai-usage'),
  adminFreeAccess: () => request('/api/admin/users/acceso-gratis'),
  saveFreeAccess: (emails) => request('/api/admin/users/acceso-gratis', { method: 'PUT', body: { emails } }),
  oauth: (accessToken) => request('/api/account/oauth', { method: 'POST', body: { accessToken } }),
};

// JSON calls for a tool's API, e.g. tool('ahorro').post('/entries', {...})
export const tool = (name) => {
  const base = `/api/tools/${name}`;
  return {
    get: (path = '') => request(base + path),
    post: (path, body) => request(base + path, { method: 'POST', body }),
    put: (path, body) => request(base + path, { method: 'PUT', body }),
    patch: (path, body) => request(base + path, { method: 'PATCH', body }),
    del: (path) => request(base + path, { method: 'DELETE' }),
  };
};
