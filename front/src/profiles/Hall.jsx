import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';

/* Редактируемые поля */
const EDITABLE_FIELDS = [
  { key: 'name',                label: 'Название',          type: 'text'   },
  { key: 'district',            label: 'Район',             type: 'text'   },
  { key: 'address',             label: 'Адрес',             type: 'text'   },
  { key: 'phone',               label: 'Телефон',           type: 'text'   },
  { key: 'telegram',            label: 'Telegram (@username)', type: 'text' },
  { key: 'payment_card',        label: 'Карта для оплаты (16 цифр)', type: 'text' },
  { key: 'max_capacity_people', label: 'Вместимость (чел)', type: 'number' },
  { key: 'seating_capacity',    label: 'Мест за столами',   type: 'number' },
  { key: 'waiters_count',       label: 'Официанты',         type: 'number' },
  { key: 'parking_spaces',      label: 'Парковка (мест)',   type: 'number' },
  { key: 'stage_size',          label: 'Размер сцены',      type: 'text'   },
  { key: 'kitchen_type',        label: 'Тип кухни',         type: 'text'   },
  { key: 'price_per_day_uzs',   label: 'Цена/день (сум)',   type: 'number' },
  { key: 'image_url',           label: 'Ссылка на фото',    type: 'text'   },
  { key: 'has_led_screen',      label: 'LED экран',         type: 'boolean'},
];

