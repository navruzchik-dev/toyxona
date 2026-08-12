import React from 'react';
import { motion } from 'framer-motion';

/**
 * Светлый лоадер ИИ-конструктора (без тёмного оверлея).
 */
export default function AILoader({ text = 'Подбираем идеальный пакет…' }) {
  return (
    <div className="w-full min-h-[280px] flex flex-col items-center justify-center py-12 px-4 rounded-2xl"
      style={{
        background: 'linear-gradient(165deg, color-mix(in srgb, var(--gold) 8%, var(--bg2)) 0%, var(--bg2) 100%)',
        border: '1px solid rgba(var(--gold-rgb),0.18)',
      }}>
      {/* soft gold orb */}
      <div className="relative w-28 h-28 mb-6">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(var(--gold-rgb),0.35), transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-3 rounded-full border-2"
          style={{ borderColor: 'rgba(var(--gold-rgb),0.35)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-6 rounded-full border-2 border-dashed"
          style={{ borderColor: 'rgba(var(--gold-rgb),0.5)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-3xl">💍</div>
      </div>

      <p className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--text)' }}>{text}</p>

      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--gold)' }}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>

      <p className="text-[11px] mt-5 max-w-xs text-center leading-relaxed" style={{ color: 'var(--text2)' }}>
        Ищем зал, артиста, кортеж и декор под ваш бюджет и число гостей
      </p>
    </div>
  );
}
