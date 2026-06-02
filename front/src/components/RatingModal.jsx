// src/components/RatingModal.jsx
// НОВЫЙ ФАЙЛ — вставить в src/components/RatingModal.jsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const StarRating = ({ label, emoji, value, onChange }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/8 dark:border-white/8 light:border-black/8">
    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
      {emoji} {label}
    </span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className={`text-2xl transition-all duration-150 hover:scale-125 ${
            star <= value ? 'text-[#C9A84C]' : 'text-white/20 dark:text-white/20 light:text-black/20'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  </div>
);

export default function RatingModal({ order, onClose, onSubmit }) {
  const [ratings, setRatings] = useState({
    restaurant: 0,
    artist: 0,
    car: 0,
    decor: 0,
  });
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const set = (key, val) => setRatings(p => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    const review = {
      orderId: order.id,
      ratings,
      comment,
      date: new Date().toISOString(),
      clientName: order.clientName,
    };
    // Сохраняем в localStorage (можно заменить на API)
    const existing = JSON.parse(localStorage.getItem('bayramly_reviews') || '[]');
    localStorage.setItem('bayramly_reviews', JSON.stringify([...existing, review]));

    // Обновляем рейтинги в db (попробуем через API)
    try {
      if (order.restaurant?.id && ratings.restaurant > 0) {
        const r = await fetch(`http://localhost:5000/restaurants/${order.restaurant.id}`).then(x => x.json());
        const newRating = ((r.rating || 0) + ratings.restaurant) / 2;
        await fetch(`http://localhost:5000/restaurants/${order.restaurant.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: Math.round(newRating * 10) / 10 }),
        });
      }
      if (order.artist?.id && ratings.artist > 0) {
        const a = await fetch(`http://localhost:5000/artists/${order.artist.id}`).then(x => x.json());
        const newRating = ((a.rating || 0) + ratings.artist) / 2;
        await fetch(`http://localhost:5000/artists/${order.artist.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: Math.round(newRating * 10) / 10 }),
        });
      }
    } catch {}

    setSubmitted(true);
    setTimeout(() => { onClose(); if (onSubmit) onSubmit(review); }, 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          className="w-full max-w-md rounded-3xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
          onClick={e => e.stopPropagation()}
        >
          {submitted ? (
            <div className="p-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>
              <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Спасибо за отзыв!</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Ваша оценка поможет другим</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>⭐ Оцените ваш той</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Заказ {order?.id}</p>
                </div>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-lg transition hover:opacity-70"
                  style={{ background: 'var(--btn-ghost)', color: 'var(--text-muted)' }}>×</button>
              </div>

              <div className="p-6 space-y-0">
                {order?.restaurant && <StarRating label={order.restaurant.name} emoji="🏛️" value={ratings.restaurant} onChange={v => set('restaurant', v)} />}
                {order?.artist && <StarRating label={order.artist.name} emoji="🎤" value={ratings.artist} onChange={v => set('artist', v)} />}
                {order?.car && <StarRating label={order.car.model} emoji="🚗" value={ratings.car} onChange={v => set('car', v)} />}
                {order?.decor && <StarRating label={order.decor.service_name} emoji="✨" value={ratings.decor} onChange={v => set('decor', v)} />}

                <div className="pt-4">
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Комментарий (необязательно)</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    placeholder="Расскажите о вашем опыте..."
                    className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-medium transition"
                  style={{ background: 'var(--btn-ghost)', color: 'var(--text-muted)' }}>
                  Позже
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={Object.values(ratings).every(v => v === 0)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)' }}
                >
                  Отправить ⭐
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}