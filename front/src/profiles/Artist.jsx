import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setArtist } from '../redux/slices/artistSlice.js';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:5000';

export default function Artist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, logout } = useAuth();

  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Modals
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);
  const [blockDateModal, setBlockDateModal] = useState(false);
  const [blockDate, setBlockDate] = useState('');

  // Booking form (for clients)
  const [bookingDate, setBookingDate] = useState('');
  const [bookingHours, setBookingHours] = useState(3);
  const [bookingGuests, setBookingGuests] = useState(100);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMsg, setBookingMsg] = useState({ text: '', type: '' });

  const isOwner = user?.role === 'artist' && String(user?.id) === String(id);

  const fetchData = async () => {
    try {
      const [artistRes, ordersRes] = await Promise.all([
        fetch(`${API}/artists/${id}`),
        fetch(`${API}/wedding_orders`)
      ]);
      const artistData = await artistRes.json();
      const allOrders = await ordersRes.json();
      setData(artistData);
      dispatch(setArtist(artistData));
      const mine = allOrders.filter(o =>
        o.artists?.some(a => String(a.id) === String(id)) ||
        String(o.artist?.id) === String(id)
      );
      setOrders(mine);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 7000);
    return () => clearInterval(interval);
  }, [id]);

  // ── OWNER ACTIONS ──
  const handleAccept = async (orderId) => {
    setActionLoading(orderId + '_accept');
    try {
      await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      await fetchData();
    } catch {}
    setActionLoading(null);
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return;
    setRejectLoading(true);
    try {
      await fetch(`${API}/wedding_orders/${rejectModal.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason })
      });
      await fetchData();
      setRejectModal(null);
      setRejectReason('');
    } catch {}
    setRejectLoading(false);
  };

  const handleComplete = async (orderId) => {
    setActionLoading(orderId + '_complete');
    try {
      await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      await fetchData();
    } catch {}
    setActionLoading(null);
  };

  const handleSaveProfile = async () => {
    setEditSaving(true);
    try {
      const res = await fetch(`${API}/artists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
        dispatch(setArtist(updated));
        setEditSaved(true);
        setTimeout(() => { setEditSaved(false); setEditModal(false); }, 1500);
      }
    } catch {}
    setEditSaving(false);
  };

  const handleBlockDate = async () => {
    if (!blockDate || !data) return;
    const newDates = [...(data.booked_dates || []), blockDate];
    try {
      const res = await fetch(`${API}/artists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booked_dates: newDates })
      });
      if (res.ok) {
        await fetchData();
        setBlockDate('');
        setBlockDateModal(false);
      }
    } catch {}
  };

  const exportCSV = () => {
    const header = 'ID,Дата,Клиент,Телефон,Гости,Сумма,Статус';
    const rows = orders.map(o =>
      `${o.id},${o.date},${o.client?.name || o.clientName || ''},${o.client?.phone || ''},${o.guests || 0},${o.total_price_usd},${o.status}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders_artist_${id}.csv`; a.click();
  };

  // ── CLIENT BOOKING ──
  const handleBook = async (e) => {
    e.preventDefault();
    if (!user) { setBookingMsg({ text: '⚠️ Войдите в систему', type: 'error' }); return; }
    if (!bookingDate) { setBookingMsg({ text: '⚠️ Выберите дату', type: 'error' }); return; }
    if (data.booked_dates?.includes(bookingDate)) {
      setBookingMsg({ text: '⚠️ Артист занят на эту дату', type: 'error' }); return;
    }
    setBookingLoading(true);
    setBookingMsg({ text: '', type: '' });
    const newOrder = {
      id: `ORDER-${Date.now()}`,
      date: bookingDate,
      guests: Number(bookingGuests),
      total_price_usd: data.price_per_hour_usd * bookingHours,
      status: 'pending',
      clientId: user.id,
      clientName: user.name || 'Клиент',
      client: { id: user.id, name: user.name || 'Клиент', phone: user.phone || '' },
      artist: { id: data.id, name: data.name, category: data.category, price_per_hour_usd: data.price_per_hour_usd },
      artists: [{ id: data.id, name: data.name, category: data.category, price_per_hour_usd: data.price_per_hour_usd }],
      restaurant: null, car: null, cars: [], decors: [],
    };
    try {
      const res = await fetch(`${API}/wedding_orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
      if (res.ok) {
        setBookingMsg({ text: '🎉 Заявка отправлена! Ожидайте подтверждения.', type: 'success' });
        setBookingDate(''); setBookingHours(3); setBookingGuests(100);
        await fetchData();
      } else {
        setBookingMsg({ text: '❌ Ошибка. Попробуйте снова.', type: 'error' });
      }
    } catch {
      setBookingMsg({ text: '❌ Ошибка сети.', type: 'error' });
    }
    setBookingLoading(false);
  };

  // ── FILTERED ORDERS ──
  const filteredOrders = orders.filter(o => {
    const tabMatch =
      activeTab === 'pending' ? o.status === 'pending' :
      activeTab === 'approved' ? ['approved', 'completed'].includes(o.status) :
      ['rejected', 'cancelled'].includes(o.status);
    const q = search.toLowerCase();
    const nameMatch = !q ||
      (o.client?.name || o.clientName || '').toLowerCase().includes(q) ||
      (o.date || '').includes(q);
    return tabMatch && nameMatch;
  });

  const pending = orders.filter(o => o.status === 'pending');
  const approved = orders.filter(o => ['approved', 'completed'].includes(o.status));
  const rejected = orders.filter(o => ['rejected', 'cancelled'].includes(o.status));
  const revenue = approved.reduce((sum, o) => sum + (o.total_price_usd || 0), 0);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '2px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 12 }}>😕</div><p>Профиль не найден</p></div>
    </div>
  );

  const stars = Math.round(data.rating || 0);

  return (
    <div style={{ minHeight: '100vh', background: '#08080f', fontFamily: "'Segoe UI', system-ui, sans-serif", color: 'white' }}>

      {/* ── REJECT MODAL ── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
            <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
              style={{ width: '100%', maxWidth: 420, background: 'linear-gradient(135deg,#1a0808,#0f0f1e)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 24, padding: 32 }}>
              <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>✕</div>
              <h3 style={{ color: '#fca5a5', fontWeight: 800, fontSize: 18, textAlign: 'center', margin: '0 0 6px' }}>Отклонить заявку</h3>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>Клиент получит уведомление с вашей причиной</p>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Причина *</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Например: занят на эту дату..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Отмена
                </button>
                <button onClick={handleRejectSubmit} disabled={!rejectReason.trim() || rejectLoading}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(239,68,68,0.4)', background: rejectReason.trim() ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.05)', color: '#f87171', fontWeight: 700, cursor: rejectReason.trim() ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                  {rejectLoading ? '...' : 'Отклонить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ORDER DETAIL MODAL ── */}
      <AnimatePresence>
        {orderDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOrderDetail(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(14px)' }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 480, background: '#111120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Детали заявки</h3>
                <button onClick={() => setOrderDetail(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <DetailRow label="ID" val={orderDetail.id} mono />
                <DetailRow label="Статус" val={<StatusBadge status={orderDetail.status} />} />
                <DetailRow label="Дата события" val={orderDetail.date} />
                <DetailRow label="Гостей" val={orderDetail.guests} />
                <DetailRow label="Сумма" val={<span style={{ color: '#C9A84C', fontWeight: 700 }}>${orderDetail.total_price_usd}</span>} />
                <DetailRow label="Клиент" val={orderDetail.client?.name || orderDetail.clientName || '—'} />
                {(orderDetail.client?.phone) && (
                  <DetailRow label="Телефон" val={
                    <a href={`tel:${orderDetail.client.phone}`} style={{ color: '#C9A84C', fontWeight: 700, textDecoration: 'none' }}>{orderDetail.client.phone}</a>
                  } />
                )}
                {orderDetail.rejection_reason && (
                  <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12 }}>
                    <span style={{ color: 'rgba(248,113,113,0.7)' }}>Причина отказа: </span>
                    <span style={{ color: '#fca5a5' }}>{orderDetail.rejection_reason}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                {orderDetail.client?.phone && (
                  <a href={`tel:${orderDetail.client.phone}`}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
                    📞 Позвонить
                  </a>
                )}
                {orderDetail.status === 'approved' && (
                  <button onClick={() => { handleComplete(orderDetail.id); setOrderDetail(null); }}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    ✓ Выполнено
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT PROFILE MODAL ── */}
      <AnimatePresence>
        {editModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)' }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={{ width: '100%', maxWidth: 480, background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Редактировать профиль</h3>
                <button onClick={() => setEditModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
              <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { key: 'name', label: 'Имя / Псевдоним', type: 'text' },
                  { key: 'genre', label: 'Жанр', type: 'text' },
                  { key: 'category', label: 'Категория', type: 'text' },
                  { key: 'price_per_hour_usd', label: 'Цена за час ($)', type: 'number' },
                  { key: 'image_url', label: 'Ссылка на фото', type: 'text' },
                  { key: 'phone', label: 'Контактный телефон', type: 'text' },
                  { key: 'telegram', label: 'Telegram (@username)', type: 'text' },
                  { key: 'payment_card', label: 'Карта для оплаты (16 цифр)', type: 'text' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
                    <input type={type} value={editForm[key] || ''} onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? +e.target.value : e.target.value }))}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  </div>
                ))}
                {editForm.image_url && (
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <img src={editForm.image_url} alt="preview" style={{ width: '100%', height: 120, objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10 }}>
                <button onClick={() => setEditModal(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Отмена
                </button>
                <button onClick={handleSaveProfile} disabled={editSaving}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: editSaved ? 'rgba(52,211,153,0.25)' : 'linear-gradient(135deg,#C9A84C,#7A5C1E)', color: editSaved ? '#34d399' : 'white', fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                  {editSaving ? '...' : editSaved ? '✓ Сохранено!' : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BLOCK DATE MODAL ── */}
      <AnimatePresence>
        {blockDateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)' }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              style={{ width: '100%', maxWidth: 380, background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28 }}>
              <h3 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16 }}>🔒 Заблокировать дату</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20 }}>Клиенты не смогут забронировать вас на эту дату</p>
              <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setBlockDateModal(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Отмена
                </button>
                <button onClick={handleBlockDate} disabled={!blockDate}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#C9A84C', color: 'black', fontWeight: 700, cursor: blockDate ? 'pointer' : 'not-allowed', fontSize: 13, opacity: blockDate ? 1 : 0.5 }}>
                  Заблокировать
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <div style={{ position: 'relative', height: 280, overflow: 'hidden' }}>
        <img
          src={data.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900'}
          alt={data.name}
          onError={e => { e.target.src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900'; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.3)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #08080f 0%, rgba(8,8,15,0.3) 60%, transparent 100%)' }} />

        {/* Artist info overlay */}
        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={data.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200'}
              alt={data.name}
              onError={e => { e.target.src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200'; }}
              style={{ width: 88, height: 88, borderRadius: 22, objectFit: 'cover', border: '2.5px solid rgba(201,168,76,0.7)' }}
            />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#22c55e', border: '2.5px solid #08080f' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.5px' }}>{data.name}</h1>
            <p style={{ margin: '5px 0 8px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{data.genre} · {data.category}</p>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ fontSize: 14, color: i < stars ? '#C9A84C' : 'rgba(255,255,255,0.15)' }}>★</span>
              ))}
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginLeft: 5 }}>{data.rating}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: '#C9A84C', fontSize: 24, fontWeight: 900 }}>${data.price_per_hour_usd}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>за час</div>
          </div>
        </div>

        {/* Owner top-right buttons */}
        {isOwner && (
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 8 }}>
            <button onClick={() => { setEditForm(data); setEditModal(true); }}
              style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              ✏️ Изменить
            </button>
            <button onClick={() => { logout(); navigate('/'); }}
              style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              Выйти
            </button>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* Info Chips — улучшенный дизайн */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '24px 0' }}>
          {[
            { emoji: '💰', label: 'Цена/час', val: `$${data.price_per_hour_usd}`, grad: 'rgba(201,168,76,0.12), rgba(201,168,76,0.02)' },
            { emoji: '⭐', label: 'Рейтинг', val: data.rating || '—', grad: 'rgba(251,191,36,0.1), rgba(251,191,36,0.02)' },
            { emoji: '🎵', label: 'Жанр', val: data.genre, grad: 'rgba(99,102,241,0.1), rgba(99,102,241,0.02)' },
            { emoji: '📱', label: 'Категория', val: data.category, grad: 'rgba(236,72,153,0.1), rgba(236,72,153,0.02)' },
          ].map(({ emoji, label, val, grad }) => (
            <div key={label} style={{ background: `linear-gradient(135deg, ${grad})`, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '16px 10px', textAlign: 'center', transition: 'transform 0.2s' }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{emoji}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
            </div>
          ))}
        </div>


        {/* Contact & Payment — улучшенный дизайн */}
        {(data.phone || data.admin_phone || data.telegram || data.payment_card) && (
          <div style={{ display: 'grid', gridTemplateColumns: data.telegram || data.payment_card ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr', gap: 12, marginBottom: 24 }}>
            {/* Телефон */}
            {(data.phone || data.admin_phone) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.03))', border: '1px solid rgba(201,168,76,0.22)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📞</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Телефон</div>
                  <a href={`tel:${data.phone || data.admin_phone}`} style={{ color: '#C9A84C', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    {data.phone || data.admin_phone}
                  </a>
                </div>
              </div>
            )}

            {/* Telegram */}
            {data.telegram && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(56,134,222,0.1), rgba(56,134,222,0.03))', border: '1px solid rgba(56,134,222,0.22)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(56,134,222,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✈️</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Telegram</div>
                  <a href={`https://t.me/${data.telegram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color: '#5b9eed', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    {data.telegram}
                  </a>
                </div>
              </div>
            )}

            {/* Карта оплаты */}
            {data.payment_card && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.03))', border: '1px solid rgba(139,92,246,0.22)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💳</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Карта для оплаты</div>
                  <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                    {data.payment_card.replace(/(\d{4})/g, '$1 ').trim()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blocked dates */}
        {isOwner && data.booked_dates?.length > 0 && (
          <div style={{ padding: '14px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 24 }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Заблокированные даты</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.booked_dates.map((d, i) => (
                <span key={i} style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12, fontWeight: 600 }}>📅 {d}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── CLIENT: BOOKING FORM ── */}
        {!isOwner && (
          <div style={{ background: 'linear-gradient(135deg,rgba(201,168,76,0.07),rgba(139,92,246,0.04))', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 22, padding: 24, marginBottom: 28 }}>
            <h3 style={{ color: 'white', fontWeight: 800, fontSize: 16, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📅 Забронировать выступление
            </h3>
            <form onSubmit={handleBook}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>Дата мероприятия</label>
                  <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>Часов выступления</label>
                  <input type="number" min="1" max="12" value={bookingHours} onChange={e => setBookingHours(+e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>Количество гостей</label>
                <input type="number" min="10" value={bookingGuests} onChange={e => setBookingGuests(+e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 16 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Итоговая стоимость</span>
                <span style={{ color: '#C9A84C', fontWeight: 900, fontSize: 24 }}>${(data.price_per_hour_usd * bookingHours).toLocaleString()}</span>
              </div>
              {bookingMsg.text && (
                <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, textAlign: 'center', marginBottom: 14, background: bookingMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${bookingMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: bookingMsg.type === 'success' ? '#86efac' : '#fca5a5' }}>
                  {bookingMsg.text}
                </div>
              )}
              <button type="submit" disabled={bookingLoading}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: bookingLoading ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#C9A84C,#7A5C1E)', color: bookingLoading ? 'rgba(255,255,255,0.3)' : 'white', fontWeight: 700, fontSize: 14, cursor: bookingLoading ? 'not-allowed' : 'pointer', boxShadow: bookingLoading ? 'none' : '0 4px 20px rgba(201,168,76,0.25)' }}>
                {bookingLoading ? 'Отправляем...' : '🎤 Отправить заявку'}
              </button>
            </form>
          </div>
        )}

        {/* ── OWNER ADMIN PANEL ── */}
        {isOwner && (
          <div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Все заказы', val: orders.length, color: 'rgba(255,255,255,0.9)' },
                { label: '⏳ Ожидают', val: pending.length, color: '#fbbf24' },
                { label: '✅ Принято', val: approved.length, color: '#34d399' },
                { label: '💰 Доход', val: `$${revenue.toLocaleString()}`, color: '#C9A84C' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '18px 14px', textAlign: 'center' }}>
                  <div style={{ color, fontSize: 26, fontWeight: 900, marginBottom: 4 }}>{val}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, flex: 1, minWidth: 260 }}>
                {[
                  { key: 'pending', label: `Новые (${pending.length})`, color: '#fbbf24' },
                  { key: 'approved', label: `Принятые (${approved.length})`, color: '#34d399' },
                  { key: 'history', label: `История (${rejected.length})`, color: '#94a3b8' },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s', background: activeTab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === t.key ? t.color : 'rgba(255,255,255,0.3)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Search */}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск клиента/даты..."
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 14px', color: 'white', fontSize: 12, outline: 'none', minWidth: 200 }} />
              {/* Action buttons */}
              <button onClick={exportCSV} style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                📥 Экспорт CSV
              </button>
              <button onClick={() => setBlockDateModal(true)} style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                🔒 Блок дата
              </button>
            </div>

            {/* Orders list */}
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                {search ? 'Ничего не найдено' : activeTab === 'pending' ? 'Нет новых заявок' : activeTab === 'approved' ? 'Нет принятых заказов' : 'История пуста'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AnimatePresence>
                  {filteredOrders.map(o => (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      onClick={() => setOrderDetail(o)}
                      style={{
                        background: activeTab === 'pending' ? 'rgba(245,158,11,0.04)' : activeTab === 'approved' ? 'rgba(52,211,153,0.04)' : 'rgba(148,163,184,0.03)',
                        border: `1px solid ${activeTab === 'pending' ? 'rgba(245,158,11,0.18)' : activeTab === 'approved' ? 'rgba(52,211,153,0.14)' : 'rgba(148,163,184,0.1)'}`,
                        borderRadius: 18, padding: 18, cursor: 'pointer', transition: 'background 0.2s'
                      }}
                      whileHover={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }}>{o.id}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 6 }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>📅 {o.date}</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>👥 {o.guests || 0} гостей</span>
                            <span style={{ color: '#C9A84C', fontWeight: 700, fontSize: 13 }}>💰 ${o.total_price_usd}</span>
                          </div>
                          {(o.client?.name || o.clientName) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>👤</span>
                              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600 }}>{o.client?.name || o.clientName}</span>
                              {o.client?.phone && (
                                <a href={`tel:${o.client.phone}`} onClick={e => e.stopPropagation()}
                                  style={{ color: '#C9A84C', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>{o.client.phone}</a>
                              )}
                            </div>
                          )}
                          {o.rejection_reason && (
                            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 11, color: '#fca5a5' }}>
                              Причина отказа: {o.rejection_reason}
                            </div>
                          )}
                        </div>
                        {activeTab === 'pending' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleAccept(o.id)} disabled={actionLoading === o.id + '_accept'}
                              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.12)', color: '#34d399', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              {actionLoading === o.id + '_accept' ? '...' : '✓ Принять'}
                            </button>
                            <button onClick={() => setRejectModal({ orderId: o.id })}
                              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              ✗ Отказать
                            </button>
                          </div>
                        )}
                        {activeTab === 'approved' && o.status === 'approved' && (
                          <button onClick={e => { e.stopPropagation(); handleComplete(o.id); }} disabled={actionLoading === o.id + '_complete'}
                            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(129,140,248,0.3)', background: 'rgba(129,140,248,0.1)', color: '#818cf8', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                            Выполнено
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'Ожидает',     color: '#fbbf24', bg: 'rgba(245,158,11,0.12)'  },
    approved:  { label: 'Принят',      color: '#34d399', bg: 'rgba(52,211,153,0.1)'   },
    rejected:  { label: 'Отклонён',    color: '#f87171', bg: 'rgba(239,68,68,0.1)'    },
    cancelled: { label: 'Отменён',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
    confirmed: { label: 'Подтверждён', color: '#818cf8', bg: 'rgba(129,140,248,0.1)'  },
    completed: { label: 'Выполнен',    color: '#6ee7b7', bg: 'rgba(110,231,183,0.1)'  },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function DetailRow({ label, val, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{val}</span>
    </div>
  );
}