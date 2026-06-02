// src/components/BudgetTracker.jsx
// НОВЫЙ ФАЙЛ — вставить в src/components/BudgetTracker.jsx

import React from 'react';
import { motion } from 'framer-motion';

export default function BudgetTracker({ budget, spent }) {
  const pct = Math.min((spent / budget) * 100, 100);
  const over = spent > budget;
  const remaining = budget - spent;

  const color = pct < 60 ? '#10b981' : pct < 85 ? '#f59e0b' : '#ef4444';
  const label = pct < 60 ? '✅ Отлично' : pct < 85 ? '⚠️ Внимание' : over ? '🔴 Превышен!' : '🔶 На пределе';

  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>
          💰 Бюджет
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${color}20`, color }}>
          {label}
        </span>
      </div>

      {/* Bar */}
      <div className="relative h-3 rounded-full overflow-hidden"
        style={{ background: 'var(--input-bg)' }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {/* Glow effect */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full opacity-40 blur-sm"
          style={{ background: color }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--text-muted)' }}>
          Потрачено: <strong style={{ color }}>${spent.toLocaleString()}</strong>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {over
            ? <span style={{ color: '#ef4444' }}>Перерасход: ${Math.abs(remaining).toLocaleString()}</span>
            : <>Остаток: <strong style={{ color: '#10b981' }}>${remaining.toLocaleString()}</strong></>
          }
        </span>
      </div>

      {over && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-center py-2 rounded-xl font-medium"
          style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
        >
          Бюджет превышен на ${Math.abs(remaining).toLocaleString()} — замените позиции
        </motion.div>
      )}
    </div>
  );
}