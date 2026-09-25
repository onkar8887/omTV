import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const register = useAuthStore((state) => state.register);
  const googleLogin = useAuthStore((state) => state.googleLogin);
  const error = useAuthStore((state) => state.error);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await register(name, email, password, gender);
    if (success) navigate('/dashboard');
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const success = await googleLogin(credentialResponse.credential);
    if (success) navigate('/dashboard');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-slate-800 rounded-2xl shadow-xl border border-slate-700"
      >
        <h2 className="text-3xl font-bold text-center mb-6 text-indigo-500">Create Account</h2>
        {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4 text-sm text-center">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Name</label>
            <input 
              type="text" 
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
            <input 
              type="email" 
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Password</label>
            <input 
              type="password" 
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Gender</label>
            <select 
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors text-slate-300"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
            >
              <option value="" disabled>Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <button 
            type="submit" 
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors"
          >
            Sign Up
          </button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-slate-700"></div>
          <span className="px-3 text-slate-400 text-sm">OR</span>
          <div className="flex-1 border-t border-slate-700"></div>
        </div>

        <div className="flex justify-center">
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'your_google_client_id' ? (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                console.log('Login Failed');
              }}
              theme="filled_black"
              shape="rectangular"
              text="continue_with"
              size="large"
            />
          ) : (
            <div className="text-sm text-slate-500 italic">
              Google Login disabled (Client ID not configured)
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-slate-400 text-sm">
          Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300">Log in</Link>
        </div>
      </motion.div>
    </div>
  );
}
