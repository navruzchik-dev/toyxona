import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Context ──────────────────────────────────────────────────────────────
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((msg, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);

  const remove = (id) => setToasts(p => p.filter(t => t.id !== id));

  const STYLES = {
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#6ee7b7', icon: '✅' },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: '#f87171', icon: '❌' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: '#fbbf24', icon: '⚠️' },
    info:    { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)', color: '#a5b4fc', icon: 'ℹ️' },
  };

  return (
    <ToastCtx.Provider value={{ add }}>
      {children}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        <AnimatePresence>
          {toasts.map(t => {
            const s = STYLES[t.type] || STYLES.info;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                style={{ background: 'rgba(10,10,20,0.97)', border: `1px solid ${s.border}`, borderRadius: 16, padding: '12px 16px', backdropFilter: 'blur(16px)', pointerEvents: 'auto', boxShadow: `0 8px 32px rgba(0,0,0,0.4)` }}
                className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{s.icon}</span>
                <p className="text-sm leading-snug flex-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.msg}</p>
                <button onClick={() => remove(t.id)} className="text-white/30 hover:text-white/70 transition ml-1 mt-0.5 flex-shrink-0">×</button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);