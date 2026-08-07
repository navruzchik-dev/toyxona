import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setArtist } from '../redux/slices/artistSlice.js';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:5000';
const USD_RATE = 12700;
const fmtUZS = usd => `~${Math.round(((usd || 0) * USD_RATE) / 1_000_000)} млн сум`;

const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.floor(diff / 86400000);
};

const REJECT_TEMPLATES = ['Уже есть выступление на эту дату', 'Не работаю в этом городе в эту дату', 'Не подходит формат мероприятия'];

export default function Artist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, logout } = useAuth();
  const { theme, cycleTheme, THEMES } = useTheme();

  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date_asc');
  const [actionLoading, setActionLoading] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [undoAction, setUndoAction] = useState(null);
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bay_vendor_notes')) || {}; } catch { return {}; }
  });
  const undoTimerRef = useRef(null);

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

  // Статус АРТИСТА внутри заказа — раздельно от зала (artist_status), чтобы
  // подтверждение/отклонение здесь не влияло на статус ресторана в том же заказе.
  const myStatusOf = (o) => o.artist_status || o.status || 'pending';

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
      setLastSynced(new Date());
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

  const deriveAggregate = (o, value) => {
    const aStatus = value;
    const rStatus = o.restaurant_status || (o.restaurant ? o.status : null) || (o.restaurant ? 'pending' : null);
    const parts = [rStatus, aStatus].filter(Boolean);
    if (parts.includes('rejected')) return 'rejected';
    if (parts.every(p => p === 'approved')) return 'approved';
    return 'pending';
  };

  const patchOrder = (orderId, patch) => fetch(`${API}/wedding_orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });

  const armUndo = (orderId, prevValue, prevReason) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAction({ orderId, prevValue, prevReason });
    undoTimerRef.current = setTimeout(() => setUndoAction(null), 6000);
  };

  // ── OWNER ACTIONS ──
  const handleAccept = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setActionLoading(orderId + '_accept');
    try {
      await patchOrder(orderId, {
        artist_status: 'approved',
        artist_rejection_reason: null,
        status: deriveAggregate(order, 'approved'),
      });
      armUndo(orderId, myStatusOf(order), order.artist_rejection_reason || null);
      await fetchData();
    } catch {}
    setActionLoading(null);
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return;
    const order = orders.find(o => o.id === rejectModal.orderId);
    if (!order) return;
    setRejectLoading(true);
    try {
      await patchOrder(rejectModal.orderId, {
        artist_status: 'rejected',
        artist_rejection_reason: rejectReason,
        status: deriveAggregate(order, 'rejected'),
      });
      armUndo(rejectModal.orderId, myStatusOf(order), order.artist_rejection_reason || null);
      await fetchData();
      setRejectModal(null);
      setRejectReason('');
    } catch {}
    setRejectLoading(false);
  };

  const handleComplete = async (orderId) => {
    setActionLoading(orderId + '_complete');
    try {
      await patchOrder(orderId, { status: 'completed', artist_status: 'completed' });
      await fetchData();
    } catch {}
    setActionLoading(null);
  };

  const handleUndo = async () => {
    if (!undoAction) return;
    const order = orders.find(o => o.id === undoAction.orderId);
    try {
      await patchOrder(undoAction.orderId, {
        artist_status: undoAction.prevValue,
        artist_rejection_reason: undoAction.prevReason,
        status: order ? deriveAggregate(order, undoAction.prevValue) : 'pending',
      });
      setUndoAction(null);
      await fetchData();
    } catch {}
  };

  const bulkApprove = async () => {
    for (const orderId of selectedIds) await handleAccept(orderId);
    setSelectedIds([]);
  };

  const saveNote = (orderId, text) => {
    setNotes(prev => {
      const next = { ...prev, [orderId]: text };
      localStorage.setItem('bay_vendor_notes', JSON.stringify(next));
      return next;
    });
  };

  const copyPhone = (phone) => { if (phone) navigator.clipboard?.writeText(phone); };

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
    const rows = filteredOrders.map(o =>
      `${o.id},${o.date},${o.client?.name || o.clientName || ''},${o.client?.phone || ''},${o.guests || 0},${o.total_price_usd},${myStatusOf(o)}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders_artist_${id}.csv`; a.click();
    URL.revokeObjectURL(url);
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
      artist_status: 'pending',
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

  // ── FILTERED / DERIVED ──
  const pending  = orders.filter(o => myStatusOf(o) === 'pending');
  const approved = orders.filter(o => ['approved', 'completed'].includes(myStatusOf(o)));
  const rejected = orders.filter(o => ['rejected', 'cancelled'].includes(myStatusOf(o)));
  const revenue  = approved.reduce((sum, o) => sum + (o.total_price_usd || 0), 0);

  const now = new Date();
  const thisMonthRevenue = approved.filter(o => {
    const d = new Date(o.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, o) => s + (o.total_price_usd || 0), 0);

  const clientCounts = orders.reduce((acc, o) => { const k = o.client?.name || o.clientName || '—'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const dateCounts = orders.reduce((acc, o) => { if (['pending', 'approved'].includes(myStatusOf(o))) acc[o.date] = (acc[o.date] || 0) + 1; return acc; }, {});
  const conflictDates = Object.entries(dateCounts).filter(([, c]) => c > 1).map(([d]) => d);
  const urgentPending = pending.filter(o => Number.isFinite(daysUntil(o.date)) && daysUntil(o.date) <= 5 && daysUntil(o.date) >= 0);

  const baseList = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected;
  const filteredOrders = useMemo(() => {
    let list = baseList.filter(o => {
      const q = search.toLowerCase();
      return !q || (o.client?.name || o.clientName || '').toLowerCase().includes(q) || (o.date || '').includes(q) || (o.id || '').toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'date_asc')  return new Date(a.date) - new Date(b.date);
      if (sortBy === 'date_desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'amount_desc') return (b.total_price_usd || 0) - (a.total_price_usd || 0);
      return 0;
    });
    return list;
  }, [baseList, search, sortBy]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '2px solid rgba(var(--gold-rgb,201,168,76),0.2)', borderTopColor: 'var(--gold, #C9A84C)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 12 }}>😕</div><p>Профиль не найден</p></div>
    </div>
  );

  const stars = Math.round(data.rating || 0);
  const currentThemeInfo = THEMES.find(t => t.key === theme) || THEMES[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Segoe UI', system-ui, sans-serif", color: 'var(--text)' }}>

      {/* ── UNDO SNACKBAR ── */}
      <AnimatePresence>
        {undoAction && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 250, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: 16, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>Статус заявки изменён</span>
            <button onClick={handleUndo} style={{ background: 'none', border: 'none', color: 'var(--gold, #C9A84C)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>↩ Отменить</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── REJECT MODAL ── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
            <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
              style={{ width: '100%', maxWidth: 420, background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 24, padding: 32 }}>
              <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>✕</div>
              <h3 style={{ color: '#fca5a5', fontWeight: 800, fontSize: 18, textAlign: 'center', margin: '0 0 6px' }}>Отклонить заявку</h3>
              <p style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>Клиент получит уведомление с вашей причиной</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {REJECT_TEMPLATES.map(t => (
                  <button key={t} onClick={() => setRejectReason(t)}
                    style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Причина *</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Например: занят на эту дату..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'var(--text2)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
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
              style={{ width: '100%', maxWidth: 480, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0, color: 'var(--text)' }}>Детали заявки</h3>
                <button onClick={() => setOrderDetail(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text2)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <DetailRow label="ID" val={orderDetail.id} mono />
                <DetailRow label="Статус" val={<StatusBadge status={myStatusOf(orderDetail)} />} />
                <DetailRow label="Дата события" val={`${orderDetail.date}${Number.isFinite(daysUntil(orderDetail.date)) ? ` (через ${daysUntil(orderDetail.date)} дн.)` : ''}`} />
                <DetailRow label="Гостей" val={orderDetail.guests} />
                <DetailRow label="Сумма" val={<span style={{ color: 'var(--gold, #C9A84C)', fontWeight: 700 }}>${orderDetail.total_price_usd} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text2)' }}>({fmtUZS(orderDetail.total_price_usd)})</span></span>} />
                <DetailRow label="Клиент" val={orderDetail.client?.name || orderDetail.clientName || '—'} />
                {(orderDetail.client?.phone) && (
                  <DetailRow label="Телефон" val={
                    <a href={`tel:${orderDetail.client.phone}`} style={{ color: 'var(--gold, #C9A84C)', fontWeight: 700, textDecoration: 'none' }}>{orderDetail.client.phone}</a>
                  } />
                )}
                {orderDetail.restaurant_status && (
                  <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 12, color: '#c4b5fd' }}>
                    Статус зала по этому заказу: <strong>{{ pending: 'ожидает', approved: 'принято', rejected: 'отклонено' }[orderDetail.restaurant_status] || orderDetail.restaurant_status}</strong> — от вас это не зависит.
                  </div>
                )}
                {orderDetail.artist_rejection_reason && (
                  <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12 }}>
                    <span style={{ color: 'rgba(248,113,113,0.7)' }}>Причина отказа: </span>
                    <span style={{ color: '#fca5a5' }}>{orderDetail.artist_rejection_reason}</span>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>Заметка (видна только вам)</label>
                  <textarea rows={2} value={notes[orderDetail.id] || ''} onChange={e => saveNote(orderDetail.id, e.target.value)}
                    placeholder="Например: перезвонить после 18:00"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text)', fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                {orderDetail.client?.phone && (
                  <a href={`tel:${orderDetail.client.phone}`}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text2)', fontWeight: 600, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
                    📞 Позвонить
                  </a>
                )}
                {myStatusOf(orderDetail) === 'approved' && (
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
              style={{ width: '100%', maxWidth: 480, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Редактировать профиль</h3>
                <button onClick={() => setEditModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text2)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>×</button>
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
                    <label style={{ display: 'block', color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
                    <input type={type} value={editForm[key] || ''} onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? +e.target.value : e.target.value }))}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                {editForm.image_url && (
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={editForm.image_url} alt="preview" style={{ width: '100%', height: 120, objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                <button onClick={() => setEditModal(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Отмена
                </button>
                <button onClick={handleSaveProfile} disabled={editSaving}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: editSaved ? 'rgba(52,211,153,0.25)' : 'linear-gradient(135deg,var(--gold, #C9A84C), color-mix(in srgb, var(--gold) 55%, black))', color: editSaved ? '#34d399' : 'white', fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
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
              style={{ width: '100%', maxWidth: 380, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: 28 }}>
              <h3 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>🔒 Заблокировать дату</h3>
              <p style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 20 }}>Клиенты не смогут забронировать вас на эту дату</p>
              <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setBlockDateModal(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Отмена
                </button>
                <button onClick={handleBlockDate} disabled={!blockDate}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'var(--gold, #C9A84C)', color: 'black', fontWeight: 700, cursor: blockDate ? 'pointer' : 'not-allowed', fontSize: 13, opacity: blockDate ? 1 : 0.5 }}>
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
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg) 0%, color-mix(in srgb, var(--bg) 30%, transparent) 60%, transparent 100%)' }} />

        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={data.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200'}
              alt={data.name}
              onError={e => { e.target.src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200'; }}
              style={{ width: 88, height: 88, borderRadius: 22, objectFit: 'cover', border: '2.5px solid rgba(var(--gold-rgb,201,168,76),0.7)' }}
            />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#22c55e', border: '2.5px solid var(--bg)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.5px', color: 'var(--text)' }}>{data.name}</h1>
            <p style={{ margin: '5px 0 8px', color: 'var(--text2)', fontSize: 13 }}>{data.genre} · {data.category}</p>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ fontSize: 14, color: i < stars ? 'var(--gold, #C9A84C)' : 'rgba(255,255,255,0.15)' }}>★</span>
              ))}
              <span style={{ color: 'var(--text2)', fontSize: 12, marginLeft: 5 }}>{data.rating}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: 'var(--gold, #C9A84C)', fontSize: 24, fontWeight: 900 }}>${data.price_per_hour_usd}</div>
            <div style={{ color: 'var(--text2)', fontSize: 11 }}>за час</div>
          </div>
        </div>

        {/* Owner top-right buttons */}
        {isOwner && (
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text2)', marginRight: 4 }}>
              {lastSynced ? `Синхр. ${lastSynced.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            <button onClick={fetchData} title="Обновить"
              style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>↻</button>
            <button onClick={cycleTheme} title={`Тема: ${currentThemeInfo.label}`}
              style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'block', background: currentThemeInfo.swatch }} />
            </button>
            <button onClick={() => { setEditForm(data); setEditModal(true); }}
              style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(var(--gold-rgb,201,168,76),0.15)', border: '1px solid rgba(var(--gold-rgb,201,168,76),0.35)', color: 'var(--gold, #C9A84C)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
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

        {/* Info Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '24px 0' }}>
          {[
            { emoji: '💰', label: 'Цена/час', val: `$${data.price_per_hour_usd}` },
            { emoji: '⭐', label: 'Рейтинг', val: data.rating || '—' },
            { emoji: '🎵', label: 'Жанр', val: data.genre },
            { emoji: '📱', label: 'Категория', val: data.category },
          ].map(({ emoji, label, val }) => (
            <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{emoji}</div>
              <div style={{ color: 'var(--text2)', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Contact & Payment */}
        {(data.phone || data.admin_phone || data.telegram || data.payment_card) && (
          <div style={{ display: 'grid', gridTemplateColumns: data.telegram || data.payment_card ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr', gap: 12, marginBottom: 24 }}>
            {(data.phone || data.admin_phone) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'var(--card)', border: '1px solid rgba(var(--gold-rgb,201,168,76),0.22)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(var(--gold-rgb,201,168,76),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📞</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Телефон</div>
                  <a href={`tel:${data.phone || data.admin_phone}`} style={{ color: 'var(--gold, #C9A84C)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    {data.phone || data.admin_phone}
                  </a>
                </div>
              </div>
            )}
            {data.telegram && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'var(--card)', border: '1px solid rgba(56,134,222,0.22)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(56,134,222,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✈️</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Telegram</div>
                  <a href={`https://t.me/${data.telegram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color: '#5b9eed', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    {data.telegram}
                  </a>
                </div>
              </div>
            )}
            {data.payment_card && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'var(--card)', border: '1px solid rgba(139,92,246,0.22)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💳</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Карта для оплаты</div>
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
          <div style={{ padding: '14px 20px', borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 24 }}>
            <div style={{ color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Заблокированные даты</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.booked_dates.map((d, i) => (
                <span key={i} style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12, fontWeight: 600 }}>📅 {d}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── CLIENT: BOOKING FORM ── */}
        {!isOwner && (
          <div style={{ background: 'linear-gradient(135deg,rgba(var(--gold-rgb,201,168,76),0.07),rgba(139,92,246,0.04))', border: '1px solid rgba(var(--gold-rgb,201,168,76),0.2)', borderRadius: 22, padding: 24, marginBottom: 28 }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 800, fontSize: 16, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📅 Забронировать выступление
            </h3>
            <form onSubmit={handleBook}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text2)', fontSize: 11, marginBottom: 6 }}>Дата мероприятия</label>
                  <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text2)', fontSize: 11, marginBottom: 6 }}>Часов выступления</label>
                  <input type="number" min="1" max="12" value={bookingHours} onChange={e => setBookingHours(+e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text2)', fontSize: 11, marginBottom: 6 }}>Количество гостей</label>
                <input type="number" min="10" value={bookingGuests} onChange={e => setBookingGuests(+e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)', marginBottom: 16 }}>
                <span style={{ color: 'var(--text2)', fontSize: 13 }}>Итоговая стоимость</span>
                <span style={{ color: 'var(--gold, #C9A84C)', fontWeight: 900, fontSize: 24 }}>${(data.price_per_hour_usd * bookingHours).toLocaleString()}</span>
              </div>
              {bookingMsg.text && (
                <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, textAlign: 'center', marginBottom: 14, background: bookingMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${bookingMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: bookingMsg.type === 'success' ? '#86efac' : '#fca5a5' }}>
                  {bookingMsg.text}
                </div>
              )}
              <button type="submit" disabled={bookingLoading}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: bookingLoading ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,var(--gold, #C9A84C), color-mix(in srgb, var(--gold) 55%, black))', color: bookingLoading ? 'rgba(255,255,255,0.3)' : 'white', fontWeight: 700, fontSize: 14, cursor: bookingLoading ? 'not-allowed' : 'pointer', boxShadow: bookingLoading ? 'none' : '0 4px 20px rgba(var(--gold-rgb,201,168,76),0.25)' }}>
                {bookingLoading ? 'Отправляем...' : '🎤 Отправить заявку'}
              </button>
            </form>
          </div>
        )}

        {/* ── OWNER ADMIN PANEL ── */}
        {isOwner && (
          <div>
            {/* Срочные / конфликты */}
            <AnimatePresence>
              {urgentPending.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <div style={{ fontSize: 13, color: '#f87171' }}>
                    <strong>{urgentPending.length}</strong> {urgentPending.length === 1 ? 'заявка' : 'заявки'} с датой тоя меньше 5 дней ждут ответа.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {conflictDates.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 16, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ fontSize: 12, color: '#fbbf24' }}>
                  Несколько активных заявок на дату(ы): <strong>{conflictDates.join(', ')}</strong>.
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Все заказы', val: orders.length, color: 'var(--text)' },
                { label: '⏳ Ожидают', val: pending.length, color: '#fbbf24' },
                { label: '✅ Принято', val: approved.length, color: '#34d399' },
                { label: '💰 Доход/мес', val: `$${thisMonthRevenue.toLocaleString()}`, color: 'var(--gold, #C9A84C)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 14px', textAlign: 'center' }}>
                  <div style={{ color, fontSize: 26, fontWeight: 900, marginBottom: 4 }}>{val}</div>
                  <div style={{ color: 'var(--text2)', fontSize: 11 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
              Доход всего: <strong style={{ color: 'var(--gold, #C9A84C)' }}>${revenue.toLocaleString()}</strong> ({fmtUZS(revenue)}) ·
              Постоянных клиентов: <strong style={{ color: '#a78bfa' }}>{Object.values(clientCounts).filter(c => c > 1).length}</strong>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 4, background: 'var(--card)', borderRadius: 14, padding: 4, flex: 1, minWidth: 260, border: '1px solid var(--border)' }}>
                {[
                  { key: 'pending', label: `Новые (${pending.length})`, color: '#fbbf24' },
                  { key: 'approved', label: `Принятые (${approved.length})`, color: '#34d399' },
                  { key: 'history', label: `История (${rejected.length})`, color: '#94a3b8' },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s', background: activeTab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === t.key ? t.color : 'var(--text2)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск клиента/даты..."
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text)', fontSize: 12, outline: 'none', minWidth: 200 }} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text)', fontSize: 12, outline: 'none' }}>
                <option value="date_asc">Дата ↑</option>
                <option value="date_desc">Дата ↓</option>
                <option value="amount_desc">Сумма ↓</option>
              </select>
              <button onClick={exportCSV} style={{ padding: '8px 16px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                📥 Экспорт CSV
              </button>
              <button onClick={() => setBlockDateModal(true)} style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                🔒 Блок дата
              </button>
            </div>

            {/* Bulk approve bar */}
            <AnimatePresence>
              {activeTab === 'pending' && selectedIds.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderRadius: 12, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>{selectedIds.length} заявок выбрано</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={bulkApprove} style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(52,211,153,0.2)', color: '#34d399', cursor: 'pointer' }}>Принять все</button>
                    <button onClick={() => setSelectedIds([])} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>Отмена</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Orders list */}
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text2)', fontSize: 14 }}>
                {search ? 'Ничего не найдено' : activeTab === 'pending' ? 'Нет новых заявок' : activeTab === 'approved' ? 'Нет принятых заказов' : 'История пуста'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AnimatePresence>
                  {filteredOrders.map(o => {
                    const st = myStatusOf(o);
                    const urgent = st === 'pending' && Number.isFinite(daysUntil(o.date)) && daysUntil(o.date) <= 5 && daysUntil(o.date) >= 0;
                    const isRepeat = (clientCounts[o.client?.name || o.clientName] || 0) > 1;
                    return (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      onClick={() => setOrderDetail(o)}
                      style={{
                        background: activeTab === 'pending' ? 'rgba(245,158,11,0.04)' : activeTab === 'approved' ? 'rgba(52,211,153,0.04)' : 'rgba(148,163,184,0.03)',
                        border: `1px solid ${urgent ? 'rgba(239,68,68,0.35)' : activeTab === 'pending' ? 'rgba(245,158,11,0.18)' : activeTab === 'approved' ? 'rgba(52,211,153,0.14)' : 'rgba(148,163,184,0.1)'}`,
                        borderRadius: 18, padding: 18, cursor: 'pointer', transition: 'background 0.2s'
                      }}
                      whileHover={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                            {activeTab === 'pending' && (
                              <input type="checkbox" checked={selectedIds.includes(o.id)}
                                onClick={e => e.stopPropagation()}
                                onChange={() => setSelectedIds(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])}
                                style={{ width: 14, height: 14 }} />
                            )}
                            <span style={{ color: 'var(--text2)', fontSize: 10, fontFamily: 'monospace' }}>{o.id}</span>
                            <StatusBadge status={st} />
                            {urgent && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>🔥 срочно</span>}
                            {isRepeat && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>⭐ постоянный</span>}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text2)', fontSize: 13 }}>📅 {o.date}</span>
                            <span style={{ color: 'var(--text2)', fontSize: 13 }}>👥 {o.guests || 0} гостей</span>
                            <span style={{ color: 'var(--gold, #C9A84C)', fontWeight: 700, fontSize: 13 }}>💰 ${o.total_price_usd}</span>
                          </div>
                          {(o.client?.name || o.clientName) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: 'var(--text2)', fontSize: 12 }}>👤</span>
                              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{o.client?.name || o.clientName}</span>
                              {o.client?.phone && (
                                <>
                                  <a href={`tel:${o.client.phone}`} onClick={e => e.stopPropagation()}
                                    style={{ color: 'var(--gold, #C9A84C)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>{o.client.phone}</a>
                                  <button onClick={e => { e.stopPropagation(); copyPhone(o.client.phone); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 12 }}>📋</button>
                                </>
                              )}
                            </div>
                          )}
                          {notes[o.id] && (
                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text2)' }}>📝 {notes[o.id]}</div>
                          )}
                          {o.artist_rejection_reason && (
                            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 11, color: '#fca5a5' }}>
                              Причина отказа: {o.artist_rejection_reason}
                            </div>
                          )}
                        </div>
                        {activeTab === 'pending' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleAccept(o.id)} disabled={actionLoading === o.id + '_accept'}
                              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.12)', color: '#34d399', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              {actionLoading === o.id + '_accept' ? '...' : '✓ Принять'}
                            </button>
                            <button onClick={() => { setRejectModal({ orderId: o.id }); setRejectReason(''); }}
                              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              ✗ Отказать
                            </button>
                          </div>
                        )}
                        {activeTab === 'approved' && st === 'approved' && (
                          <button onClick={e => { e.stopPropagation(); handleComplete(o.id); }} disabled={actionLoading === o.id + '_complete'}
                            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(129,140,248,0.3)', background: 'rgba(129,140,248,0.1)', color: '#818cf8', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                            Выполнено
                          </button>
                        )}
                      </div>
                    </motion.div>
                    );
                  })}
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
      <span style={{ color: 'var(--text2)', fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{val}</span>
    </div>
  );
}