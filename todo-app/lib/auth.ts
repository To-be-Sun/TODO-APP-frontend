const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const authService = {
  async signup(email: string, password: string, username?: string) {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Signup failed');
    }
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Login failed');
    }
    return res.json();
  },

  async getMe(token: string) {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to get user');
    return res.json();
  },

  saveToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  },

  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  },

  removeToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  },

  getOAuthUrl(provider: 'google' | 'github') {
    return `${API_URL}/api/auth/${provider}/login`;
  },
};
