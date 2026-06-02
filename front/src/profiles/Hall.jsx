import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth } from '../context/AuthContext';

export default function Hall() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwner = user?.role === 'hall' && user?.id === id;

  useEffect(() => {
    fetch(`http://localhost:5000/restaurants/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    if (isOwner) {
      fetch('http://localhost:5000/wedding_orders')
        .then(r => r.json())
        .then(list => setOrders(list.filter(o => o.restaurant?.id === id)));
    }
  }, [id]);

  if (loading) return <div className="min-h-screen bg-[#080810] flex items-center justify-center"><div className="w-10 h-10 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" /></div>;
  if (!data) return <div className="min-h-screen bg-[#080810] flex items-center justify-center text-white/35 text-center"><div><div className="text-5xl mb-4">😕</div><p>Зал не найден</p></div></div>;

  const revenue = orders.filter(o => o.status === 'approved').reduce((s, o) => s + (o.total_price_usd || 0), 0);

  return (
    <div className="min-h-screen bg-[#080810] pt-20">
      {/* Hero */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <img src={data.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'}
          alt={data.name} className="w-full h-full object-cover"
          onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'; }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080810] via-[#080810]/40 to-transparent" />
        <div className="absolute bottom-5 left-4 sm:left-8">
          <h1 className="text-white text-2xl sm:text-4xl font-black">{data.name}</h1>
          <p className="text-white/50 text-sm mt-1">📍 {data.district} · {data.address}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { emoji: '👥', label: 'Вместимость', val: `${data.max_capacity_people} чел.` },
            { emoji: '🪑', label: 'Мест за столами', val: `${data.seating_capacity} чел.` },
            { emoji: '🍽️', label: 'Официанты', val: `${data.waiters_count} чел.` },
            { emoji: '🎭', label: 'Сцена', val: data.stage_size },
            { emoji: '🚗', label: 'Парковка', val: `${data.parking_spaces} мест` },
            { emoji: '🍜', label: 'Кухня', val: data.kitchen_type },
            { emoji: '💡', label: 'LED экран', val: data.has_led_screen ? 'Есть' : 'Нет' },
            { emoji: '💰', label: 'Цена/день', val: `~${Math.round((data.price_per_day_uzs||0)/1e6)} млн` },
          ].map(({ emoji, label, val }) => (
            <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <div className="text-xl mb-1">{emoji}</div>
              <div className="text-white/35 text-xs mb-1">{label}</div>
              <div className="text-white font-semibold text-sm">{val}</div>
            </div>
          ))}
        </div>

        {/* Owner stats */}
        {isOwner && (
          <div>
            <h2 className="text-white font-bold text-lg mb-4">📊 Моя статистика</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Всего заявок', val: orders.length, color: 'text-white' },
                { label: 'Подтверждено', val: orders.filter(o => o.status === 'approved').length, color: 'text-emerald-400' },
                { label: 'Доход USD', val: `$${revenue}`, color: 'text-[#C9A84C]' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-5">
                  <div className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</div>
                  <div className={`text-2xl font-black ${color}`}>{val}</div>
                </div>
              ))}
            </div>

            <h3 className="text-white font-semibold mb-3 text-sm">Входящие заказы</h3>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-white/25 text-sm">Заказов пока нет</p>}
              {orders.map(o => (
                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/4 border border-white/8 rounded-2xl">
                  <div>
                    <div className="text-white font-medium text-sm">{o.id}</div>
                    <div className="text-white/40 text-xs mt-0.5">{o.date} · {o.guests} гостей</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#C9A84C] font-bold text-sm">${o.total_price_usd}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      o.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                      o.status === 'rejected' ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
                      'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    }`}>
                      {o.status === 'approved' ? 'Принят' : o.status === 'rejected' ? 'Отклонён' : 'Новый'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}