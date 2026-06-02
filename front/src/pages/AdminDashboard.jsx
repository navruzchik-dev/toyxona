import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:5000';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const [restaurants, setRestaurants] = useState([]);
  const [artists, setArtists] = useState([]);
  const [pendingRest, setPendingRest] = useState([]);
  const [pendingArtists, setPendingArtists] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [editType, setEditType] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/'); return; }
    load();
  }, [user]);

  const load = () => {
    fetch(`${API}/restaurants`).then(r => r.json()).then(d => {
      const approved = d.filter(x => !x.pending);
      const pending  = d.filter(x => x.pending);
      setRestaurants(approved);
      setPendingRest(pending);
    });
    fetch(`${API}/artists`).then(r => r.json()).then(d => {
      const approved = d.filter(x => !x.pending);
      const pending  = d.filter(x => x.pending);
      setArtists(approved);
      setPendingArtists(pending);
    });
  };

  const approve = async (type, item) => {
    const ep = type === 'restaurant' ? 'restaurants' : 'artists';
    await fetch(`${API}/${ep}/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pending: false }),
    });
    load();
  };

  const reject = async (type, item) => {
    const ep = type === 'restaurant' ? 'restaurants' : 'artists';
    await fetch(`${API}/${ep}/${item.id}`, { method: 'DELETE' });
    load();
  };

  const deleteItem = async (type, id) => {
    if (!confirm('Удалить?')) return;
    const ep = type === 'restaurant' ? 'restaurants' : 'artists';
    await fetch(`${API}/${ep}/${id}`, { method: 'DELETE' });
    load();
  };

  const saveEdit = async () => {
    const ep = editType === 'restaurant' ? 'restaurants' : 'artists';
    await fetch(`${API}/${ep}/${editItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editItem),
    });
    setEditItem(null);
    load();
  };

  const allPending = [
    ...pendingRest.map(x => ({ ...x, _type: 'restaurant' })),
    ...pendingArtists.map(x => ({ ...x, _type: 'artist' })),
  ];

  const tabs = [
    { key: 'pending',     label: `⏳ На одобрение (${allPending.length})` },
    { key: 'restaurants', label: `🏛️ Рестораны (${restaurants.length})` },
    { key: 'artists',     label: `🎤 Артисты (${artists.length})` },
  ];

  return (
    <div className="min-h-screen bg-[#080810] pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white">⚙️ Админ панель</h1>
          <p className="text-white/35 text-sm mt-1">Управление платформой BAYRAMLY.ai</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-gradient-to-r from-[#C9A84C] to-[#7A5C1E] text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Pending */}
        {tab === 'pending' && (
          <div className="space-y-4">
            {allPending.length === 0 && (
              <div className="text-center py-16 text-white/25">
                <div className="text-5xl mb-4">✅</div>
                <p>Нет заявок на одобрение</p>
              </div>
            )}
            {allPending.map(item => (
              <div key={item.id} className="bg-white/4 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=100'}
                      alt="" className="w-full h-full object-cover"
                      onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=100'; }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold truncate">{item.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item._type === 'restaurant'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      }`}>
                        {item._type === 'restaurant' ? 'Ресторан' : 'Артист'}
                      </span>
                    </div>
                    <div className="text-white/35 text-xs mt-0.5">
                      {item._type === 'restaurant' ? `${item.district} · ${item.address}` : `${item.genre} · ${item.admin_phone}`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => approve(item._type, item)}
                    className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition">
                    ✓ Одобрить
                  </button>
                  <button onClick={() => reject(item._type, item)}
                    className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/25 transition">
                    ✕ Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Restaurants */}
        {tab === 'restaurants' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map(item => (
              <AdminCard key={item.id} item={item} type="restaurant"
                onEdit={() => { setEditItem({ ...item }); setEditType('restaurant'); }}
                onDelete={() => deleteItem('restaurant', item.id)} />
            ))}
          </div>
        )}

        {/* Artists */}
        {tab === 'artists' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {artists.map(item => (
              <AdminCard key={item.id} item={item} type="artist"
                onEdit={() => { setEditItem({ ...item }); setEditType('artist'); }}
                onDelete={() => deleteItem('artist', item.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setEditItem(null)}>
          <div className="bg-[#0f0f1e] border border-white/10 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/8">
              <h3 className="text-white font-bold">✏️ Редактировать</h3>
              <button onClick={() => setEditItem(null)}
                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/55 text-lg transition">×</button>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(editItem)
                .filter(([k]) => !['id', 'pending', 'password'].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <label className="text-white/40 text-xs uppercase tracking-wider mb-1 block">{k}</label>
                    <input
                      value={typeof v === 'boolean' ? String(v) : (v || '')}
                      onChange={e => setEditItem(p => ({ ...p, [k]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#C9A84C]/50 transition"
                    />
                  </div>
                ))}
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setEditItem(null)}
                className="flex-1 py-3 rounded-xl bg-white/6 border border-white/10 text-white/55 text-sm font-medium hover:text-white transition">
                Отмена
              </button>
              <button onClick={saveEdit}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition hover:opacity-88"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)' }}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const AdminCard = ({ item, type, onEdit, onDelete }) => (
  <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden group hover:border-white/15 transition-all">
    <div className="relative h-36 overflow-hidden">
      <img src={item.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400'}
        alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400'; }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
    <div className="p-4">
      <div className="text-white font-bold text-sm truncate">{item.name}</div>
      <div className="text-white/35 text-xs mt-0.5 truncate">
        {type === 'restaurant' ? `${item.district} · ${item.kitchen_type}` : `${item.genre} · ${item.category}`}
      </div>
      <div className="text-[#C9A84C] font-bold text-sm mt-2">
        {type === 'restaurant'
          ? `~${Math.round((item.price_per_day_uzs||0)/1e6)} млн сум`
          : `$${item.price_per_hour_usd}/ч`}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={onEdit}
          className="flex-1 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition">
          ✏️ Изменить
        </button>
        <button onClick={onDelete}
          className="flex-1 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition">
          🗑️ Удалить
        </button>
      </div>
    </div>
  </div>
);