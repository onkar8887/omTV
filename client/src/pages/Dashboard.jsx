import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { motion } from 'framer-motion';
import { Country, State } from 'country-state-city';

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const navigate = useNavigate();

  const [gender, setGender] = useState('');
  const [countryIso, setCountryIso] = useState('');
  const [stateIso, setStateIso] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const countries = Country.getAllCountries();
  const states = countryIso ? State.getStatesOfCountry(countryIso) : [];

  const handleUpdateGender = async (e) => {
    e.preventDefault();
    if (!gender || !countryIso) return;
    if (states.length > 0 && !stateIso) return;
    setIsUpdating(true);
    const countryName = Country.getCountryByCode(countryIso)?.name || '';
    let stateName = '';
    if (stateIso) {
      stateName = State.getStateByCodeAndCountry(stateIso, countryIso)?.name || '';
    }
    await updateProfile(gender, countryName, stateName);
    setIsUpdating(false);
  };

  const handleStartChat = () => {
    navigate('/chat');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white p-4">
      <div className="max-w-md w-full text-center bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
        <h1 className="text-3xl font-bold text-indigo-500 mb-2">Dashboard</h1>
        <p className="mb-6 text-slate-300">Welcome, {user?.name}</p>

        {!user?.gender || !user?.country ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-slate-700/50 p-4 rounded-xl border border-slate-600"
          >
            <h3 className="text-lg font-medium mb-2 text-indigo-300">Complete your profile</h3>
            <p className="text-sm text-slate-400 mb-4">Please complete your profile before you can start chatting.</p>
            <form onSubmit={handleUpdateGender} className="space-y-4">
              <select 
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-slate-300"
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
              
              <select 
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-slate-300"
                value={countryIso}
                onChange={(e) => { setCountryIso(e.target.value); setStateIso(''); }}
                required
              >
                <option value="" disabled>Select Country</option>
                {countries.map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                ))}
              </select>

              <select 
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-slate-300 disabled:opacity-50"
                value={stateIso}
                onChange={(e) => setStateIso(e.target.value)}
                required={states.length > 0}
                disabled={!countryIso || states.length === 0}
              >
                <option value="" disabled>Select State</option>
                {states.map((s) => (
                  <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                ))}
              </select>
              <button 
                type="submit" 
                disabled={isUpdating}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
            </form>
          </motion.div>
        ) : (
          <div className="mb-8 space-y-4">
            <button 
              onClick={handleStartChat}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all transform hover:scale-[1.02]"
            >
              Start Chat
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-slate-700">
          <button onClick={logout} className="px-4 py-2 text-sm text-slate-400 hover:text-red-400 transition-colors">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
