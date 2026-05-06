import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '@/lib/queryClient';

interface User {
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'ati_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        if (t) {
          const data = await apiRequest<User & { ok: boolean }>('GET', '/api/auth/verify', undefined, t);
          if (data.ok) {
            setToken(t);
            setUser({ name: data.name, email: data.email, role: data.role });
          } else {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          }
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const data = await apiRequest<{ token: string; name: string }>('POST', '/api/auth/login', { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setToken(data.token);
    const me = await apiRequest<User & { ok: boolean }>('GET', '/api/auth/verify', undefined, data.token);
    setUser({ name: me.name, email: me.email, role: me.role });
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
