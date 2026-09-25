import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function ReportModal({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('Harassment');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
            <h2 className="text-xl font-bold text-red-400">Report User</h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-200">
              Reporting this user will immediately end the chat and block them permanently.
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Reason</label>
              <select 
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500 transition-colors text-slate-200"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option>Nudity/Sexual content</option>
                <option>Harassment</option>
                <option>Underage user</option>
                <option>Spam</option>
                <option>Hate speech</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Description (Optional)</label>
              <textarea 
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500 transition-colors text-slate-200 resize-none h-24"
                placeholder="Provide more details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-800/30">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                onSubmit(reason, description);
                onClose();
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg shadow-red-500/20 transition-colors"
            >
              Submit Report
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
