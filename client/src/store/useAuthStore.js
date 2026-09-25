import { create } from 'zustand';

const API_URL = 'http://localhost:5000/api/auth';

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Login failed');
      
      set({ user: data, isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  register: async (name, email, password, gender, country, state) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, gender, country, state }),
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Registration failed');
      
      set({ user: data, isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  googleLogin: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include',
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Google login failed');
      
      set({ user: data, isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  updateProfile: async (gender, country, state) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender, country, state }),
        credentials: 'include',
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Profile update failed');
      
      set({ user: data, isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
      set({ user: null });
    } catch (error) {
      console.error('Logout error', error);
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/profile`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        set({ user: data, isLoading: false });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch (error) {
      set({ user: null, isLoading: false });
    }
  }
}));

export default useAuthStore;
