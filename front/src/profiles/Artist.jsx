import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setArtist } from '../redux/slices/artistSlice.js';
import { useAuth } from '../context/AuthContext';

export default function Artist() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const artist = useSelector(s => s.artist.data);
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwner = user?.role === 'artist' && user?.id === id;

  useEffect(() => {
    fetch(`http://localhost:5000/artists/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); dispatch(setArtist(d)); setLoading(false); })
      .catch(() => setLoading(false));

    if (isOwner) {
      fetch('http://localhost:5000/wedding_orders')
        .then(r => r.json())
        .then(list => setOrders(list.filter(o => o.artist?.id === id)));
    }
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (!data) return <NotFound />;

  const stars = Math.round(data.rating || 0);
  const revenue = orders.filter(o => o.status === 'approved').reduce((s, o) => s + (o.artist?.price_per_hour_usd || 0) * 4, 0);

  return (
    <div className="min-h-screen bg-[#080810] pt-20">
      {/* Hero banner */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/20 to-violet-900/20" />
        <div className="absolute inset-0 flex items-end p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6 w-full max-w-5xl mx-auto">
            <div className="relative flex-shrink-0">
              <img src={data.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400'}
                alt={data.name}
                className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-white/20 shadow-2xl"
                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400'; }} />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-[#080810]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white text-2xl sm:text-3xl font-black">{data.name}</h1>
              <p className="text-white/55 text-sm mt-1">{data.genre} · {data.category}</p>
              <div className="flex items-center gap-1 mt-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`text-sm ${i < stars ? 'text-[#C9A84C]' : 'text-white/15'}`}>★</span>
                ))}
                <span className="text-white/45 text-xs ml-1">{data.rating}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { emoji: '💰', label: 'Цена/час', val: `$${data.price_per_hour_usd}` },
            { emoji: '⭐', label: 'Рейтинг', val: data.rating || '—' },
            { emoji: '🎵', label: 'Жанр', val: data.genre },
            { emoji: '📱', label: 'Категория', val: data.category },
          ].map(({ emoji, label, val }) => (
            <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{emoji}</div>
              <div className="text-white/40 text-xs mb-1">{label}</div>
              <div className="text-white font-bold text-sm truncate">{val}</div>
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
                { label: 'Ориент. доход', val: `$${revenue}`, color: 'text-[#C9A84C]' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-5">
                  <div className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</div>
                  <div className={`text-2xl font-black ${color}`}>{val}</div>
                </div>
              ))}
            </div>

            {/* Orders list */}
            <h3 className="text-white font-semibold mb-3 text-sm">Последние заказы</h3>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-white/25 text-sm">Заказов пока нет</p>}
              {orders.map(o => (
                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/4 border border-white/8 rounded-2xl">
                  <div>
                    <div className="text-white font-medium text-sm">{o.id}</div>
                    <div className="text-white/40 text-xs mt-0.5">{o.date} · {o.guests} гостей · {o.restaurant?.name}</div>
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

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#080810] flex items-center justify-center">
    <div className="w-10 h-10 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
  </div>
);

const NotFound = () => (
  <div className="min-h-screen bg-[#080810] flex items-center justify-center text-white/35 text-center p-8">
    <div>
      <div className="text-5xl mb-4">😕</div>
      <p>Профиль не найден</p>
    </div>
  </div>
);