export default function Hall() {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const { user, logout } = useAuth();

  const [data,          setData]          = useState(null);
  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  /* Edit state */
  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState({});
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);

  const isOwner = user?.role === 'hall' && user?.id === id;

  const fetchData = () => {
    fetch(`${API}/restaurants/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setEditForm(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(`${API}/wedding_orders`)
      .then(r => r.json())
      .then(list => setOrders(list.filter(o => String(o.restaurant?.id) === String(id))))
      .catch(() => {});
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAccept = async (orderId) => {
    setActionLoading(orderId + '_accept');
    try {
      const res = await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) fetchData();
    } catch {}
    setActionLoading(null);
  };

  const handleReject = async (orderId) => {
    setActionLoading(orderId + '_reject');
    try {
      const res = await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (res.ok) fetchData();
    } catch {}
    setActionLoading(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/restaurants/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
        setSaveOk(true);
        setTimeout(() => { setSaveOk(false); setEditOpen(false); }, 1500);
      }
    } catch {}
    setSaving(false);
  };

  /* ── Loading / not found ── */
  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center text-white/35 text-center">
      <div><div className="text-5xl mb-4">😕</div><p>Зал не найден</p></div>
    </div>
  );

  const revenue  = orders.filter(o => o.status === 'approved').reduce((s, o) => s + (o.total_price_usd || 0), 0);
  const pending  = orders.filter(o => o.status === 'pending');
  const approved = orders.filter(o => o.status === 'approved');
  const rejected = orders.filter(o => o.status === 'rejected');

  return (
    <div className="min-h-screen bg-[#080810]">

      {/* ── NAVBAR: только лого + выйти для владельца ── */}
      {isOwner ? (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-16"
          style={{ background: 'rgba(8,8,16,0.96)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)' }}>B</div>
            <span className="font-black text-white tracking-wider text-sm">
              BAYRAMLY<span style={{ color: '#C9A84C' }}>.ai</span>
            </span>
          </div>
          {/* Right: edit button + logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(201,168,76,0.1)'}>
              ✏️ Редактировать
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>
              Выйти →
            </button>
          </div>
        </nav>
      ) : (
        <div className="h-16" />
      )}

      <div className="pt-16">
        {/* Hero */}
        <div className="relative h-48 sm:h-64 overflow-hidden">
          <img
            src={data.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'}
            alt={data.name}
            className="w-full h-full object-cover"
            onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080810] via-[#080810]/40 to-transparent" />
          <div className="absolute bottom-5 left-4 sm:left-8">
            <h1 className="text-white text-2xl sm:text-4xl font-black">{data.name}</h1>
            <p className="text-white/50 text-sm mt-1">📍 {data.district} · {data.address}</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

          {/* Info cards — улучшенный дизайн */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { emoji: '👥', label: 'Вместимость',    val: `${data.max_capacity_people} чел.`, grad: 'rgba(99,102,241,0.1), rgba(99,102,241,0.02)' },
              { emoji: '🪑', label: 'Мест за столами', val: `${data.seating_capacity} чел.`,    grad: 'rgba(236,72,153,0.1), rgba(236,72,153,0.02)' },
              { emoji: '🍽️', label: 'Официанты',      val: `${data.waiters_count} чел.`,       grad: 'rgba(34,197,94,0.1), rgba(34,197,94,0.02)'   },
              { emoji: '🎭', label: 'Сцена',           val: data.stage_size,                    grad: 'rgba(168,85,247,0.1), rgba(168,85,247,0.02)' },
              { emoji: '🚗', label: 'Парковка',        val: `${data.parking_spaces} мест`,      grad: 'rgba(59,130,246,0.1), rgba(59,130,246,0.02)' },
              { emoji: '🍜', label: 'Кухня',           val: data.kitchen_type,                  grad: 'rgba(251,146,60,0.1), rgba(251,146,60,0.02)' },
              { emoji: '💡', label: 'LED экран',       val: data.has_led_screen ? 'Есть' : 'Нет', grad: 'rgba(250,204,21,0.1), rgba(250,204,21,0.02)' },
              { emoji: '💰', label: 'Цена/день',       val: `~${Math.round((data.price_per_day_uzs||0)/1e6)} млн`, grad: 'rgba(201,168,76,0.12), rgba(201,168,76,0.02)' },
            ].map(({ emoji, label, val, grad }) => (
              <div key={label} className="rounded-2xl p-4 text-center border border-white/8"
                style={{ background: `linear-gradient(135deg, ${grad})` }}>
                <div className="text-xl mb-1">{emoji}</div>
                <div className="text-white/35 text-xs mb-1">{label}</div>
                <div className="text-white font-semibold text-sm">{val}</div>
              </div>
            ))}
          </div>

          {/* Контакты — телефон, Telegram, карта оплаты */}
          <div className="grid sm:grid-cols-3 gap-3">
            {data.phone && (
              <div className="flex items-center gap-3 p-4 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.02))', border: '1px solid rgba(201,168,76,0.2)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(201,168,76,0.15)'}}>📞</div>
                <div className="min-w-0">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Телефон</div>
                  <a href={`tel:${data.phone}`} className="text-[#C9A84C] font-bold text-sm hover:underline">{data.phone}</a>
                </div>
              </div>
            )}
            {data.telegram && (
              <div className="flex items-center gap-3 p-4 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(56,134,222,0.1), rgba(56,134,222,0.02))', border: '1px solid rgba(56,134,222,0.2)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(56,134,222,0.15)'}}>✈️</div>
                <div className="min-w-0">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Telegram</div>
                  <a href={`https://t.me/${data.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="font-bold text-sm hover:underline" style={{color:'#5b9eed'}}>{data.telegram}</a>
                </div>
              </div>
            )}
            {data.payment_card && (
              <div className="flex items-center gap-3 p-4 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.02))', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(139,92,246,0.15)'}}>💳</div>
                <div className="min-w-0">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Карта оплаты</div>
                  <span className="font-bold text-xs font-mono" style={{color:'#a78bfa', letterSpacing:'0.5px'}}>{data.payment_card.replace(/(\d{4})/g,'$1 ').trim()}</span>
                </div>
              </div>
            )}
          </div>


          {/* ═══ OWNER PANEL ═══ */}
          {isOwner && (
            <div className="border-t border-white/5 pt-6 space-y-6">

              {/* Stats */}
              <div>
                <h2 className="text-white font-bold text-lg mb-4">Моя статистика</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Все заявки', val: orders.length,    color: 'text-white'       },
                    { label: 'Ожидают',   val: pending.length,   color: 'text-amber-400'   },
                    { label: 'Принято',   val: approved.length,  color: 'text-emerald-400' },
                    { label: 'Доход USD', val: `$${revenue}`,    color: 'text-[#C9A84C]'   },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-5">
                      <div className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</div>
                      <div className={`text-2xl font-black ${color}`}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {pending.length > 0 && (
                <div>
                  <h3 className="text-amber-400 font-semibold mb-3 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Новые заявки ({pending.length})
                  </h3>
                  <div className="space-y-3">
                    {pending.map(o => (
                      <HallOrderCard key={o.id} order={o}
                        onAccept={() => handleAccept(o.id)} onReject={() => handleReject(o.id)}
                        acceptLoading={actionLoading === o.id + '_accept'}
                        rejectLoading={actionLoading === o.id + '_reject'}
                        showActions />
                    ))}
                  </div>
                </div>
              )}

              {approved.length > 0 && (
                <div>
                  <h3 className="text-emerald-400 font-semibold mb-3 text-sm">Принятые заказы</h3>
                  <div className="space-y-3">{approved.map(o => <HallOrderCard key={o.id} order={o} status="approved" />)}</div>
                </div>
              )}

              {rejected.length > 0 && (
                <div>
                  <h3 className="text-red-400 font-semibold mb-3 text-sm">Отклонённые</h3>
                  <div className="space-y-3">{rejected.map(o => <HallOrderCard key={o.id} order={o} status="rejected" />)}</div>
                </div>
              )}

              {orders.length === 0 && (
                <p className="text-white/25 text-sm text-center py-8">Заявок пока нет</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
          onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h3 className="text-white font-bold">Редактировать профиль</h3>
              <button onClick={() => setEditOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition"
                style={{ background: 'rgba(255,255,255,0.06)' }}>×</button>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {EDITABLE_FIELDS.map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-white/40 text-xs uppercase tracking-wider mb-1.5">{label}</label>
                  {type === 'boolean' ? (
                    <button
                      onClick={() => setEditForm(p => ({ ...p, [key]: !p[key] }))}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all"
                      style={{
                        background: editForm[key] ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${editForm[key] ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
                      <div className={`w-10 h-5 rounded-full transition-all relative ${editForm[key] ? 'bg-emerald-500' : 'bg-white/20'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${editForm[key] ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: editForm[key] ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                        {editForm[key] ? 'Есть' : 'Нет'}
                      </span>
                    </button>
                  ) : (
                    <input
                      type={type}
                      value={editForm[key] ?? ''}
                      onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? +e.target.value : e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  )}
                </div>
              ))}

              {/* Image preview */}
              {editForm.image_url && (
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <img src={editForm.image_url} alt="preview"
                    className="w-full h-32 object-cover"
                    onError={e => { e.target.style.display = 'none'; }} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setEditOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/50 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: saveOk ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #C9A84C, #7A5C1E)', border: saveOk ? '1px solid rgba(16,185,129,0.5)' : 'none' }}>
                {saving ? 'Сохраняем...' : saveOk ? '✓ Сохранено!' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── HallOrderCard ─── */
function HallOrderCard({ order: o, onAccept, onReject, acceptLoading, rejectLoading, showActions, status }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      showActions
        ? 'bg-amber-500/5 border-amber-500/20'
        : status === 'approved'
          ? 'bg-emerald-500/5 border-emerald-500/15'
          : 'bg-red-500/5 border-red-500/15'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <div className="text-white font-medium text-sm">ID: {o.id}</div>
          <div className="text-white/50 text-xs">📅 {o.date} &nbsp;·&nbsp; 👥 {o.guests || 0} гостей</div>
          {(o.client || o.clientName) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-white/40 text-xs">Клиент:</span>
              <span className="text-white/80 text-xs font-medium">{o.client?.name || o.clientName}</span>
              {(o.client?.phone || o.clientPhone) && (
                <a href={`tel:${o.client?.phone || o.clientPhone}`} className="text-[#C9A84C] text-xs font-bold hover:underline">
                  {o.client?.phone || o.clientPhone}
                </a>
              )}
            </div>
          )}
          {o.artists?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <span className="text-white/40 text-xs">Артисты:</span>
              {o.artists.map(a => (
                <span key={a.id} className="text-white/70 text-xs">
                  {a.name}
                  {a.phone && <a href={`tel:${a.phone}`} className="text-[#C9A84C] ml-1 hover:underline">{a.phone}</a>}
                </span>
              ))}
            </div>
          )}
          <div className="text-[#C9A84C] font-bold text-sm pt-0.5">${o.total_price_usd}</div>
        </div>

        {showActions && (
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <button onClick={onAccept} disabled={acceptLoading || rejectLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}>
              {acceptLoading ? '...' : '✓ Принять'}
            </button>
            <button onClick={onReject} disabled={acceptLoading || rejectLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>
              {rejectLoading ? '...' : '✗ Отказать'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}