// src/components/HallCompare.jsx
// НОВЫЙ ФАЙЛ — вставить в src/components/HallCompare.jsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HallCompare({ halls, onClose }) {
  const fields = [
    { key: 'max_capacity_people', label: '👥 Вместимость', fmt: v => `${v} чел.` },
    { key: 'seating_capacity',    label: '🪑 Мест за столами', fmt: v => `${v} чел.` },
    { key: 'waiters_count',       label: '🍽️ Официанты', fmt: v => `${v} чел.` },
    { key: 'parking_spaces',      label: '🚗 Парковка', fmt: v => `${v} мест` },
    { key: 'stage_size',          label: '🎭 Сцена', fmt: v => v },
    { key: 'kitchen_type',        label: '🍜 Кухня', fmt: v => v },
    { key: 'has_led_screen',      label: '💡 LED экран', fmt: v => v ? '✅ Есть' : '❌ Нет' },
    { key: 'price_per_day_uzs',   label: '💰 Цена/день', fmt: v => `~${Math.round(v/1e6)} млн сум` },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-4xl rounded-3xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-black text-xl" style={{ color: 'var(--text-primary)' }}>📊 Сравнение залов</h3>
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xl transition hover:opacity-70"
              style={{ background: 'var(--btn-ghost)', color: 'var(--text-muted)' }}>×</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="p-4 text-left text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Характеристика
                  </th>
                  {halls.map(h => (
                    <th key={h.id} className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <img src={h.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200'}
                          className="w-16 h-16 rounded-xl object-cover"
                          onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200'; }}
                          alt={h.name} />
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{h.district}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map(({ key, label, fmt }, i) => (
                  <tr key={key}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'var(--input-bg)',
                      borderBottom: '1px solid var(--border)',
                    }}>
                    <td className="p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</td>
                    {halls.map(h => {
                      const val = fmt(h[key]);
                      // Найти лучшее значение для числовых полей
                      const isPrice = key === 'price_per_day_uzs';
                      const allVals = halls.map(x => x[key]);
                      const isBest = !isPrice
                        ? (typeof h[key] === 'number' && h[key] === Math.max(...allVals.filter(Boolean)))
                        : (typeof h[key] === 'number' && h[key] === Math.min(...allVals.filter(Boolean)));
                      return (
                        <td key={h.id} className="p-4 text-center">
                          <span className={`text-sm font-semibold ${isBest ? 'text-[#C9A84C]' : ''}`}
                            style={{ color: isBest ? '#C9A84C' : 'var(--text-primary)' }}>
                            {val}
                            {isBest && <span className="ml-1 text-xs">🏆</span>}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            🏆 = лучшее значение в сравнении
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}