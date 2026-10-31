import { createContext, useContext, useEffect, useState } from 'react';
import { api, jsonBody } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ user: null, loading: true });

  async function refresh() {
    try {
      const data = await api('/api/auth/me');
      setAuth({ user: data.user, loading: false });
    } catch {
      setAuth({ user: null, loading: false });
    }
  }

  useEffect(() => { refresh(); }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setAuth({ user: null, loading: false });
  }

  async function login(username, password) {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: jsonBody({ username, password })
    });
    setAuth({ user: res.user, loading: false });
    return res;
  }

  async function register(username, password, confirmPassword, displayName) {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: jsonBody({ username, password, confirmPassword, displayName })
    });
    setAuth({ user: res.user, loading: false });
    return res;
  }

  async function resetPassword(username, newPassword, confirmPassword) {
    const res = await api('/api/auth/reset-password', {
      method: 'POST',
      body: jsonBody({ username, newPassword, confirmPassword })
    });
    setAuth({ user: res.user, loading: false });
    return res;
  }

  return <AuthContext.Provider value={{ ...auth, refresh, logout, login, register, resetPassword }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
