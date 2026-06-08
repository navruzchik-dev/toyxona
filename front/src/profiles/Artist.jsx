import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setArtist } from '../redux/slices/artistSlice.js';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:5000';

export default function Artist() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const { user, logout } = useAuth();

  const [data,           setData]           = useState(null);
  const [orders,         setOrders]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [actionLoading,  setActionLoading]  = useState(null);

  // Booking form
  const [bookingDate,    setBookingDate]    = useState('');
  const [bookingHours,   setBookingHours]   = useState(3);
  const [bookingGuests,  setBookingGuests]  = useState(100);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMsg,     setBookingMsg]     = useState({ text: '', type: '' });

  // Reject modal
  const [rejectModal,   setRejectModal]   = useState(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Stats tab
  const [statsTab, setStatsTab] = useState('pending');

  // isOwner: артист видит свою панель
  // role сохраняется как 'artist' в AuthContext
  const isOwner = user?.role === 'artist' && String(user?.id) === String(id);

  const fetchData = async () => {
    try {
      const [artistRes, ordersRes] = await Promise.all([
        fetch(`${API}/artists/${id}`),
        fetch(`${API}/wedding_orders`),
      ]);
      const artistData = await artistRes.json();
      const allOrders  = await ordersRes.json();

      setData(artistData);
      dispatch(setArtist(artistData));

      // Фильтруем заказы где этот артист
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
    // Polling каждые 8 сек для владельца
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [id]);

  const handleAccept = async (orderId) => {
    setActionLoading(orderId + '_accept');
    try {
      await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
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
        body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason }),
      });
      await fetchData();
      setRejectModal(null);
      setRejectReason('');
    } catch {}
    setRejectLoading(false);
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!user) { setBookingMsg({ text: '⚠️ Войдите в систему', type: 'error' }); return; }
    if (!bookingDate) { setBookingMsg({ text: '⚠️ Выберите дату', type: 'error' }); return; }
    setBookingLoading(true);
    setBookingMsg({ text: '', type: '' });
    const newOrder = {
      id: `order_${Date.now()}`,
      date: bookingDate,
      guests: Number(bookingGuests),
      total_price_usd: data.price_per_hour_usd * bookingHours,
      status: 'pending',
      clientId: user.id,
      clientName: user.name || 'Клиент',
      client: { id: user.id, name: user.name || 'Клиент', phone: user.phone || '' },
      artist:  { id: data.id, name: data.name, category: data.category, price_per_hour_usd: data.price_per_hour_usd },
      artists: [{ id: data.id, name: data.name, category: data.category, price_per_hour_usd: data.price_per_hour_usd }],
      restaurant: null, car: null, cars: [], decors: [],
    };
    try {
      const res = await fetch(`${API}/wedding_orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });
      if (res.ok) {
        setBookingMsg({ text: '🎉 Заявка отправлена! Ожидайте ответа артиста.', type: 'success' });
        setBookingDate(''); setBookingHours(3);
        await fetchData();
      } else setBookingMsg({ text: '❌ Ошибка. Попробуйте снова.', type: 'error' });
    } catch { setBookingMsg({ text: '❌ Ошибка сети.', type: 'error' }); }
    setBookingLoading(false);
  };

  if (loading) return <LoadingScreen />;
  if (!data)   return <NotFound />;

  const stars    = Math.round(data.rating || 0);
  const revenue  = orders.filter(o => o.status === 'approved').reduce((s, o) => s + (o.total_price_usd || 0), 0);
  const pending  = orders.filter(o => o.status === 'pending');
  const approved = orders.filter(o => o.status === 'approved');
  const rejected = orders.filter(o => ['rejected','cancelled'].includes(o.status));
  const currentTabOrders = statsTab === 'pending' ? pending : statsTab === 'approved' ? approved : rejected;

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── REJECT MODAL ── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}>
            <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
              style={{ width: '100%', maxWidth: 400, background: 'linear-gradient(135deg,#1c0a0a,#0d0d1f)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 24, padding: 28 }}>
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>❌</div>
              <h3 style={{ color: '#fca5a5', fontWeight: 900, fontSize: 18, textAlign: 'center', margin: '0 0 6px' }}>Отклонить заявку</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>Клиент увидит вашу причину отказа</p>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Причина *</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Например: занят на эту дату..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Отмена
                </button>
                <button onClick={handleRejectSubmit} disabled={!rejectReason.trim() || rejectLoading}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(239,68,68,0.4)', background: rejectReason.trim() ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.05)', color: '#f87171', fontWeight: 700, cursor: rejectReason.trim() ? 'pointer' : 'not-allowed', fontSize: 13, opacity: rejectReason.trim() ? 1 : 0.5 }}>
                  {rejectLoading ? '...' : 'Отклонить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
        <img src={data.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800'}
          alt={data.name} onError={e => { e.target.src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800'; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.35)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #07070f 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, display: 'flex', alignItems: 'flex-end', gap: 18 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={data.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200'}
              alt={data.name} onError={e => { e.target.src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200'; }}
              style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', border: '2px solid rgba(201,168,76,0.6)' }} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#22c55e', border: '2px solid #07070f' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: 'white', fontSize: 26, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{data.name}</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 8px' }}>{data.genre} · {data.category}</p>
            <div style={{ display: 'flex', gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ fontSize: 14, color: i < stars ? '#C9A84C' : 'rgba(255,255,255,0.15)' }}>★</span>
              ))}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 6 }}>{data.rating}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: '#C9A84C', fontSize: 22, fontWeight: 900 }}>${data.price_per_hour_usd}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>за час</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* ── INFO CHIPS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '20px 0' }}>
          {[
            { emoji: '💰', label: 'Цена/час',  val: `$${data.price_per_hour_usd}` },
            { emoji: '⭐', label: 'Рейтинг',   val: data.rating || '—' },
            { emoji: '🎵', label: 'Жанр',      val: data.genre },
            { emoji: '📱', label: 'Категория', val: data.category },
          ].map(({ emoji, label, val }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── CONTACT ── */}
        {(data.phone || data.admin_phone) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 16, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>📞</span>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Контакт</div>
              <a href={`tel:${data.phone || data.admin_phone}`} style={{ color: '#C9A84C', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                {data.phone || data.admin_phone}
              </a>
            </div>
          </div>
        )}

        {/* ── CLIENT: BOOKING FORM ── */}
        {!isOwner && (
          <div style={{ background: 'linear-gradient(135deg,rgba(201,168,76,0.08),rgba(139,92,246,0.05))', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20, padding: 22, marginBottom: 20 }}>
            <h3 style={{ color: 'white', fontWeight: 800, fontSize: 16, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📅 Забронировать выступление
            </h3>
            <form onSubmit={handleBook}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>Количество гостей</label>
                <input type="number" min="10" value={bookingGuests} onChange={e => setBookingGuests(+e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Итоговая стоимость</span>
                <span style={{ color: '#C9A84C', fontWeight: 900, fontSize: 22 }}>${(data.price_per_hour_usd * bookingHours).toLocaleString()}</span>
              </div>
              {bookingMsg.text && (
                <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 12, textAlign: 'center', marginBottom: 12, background: bookingMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${bookingMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: bookingMsg.type === 'success' ? '#86efac' : '#fca5a5' }}>
                  {bookingMsg.text}
                </div>
              )}
              <button type="submit" disabled={bookingLoading}
                style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: bookingLoading ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#C9A84C,#7A5C1E)', color: bookingLoading ? 'rgba(255,255,255,0.3)' : 'white', fontWeight: 700, fontSize: 14, cursor: bookingLoading ? 'not-allowed' : 'pointer' }}>
                {bookingLoading ? 'Отправляем...' : '🎤 Отправить заявку'}
              </button>
            </form>
          </div>
        )}

        {/* ── OWNER ADMIN PANEL ── */}
        {isOwner && (
          <div style={{ marginTop: 4 }}>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Все заказы', val: orders.length,   accent: 'rgba(255,255,255,0.8)' },
                { label: '⏳ Ожидают',  val: pending.length,  accent: '#fbbf24' },
                { label: '✅ Принято',  val: approved.length, accent: '#34d399' },
                { label: '💰 Доход',    val: `$${revenue.toLocaleString()}`, accent: '#C9A84C' },
              ].map(({ label, val, accent }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: accent, fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{val}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
              {[
                { key: 'pending',  label: `Новые (${pending.length})`,    color: '#fbbf24' },
                { key: 'approved', label: `Принятые (${approved.length})`,color: '#34d399' },
                { key: 'rejected', label: `История (${rejected.length})`, color: '#94a3b8' },
              ].map(t => (
                <button key={t.key} onClick={() => setStatsTab(t.key)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
                    background: statsTab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: statsTab === t.key ? t.color : 'rgba(255,255,255,0.35)' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Orders list */}
            {currentTabOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                {statsTab === 'pending' ? 'Нет новых заявок' : statsTab === 'approved' ? 'Нет принятых заказов' : 'История пуста'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AnimatePresence>
                  {currentTabOrders.map(o => (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{
                        background: statsTab === 'pending' ? 'rgba(245,158,11,0.05)' : statsTab === 'approved' ? 'rgba(52,211,153,0.05)' : 'rgba(148,163,184,0.04)',
                        border: `1px solid ${statsTab === 'pending' ? 'rgba(245,158,11,0.2)' : statsTab === 'approved' ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.12)'}`,
                        borderRadius: 16, padding: 16,
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }}>{o.id}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 8 }}>
                            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>📅 {o.date}</span>
                            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>👥 {o.guests || 0} гостей</span>
                            <span style={{ color: '#C9A84C', fontWeight: 700, fontSize: 13 }}>💰 ${o.total_price_usd}</span>
                          </div>
                          {(o.client?.name || o.clientName) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>👤 Клиент:</span>
                              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>{o.client?.name || o.clientName}</span>
                              {(o.client?.phone) && (
                                <a href={`tel:${o.client.phone}`} style={{ color: '#C9A84C', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>{o.client.phone}</a>
                              )}
                            </div>
                          )}
                          {o.restaurant?.name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>🏛️ Зал:</span>
                              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{o.restaurant.name}</span>
                            </div>
                          )}
                          {o.rejection_reason && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                              <span style={{ color: 'rgba(248,113,113,0.7)', fontSize: 11 }}>Причина отказа: </span>
                              <span style={{ color: '#fca5a5', fontSize: 11 }}>{o.rejection_reason}</span>
                            </div>
                          )}
                          {o.cancellation_reason && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.15)' }}>
                              <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 11 }}>Клиент отменил: </span>
                              <span style={{ color: '#cbd5e1', fontSize: 11 }}>{o.cancellation_reason}</span>
                            </div>
                          )}
                        </div>
                        {statsTab === 'pending' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => handleAccept(o.id)} disabled={actionLoading === o.id + '_accept'}
                              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.12)', color: '#34d399', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              {actionLoading === o.id + '_accept' ? '...' : '✓ Принять'}
                            </button>
                            <button onClick={() => setRejectModal({ orderId: o.id })}
                              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              ✗ Отказать
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Logout */}
            <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { logout(); navigate('/'); }}
                style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Выйти →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'Ожидает', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
    approved:  { label: 'Принят',  color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
    rejected:  { label: 'Отклонён',color: '#f87171', bg: 'rgba(239,68,68,0.1)'   },
    cancelled: { label: 'Отменён', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed: { label: 'Подтверждён', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 40, height: 40, border: '2px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const NotFound = () => (
  <div style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
    <div><div style={{ fontSize: 48, marginBottom: 16 }}>😕</div><p>Профиль не найден</p></div>
  </div>
);