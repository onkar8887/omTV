import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import useAuthStore from './store/useAuthStore'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import ChatRoom from './pages/ChatRoom'
import { motion } from 'framer-motion'

function Home() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <h1 className="text-5xl font-bold text-indigo-500 mb-6 tracking-tight">OmTV</h1>
        <p className="text-xl text-slate-300 mb-8 max-w-md mx-auto">
          Connect with strangers around the world in real-time.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/login" className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors border border-slate-700">
            Log In
          </Link>
          <Link to="/signup" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/30">
            Sign Up
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

// Removed inline Dashboard component

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) return <div className="h-screen bg-slate-900 flex items-center justify-center text-indigo-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute>
            <ChatRoom />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
