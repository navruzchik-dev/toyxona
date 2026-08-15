import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setArtist } from '../redux/slices/artistSlice.js';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPhone, FiSend, FiCreditCard, FiUsers, FiDollarSign, FiAlertTriangle,
  FiSearch, FiDownload, FiRefreshCw, FiEdit2, FiLogOut, FiCheck, FiX,
  FiCalendar, FiCopy, FiStar, FiZap, FiFrown, FiLock, FiMic, FiUser,
  FiMusic, FiClock,
} from 'react-icons/fi';

const API = 'http://localhost:5000';
const USD_RATE = 12700;
const fmtUZS = usd => `~${Math.round(((usd || 0) * USD_RATE) / 1_000_000)} млн сум`;

const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.floor(diff / 86400000);
};

const REJECT_TEMPLATES = ['Уже есть выступление на эту дату', 'Не работаю в этом городе в эту дату', 'Не подходит формат мероприятия'];

/* ── Design tokens (from portfolio mock) ── */
const olive = '#6B7B5E';
const oliveDark = '#5A6950';
const cream = '#F5F2EA';
const ink = '#2B2A24';
const gold = '#B98B4E';
const muted = '#8A8878';
const softBorder = '#EAE6DA';
const white = '#FFFFFF';

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

  // Статус АРТИСТА — только artist_status. НИКОГДА не наследуем o.status,
  // иначе одобрение зала «заражает» артиста.
  const myStatusOf = (o) => {
    if (o.status === 'cancelled') return 'cancelled';
    if (o.artist_status) return o.artist_status;
    return 'pending';
  };

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
    // Только restaurant_status, НЕ o.status
    const rStatus = o.restaurant_status || (o.restaurant ? 'pending' : null);
    const parts = [rStatus, aStatus].filter(Boolean);
    if (parts.includes('rejected')) return 'rejected';
    if (parts.length && parts.every(p => p === 'approved')) return 'approved';
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
      const hallKeep = order.restaurant_status ?? (order.restaurant ? 'pending' : null);
      await patchOrder(orderId, {
        artist_status: 'approved',
        artist_rejection_reason: null,
        restaurant_status: hallKeep,
        status: deriveAggregate({ ...order, restaurant_status: hallKeep }, 'approved'),
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
      const hallKeep = order.restaurant_status ?? (order.restaurant ? 'pending' : null);
      await patchOrder(rejectModal.orderId, {
        artist_status: 'rejected',
        artist_rejection_reason: rejectReason,
        restaurant_status: hallKeep,
        status: deriveAggregate({ ...order, restaurant_status: hallKeep }, 'rejected'),
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
    if (!user) { setBookingMsg({ text: 'Войдите в систему', type: 'error' }); return; }
    if (!bookingDate) { setBookingMsg({ text: 'Выберите дату', type: 'error' }); return; }
    if (data.booked_dates?.includes(bookingDate)) {
      setBookingMsg({ text: 'Артист занят на эту дату', type: 'error' }); return;
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
      restaurant_status: null,
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
        setBookingMsg({ text: 'Заявка отправлена! Ожидайте подтверждения.', type: 'success' });
        setBookingDate(''); setBookingHours(3); setBookingGuests(100);
        await fetchData();
      } else {
        setBookingMsg({ text: 'Ошибка. Попробуйте снова.', type: 'error' });
      }
    } catch {
      setBookingMsg({ text: 'Ошибка сети.', type: 'error' });
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
    <div style={{ minHeight: '100vh', background: cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: `2px solid ${softBorder}`, borderTopColor: gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', background: cream, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 12, color: muted, display: "flex", justifyContent: "center" }}><FiFrown /></div><p>Профиль не найден</p></div>
    </div>
  );

  const stars = Math.round(data.rating || 0);
  const currentThemeInfo = THEMES.find(t => t.key === theme) || THEMES[0];

  /* ── Shared style helpers ── */
  const card = {
    background: white,
    borderRadius: 16,
    border: `1px solid ${softBorder}`,
  };
  const inputStyle = {
    width: '100%',
    background: cream,
    border: `1px solid ${softBorder}`,
    borderRadius: 12,
    padding: '10px 14px',
    color: ink,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Poppins', sans-serif",
  };
  const btnPrimary = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: ink,
    color: '#fff',
    border: 'none',
    borderRadius: 30,
    padding: '12px 24px',
    fontSize: 13,
    letterSpacing: 1,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
  };
  const btnOlive = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: olive,
    color: '#fff',
    border: 'none',
    borderRadius: 30,
    padding: '12px 24px',
    fontSize: 13,
    letterSpacing: 1,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
  };
  const btnGhost = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    color: ink,
    border: `1px solid ${softBorder}`,
    borderRadius: 30,
    padding: '11px 22px',
    fontSize: 13,
    letterSpacing: 1,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
  };
  const sectionLabel = {
    fontSize: 12,
    letterSpacing: 3,
    color: muted,
    fontWeight: 600,
    marginBottom: 6,
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: cream,
      fontFamily: "'Poppins', sans-serif",
      color: ink,
    }}>

      {/* ── UNDO SNACKBAR ── */}
      <AnimatePresence>
        {undoAction && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 250,
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 24px', borderRadius: 30,
              background: ink, color: '#fff',
              boxShadow: '0 12px 40px rgba(43,42,36,0.25)',
            }}
          >
            <span style={{ fontSize: 13 }}>Статус заявки изменён</span>
            <button
              onClick={handleUndo}
              style={{ background: 'none', border: 'none', color: gold, fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: 0.5 }}
            >
              ↩ Отменить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── REJECT MODAL ── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              background: 'rgba(43,42,36,0.45)', backdropFilter: 'blur(12px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              style={{
                width: '100%', maxWidth: 420,
                background: white, border: `1px solid ${softBorder}`,
                borderRadius: 24, padding: 32,
                boxShadow: '0 24px 60px rgba(43,42,36,0.12)',
              }}
            >
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8, color: '#B24A3C' }}>✕</div>
              <h3 style={{
                color: ink, fontWeight: 700, fontSize: 20, textAlign: 'center', margin: '0 0 6px',
                fontFamily: "'Playfair Display', Georgia, serif",
              }}>
                Отклонить заявку
              </h3>
              <p style={{ color: muted, fontSize: 13, textAlign: 'center', marginBottom: 18 }}>
                Клиент получит уведомление с вашей причиной
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {REJECT_TEMPLATES.map(t => (
                  <button
                    key={t}
                    onClick={() => setRejectReason(t)}
                    style={{
                      fontSize: 11, padding: '6px 12px', borderRadius: 20,
                      background: cream, border: `1px solid ${softBorder}`,
                      color: muted, cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label style={{ display: 'block', color: muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                Причина *
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Например: занят на эту дату..."
                style={{ ...inputStyle, resize: 'none' }}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button
                  onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  style={{ ...btnGhost, flex: 1, padding: '12px 0' }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim() || rejectLoading}
                  style={{
                    ...btnPrimary, flex: 1, padding: '12px 0',
                    background: rejectReason.trim() ? '#B24A3C' : '#D4A5A0',
                    cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOrderDetail(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              background: 'rgba(43,42,36,0.45)', backdropFilter: 'blur(12px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 480,
                background: white, border: `1px solid ${softBorder}`,
                borderRadius: 24, padding: 28, overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(43,42,36,0.12)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <h3 style={{
                  fontWeight: 700, fontSize: 18, margin: 0, color: ink,
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}>
                  Детали заявки
                </h3>
                <button
                  onClick={() => setOrderDetail(null)}
                  style={{
                    background: cream, border: 'none', color: muted,
                    width: 34, height: 34, borderRadius: 12, cursor: 'pointer', fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                <DetailRow label="ID" val={orderDetail.id} mono />
                <DetailRow label="Статус" val={<StatusBadge status={myStatusOf(orderDetail)} />} />
                <DetailRow
                  label="Дата события"
                  val={`${orderDetail.date}${Number.isFinite(daysUntil(orderDetail.date)) ? ` (через ${daysUntil(orderDetail.date)} дн.)` : ''}`}
                />
                <DetailRow label="Гостей" val={orderDetail.guests} />
                <DetailRow
                  label="Сумма"
                  val={
                    <span style={{ color: gold, fontWeight: 700 }}>
                      ${orderDetail.total_price_usd}{' '}
                      <span style={{ fontWeight: 400, fontSize: 11, color: muted }}>({fmtUZS(orderDetail.total_price_usd)})</span>
                    </span>
                  }
                />
                <DetailRow label="Клиент" val={orderDetail.client?.name || orderDetail.clientName || '—'} />
                {orderDetail.client?.phone && (
                  <DetailRow
                    label="Телефон"
                    val={
                      <a href={`tel:${orderDetail.client.phone}`} style={{ color: gold, fontWeight: 700, textDecoration: 'none' }}>
                        {orderDetail.client.phone}
                      </a>
                    }
                  />
                )}
                {orderDetail.restaurant_status && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: 'rgba(107,123,94,0.08)', border: `1px solid rgba(107,123,94,0.2)`,
                    fontSize: 12, color: olive,
                  }}>
                    Статус зала по этому заказу:{' '}
                    <strong>
                      {{ pending: 'ожидает', approved: 'принято', rejected: 'отклонено' }[orderDetail.restaurant_status] || orderDetail.restaurant_status}
                    </strong>{' '}
                    — от вас это не зависит.
                  </div>
                )}
                {orderDetail.artist_rejection_reason && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: 'rgba(178,74,60,0.08)', border: '1px solid rgba(178,74,60,0.2)',
                    fontSize: 12,
                  }}>
                    <span style={{ color: 'rgba(178,74,60,0.7)' }}>Причина отказа: </span>
                    <span style={{ color: '#B24A3C' }}>{orderDetail.artist_rejection_reason}</span>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', color: muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                    Заметка (видна только вам)
                  </label>
                  <textarea
                    rows={2}
                    value={notes[orderDetail.id] || ''}
                    onChange={e => saveNote(orderDetail.id, e.target.value)}
                    placeholder="Например: перезвонить после 18:00"
                    style={{ ...inputStyle, resize: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                {orderDetail.client?.phone && (
                  <a
                    href={`tel:${orderDetail.client.phone}`}
                    style={{ ...btnGhost, flex: 1, padding: '12px 0', textDecoration: 'none', textAlign: 'center' }}
                  >
                    <><FiPhone size={13} style={{ marginRight: 4 }} /> Позвонить</>
                  </a>
                )}
                {myStatusOf(orderDetail) === 'approved' && (
                  <button
                    onClick={() => { handleComplete(orderDetail.id); setOrderDetail(null); }}
                    style={{ ...btnOlive, flex: 1, padding: '12px 0' }}
                  >
                    <><FiCheck size={13} style={{ marginRight: 4 }} /> Выполнено</>
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              background: 'rgba(43,42,36,0.45)', backdropFilter: 'blur(12px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              style={{
                width: '100%', maxWidth: 480,
                background: white, border: `1px solid ${softBorder}`,
                borderRadius: 24, overflow: 'hidden',
                display: 'flex', flexDirection: 'column', maxHeight: '88vh',
                boxShadow: '0 24px 60px rgba(43,42,36,0.12)',
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 24px', borderBottom: `1px solid ${softBorder}`,
              }}>
                <h3 style={{
                  margin: 0, fontWeight: 700, fontSize: 18, color: ink,
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}>
                  Редактировать профиль
                </h3>
                <button
                  onClick={() => setEditModal(false)}
                  style={{
                    background: cream, border: 'none', color: muted,
                    width: 34, height: 34, borderRadius: 12, cursor: 'pointer', fontSize: 18,
                  }}
                >
                  ×
                </button>
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
                    <label style={{
                      display: 'block', color: muted, fontSize: 11,
                      letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
                    }}>
                      {label}
                    </label>
                    <input
                      type={type}
                      value={editForm[key] || ''}
                      onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? +e.target.value : e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))}
                {editForm.image_url && (
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${softBorder}` }}>
                    <img
                      src={editForm.image_url}
                      alt="preview"
                      style={{ width: '100%', height: 120, objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
              <div style={{
                padding: '16px 24px', borderTop: `1px solid ${softBorder}`,
                display: 'flex', gap: 12,
              }}>
                <button onClick={() => setEditModal(false)} style={{ ...btnGhost, flex: 1, padding: '12px 0' }}>
                  Отмена
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={editSaving}
                  style={{
                    ...btnPrimary, flex: 1, padding: '12px 0',
                    background: editSaved ? olive : ink,
                    cursor: editSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {editSaving ? '...' : editSaved ? (<><FiCheck size={13} style={{ marginRight: 4 }} /> Сохранено!</>) : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BLOCK DATE MODAL ── */}
      <AnimatePresence>
        {blockDateModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              background: 'rgba(43,42,36,0.45)', backdropFilter: 'blur(12px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              style={{
                width: '100%', maxWidth: 380,
                background: white, border: `1px solid ${softBorder}`,
                borderRadius: 24, padding: 28,
                boxShadow: '0 24px 60px rgba(43,42,36,0.12)',
              }}
            >
              <h3 style={{
                margin: '0 0 6px', fontWeight: 700, fontSize: 18, color: ink,
                fontFamily: "'Playfair Display', Georgia, serif",
              }}>
                <FiLock size={16} style={{ marginRight: 6, verticalAlign: "middle" }} /> Заблокировать дату
              </h3>
              <p style={{ color: muted, fontSize: 13, marginBottom: 20 }}>
                Клиенты не смогут забронировать вас на эту дату
              </p>
              <input
                type="date"
                value={blockDate}
                onChange={e => setBlockDate(e.target.value)}
                style={{ ...inputStyle, marginBottom: 18 }}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setBlockDateModal(false)} style={{ ...btnGhost, flex: 1, padding: '12px 0' }}>
                  Отмена
                </button>
                <button
                  onClick={handleBlockDate}
                  disabled={!blockDate}
                  style={{
                    ...btnPrimary, flex: 1, padding: '12px 0',
                    background: blockDate ? gold : '#D4C4A8',
                    cursor: blockDate ? 'pointer' : 'not-allowed',
                    opacity: blockDate ? 1 : 0.7,
                  }}
                >
                  Заблокировать
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════ MAIN PAGE ══════════════ */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>

        {/* ── OWNER TOP BAR ── */}
        {isOwner && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 10, padding: '24px 0 0',
          }}>
            <span style={{ fontSize: 11, color: muted, letterSpacing: 0.5, marginRight: 4 }}>
              {lastSynced ? `Синхр. ${lastSynced.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            <button
              onClick={fetchData}
              title="Обновить"
              style={{
                width: 36, height: 36, borderRadius: 12,
                background: white, border: `1px solid ${softBorder}`,
                color: muted, cursor: 'pointer', fontSize: 15,
              }}
            >
              <FiRefreshCw size={15} color="#8A8878" />
            </button>
            <button
              onClick={cycleTheme}
              title={`Тема: ${currentThemeInfo.label}`}
              style={{
                width: 36, height: 36, borderRadius: 12,
                background: white, border: `1px solid ${softBorder}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'block', background: currentThemeInfo.swatch }} />
            </button>
            <button
              onClick={() => { setEditForm(data); setEditModal(true); }}
              style={{
                padding: '8px 18px', borderRadius: 30,
                background: white, border: `1px solid ${softBorder}`,
                color: gold, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                letterSpacing: 0.5, fontFamily: "'Poppins', sans-serif",
              }}
            >
              <FiEdit2 size={13} style={{ marginRight: 4 }} /> Изменить
            </button>
            <button
              onClick={() => { logout(); navigate('/'); }}
              style={{
                padding: '8px 18px', borderRadius: 30,
                background: 'rgba(178,74,60,0.08)', border: '1px solid rgba(178,74,60,0.2)',
                color: '#B24A3C', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                letterSpacing: 0.5, fontFamily: "'Poppins', sans-serif",
              }}
            >
              Выйти
            </button>
          </div>
        )}

        {/* ── HERO ── */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 48,
          alignItems: 'center',
          padding: isOwner ? '32px 0 48px' : '48px 0 48px',
        }}>
          {/* Left text */}
          <div>
            <p style={{
              fontFamily: "'Dancing Script', cursive",
              fontSize: 24, color: gold, margin: 0, lineHeight: 1,
            }}>
              {data.category || 'Artist'}
            </p>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 56, lineHeight: 1.05, margin: '6px 0 14px',
              color: gold, fontWeight: 700,
            }}>
              {data.name}
            </h1>
            <p style={{
              letterSpacing: 3, fontSize: 13, color: olive,
              fontWeight: 600, marginBottom: 18, textTransform: 'uppercase',
            }}>
              {data.genre}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ fontSize: 16, color: i < stars ? gold : softBorder }}>★</span>
              ))}
              <span style={{ color: muted, fontSize: 13, marginLeft: 6 }}>{data.rating || '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{
                ...btnPrimary,
                background: olive,
                padding: '14px 28px',
              }}>
                ${data.price_per_hour_usd}
                <span style={{ opacity: 0.75, fontWeight: 400, fontSize: 12 }}>/ час</span>
              </div>
              {!isOwner && (
                <a
                  href="#booking"
                  style={{ ...btnGhost, textDecoration: 'none' }}
                >
                  Забронировать →
                </a>
              )}
            </div>
          </div>

          {/* Right portrait */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: olive,
              borderRadius: '220px 220px 20px 20px',
              height: 420,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
            }}>
              <img
                src={data.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600'}
                alt={data.name}
                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600'; }}
                style={{
                  width: '82%', height: '92%',
                  borderRadius: '200px 200px 0 0',
                  objectFit: 'cover',
                }}
              />
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
     <section style={{
  background: olive,
  borderRadius: 20,
  padding: '28px 48px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 56,
  flexWrap: 'wrap',
  gap: 20,
}}>
  {[
    { v: `$${data.price_per_hour_usd}`, l: 'цена за час' },
    { v: data.rating || '—', l: 'рейтинг' },
    { v: data.category || '—', l: 'категория' },
    { v: data.genre || '—', l: 'жанр' },
  ].map((s) => (
    <div key={s.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, color: '#fff' }}>
      <span style={{
        fontSize: 24, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.1,
      }}>
        {s.v}
      </span>
      <span style={{
        fontSize: 11, letterSpacing: 1.2, opacity: 0.85,
        lineHeight: 1.3, textTransform: 'uppercase',
      }}>
        {s.l}
      </span>
    </div>
  ))}
</section>

        {/* ── PROFILE INFO (contacts) ── */}
        {(data.phone || data.admin_phone || data.telegram || data.payment_card) && (
          <section style={{ marginBottom: 56 }}>
            <div style={{ marginBottom: 24 }}>
              <p style={sectionLabel}>SELECTED</p>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 32, color: gold, margin: 0,
              }}>
                Profile info
              </h2>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
            }}>
              {(data.phone || data.admin_phone) && (
                <div style={{ ...card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 14,
                    background: 'rgba(185,139,78,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FiPhone size={18} color={gold} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, letterSpacing: 1.2, color: muted, margin: '0 0 3px', textTransform: 'uppercase' }}>
                      Телефон
                    </p>
                    <a
                      href={`tel:${data.phone || data.admin_phone}`}
                      style={{
                        color: gold, fontWeight: 700, fontSize: 15,
                        textDecoration: 'none', fontFamily: "'Playfair Display', Georgia, serif",
                      }}
                    >
                      {data.phone || data.admin_phone}
                    </a>
                  </div>
                </div>
              )}
              {data.telegram && (
                <div style={{ ...card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 14,
                    background: 'rgba(107,123,94,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FiSend size={18} color={olive} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, letterSpacing: 1.2, color: muted, margin: '0 0 3px', textTransform: 'uppercase' }}>
                      Telegram
                    </p>
                    <a
                      href={`https://t.me/${data.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: olive, fontWeight: 700, fontSize: 15,
                        textDecoration: 'none', fontFamily: "'Playfair Display', Georgia, serif",
                      }}
                    >
                      {data.telegram}
                    </a>
                  </div>
                </div>
              )}
              {data.payment_card && (
                <div style={{ ...card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 14,
                    background: 'rgba(139,111,170,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FiCreditCard size={18} color="#8B6FAA" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, letterSpacing: 1.2, color: muted, margin: '0 0 3px', textTransform: 'uppercase' }}>
                      Карта для оплаты
                    </p>
                    <span style={{
                      color: '#8B6FAA', fontWeight: 700, fontSize: 14,
                      fontFamily: 'monospace', letterSpacing: '0.5px',
                    }}>
                      {data.payment_card.replace(/(\d{4})/g, '$1 ').trim()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── BLOCKED DATES ── */}
        {isOwner && data.booked_dates?.length > 0 && (
          <div style={{
            ...card, padding: '18px 22px', marginBottom: 32,
          }}>
            <div style={{ color: muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
              Заблокированные даты
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.booked_dates.map((d, i) => (
                <span
                  key={i}
                  style={{
                    padding: '5px 14px', borderRadius: 20,
                    background: 'rgba(178,74,60,0.08)', border: '1px solid rgba(178,74,60,0.18)',
                    color: '#B24A3C', fontSize: 12, fontWeight: 600,
                  }}
                >
                  <FiCalendar size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── CLIENT: BOOKING FORM ── */}
        {!isOwner && (
          <section id="booking" style={{
            ...card,
            padding: 32,
            marginBottom: 56,
            background: `linear-gradient(135deg, rgba(185,139,78,0.06), rgba(107,123,94,0.04))`,
            border: `1px solid rgba(185,139,78,0.2)`,
          }}>
            <h3 style={{
              color: ink, fontWeight: 700, fontSize: 22, margin: '0 0 22px',
              fontFamily: "'Playfair Display', Georgia, serif",
            }}>
              <FiCalendar size={18} style={{ marginRight: 8, verticalAlign: "middle" }} /> Забронировать выступление
            </h3>
            <form onSubmit={handleBook}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', color: muted, fontSize: 11, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                    Дата мероприятия
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={e => setBookingDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: muted, fontSize: 11, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                    Часов выступления
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={bookingHours}
                    onChange={e => setBookingHours(+e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', color: muted, fontSize: 11, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  Количество гостей
                </label>
                <input
                  type="number"
                  min="10"
                  value={bookingGuests}
                  onChange={e => setBookingGuests(+e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 0', borderTop: `1px solid ${softBorder}`, marginBottom: 18,
              }}>
                <span style={{ color: muted, fontSize: 13 }}>Итоговая стоимость</span>
                <span style={{
                  color: gold, fontWeight: 700, fontSize: 28,
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}>
                  ${(data.price_per_hour_usd * bookingHours).toLocaleString()}
                </span>
              </div>
              {bookingMsg.text && (
                <div style={{
                  padding: '12px 16px', borderRadius: 12, fontSize: 13, textAlign: 'center', marginBottom: 16,
                  background: bookingMsg.type === 'success' ? 'rgba(107,123,94,0.1)' : 'rgba(178,74,60,0.1)',
                  border: `1px solid ${bookingMsg.type === 'success' ? 'rgba(107,123,94,0.3)' : 'rgba(178,74,60,0.3)'}`,
                  color: bookingMsg.type === 'success' ? oliveDark : '#B24A3C',
                }}>
                  {bookingMsg.text}
                </div>
              )}
              <button
                type="submit"
                disabled={bookingLoading}
                style={{
                  ...btnPrimary,
                  width: '100%',
                  padding: '16px 0',
                  background: bookingLoading ? muted : ink,
                  cursor: bookingLoading ? 'not-allowed' : 'pointer',
                  boxShadow: bookingLoading ? 'none' : '0 6px 24px rgba(43,42,36,0.15)',
                }}
              >
                {bookingLoading ? 'Отправляем...' : (<><FiMic size={14} style={{ marginRight: 6 }} /> Отправить заявку</>)}
              </button>
            </form>
          </section>
        )}

        {/* ── OWNER ADMIN PANEL ── */}
        {isOwner && (
          <div style={{ paddingBottom: 80 }}>

            {/* Urgent / conflicts */}
            <AnimatePresence>
              {urgentPending.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 22px', borderRadius: 16,
                    background: 'rgba(178,74,60,0.07)', border: '1px solid rgba(178,74,60,0.22)',
                    marginBottom: 16,
                  }}
                >
                  <span style={{ display: "flex" }}><FiAlertTriangle size={22} color="#B24A3C" /></span>
                  <div style={{ fontSize: 13, color: '#B24A3C' }}>
                    <strong>{urgentPending.length}</strong>{' '}
                    {urgentPending.length === 1 ? 'заявка' : 'заявки'} с датой менее 5 дней ждут ответа.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {conflictDates.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 22px', borderRadius: 16,
                background: 'rgba(185,139,78,0.07)', border: '1px solid rgba(185,139,78,0.22)',
                marginBottom: 16,
              }}>
                <span style={{ display: "flex" }}><FiAlertTriangle size={18} color="#8A6A34" /></span>
                <div style={{ fontSize: 12, color: '#8A6A34' }}>
                  Несколько активных заявок на дату(ы): <strong>{conflictDates.join(', ')}</strong>.
                </div>
              </div>
            )}

            {/* Stats process-style */}
            <section style={{ marginBottom: 40, textAlign: 'center' }}>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 26, letterSpacing: 1, marginBottom: 28, color: ink,
              }}>
                МОИ ЗАКАЗЫ
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
              }}>
                {[
                  { t: String(orders.length), d: 'все заказы' },
                  { t: String(pending.length), d: 'ждут' },
                  { t: String(approved.length), d: 'принято' },
                  { t: `$${thisMonthRevenue.toLocaleString()}`, d: 'доход / мес' },
                ].map((p) => (
                  <div key={p.d} style={{
                    ...card, padding: '22px 16px', textAlign: 'center',
                  }}>
                    <p style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 28, margin: '0 0 6px', color: gold, fontWeight: 700,
                    }}>
                      {p.t}
                    </p>
                    <p style={{ fontSize: 12, color: muted, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>
                      {p.d}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: muted, marginTop: 16 }}>
                Доход всего:{' '}
                <strong style={{ color: gold }}>${revenue.toLocaleString()}</strong> ({fmtUZS(revenue)}) ·
                Постоянных клиентов:{' '}
                <strong style={{ color: olive }}>
                  {Object.values(clientCounts).filter(c => c > 1).length}
                </strong>
              </div>
            </section>

            {/* ── TOOLBAR (matching screenshot) ── */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'center',
            }}>
              {/* Tabs */}
              <div style={{
                display: 'flex', gap: 4,
                background: white, borderRadius: 30, padding: 4,
                border: `1px solid ${softBorder}`,
                flex: 1, minWidth: 280,
              }}>
                {[
                  { key: 'pending', label: `Новые (${pending.length})` },
                  { key: 'approved', label: `Принятые (${approved.length})` },
                  { key: 'history', label: `История (${rejected.length})` },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 26, border: 'none',
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: activeTab === t.key ? cream : 'transparent',
                      color: activeTab === t.key ? ink : muted,
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск клиента/даты..."
                style={{
                  background: white, border: `1px solid ${softBorder}`,
                  borderRadius: 30, padding: '10px 18px',
                  color: ink, fontSize: 13, outline: 'none', minWidth: 200,
                  fontFamily: "'Poppins', sans-serif",
                }}
              />

              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  background: white, border: `1px solid ${softBorder}`,
                  borderRadius: 30, padding: '10px 16px',
                  color: ink, fontSize: 13, outline: 'none',
                  fontFamily: "'Poppins', sans-serif", cursor: 'pointer',
                }}
              >
                <option value="date_asc">Дата ↑</option>
                <option value="date_desc">Дата ↓</option>
                <option value="amount_desc">Сумма ↓</option>
              </select>

              {/* Export */}
              <button
                onClick={exportCSV}
                style={{
                  padding: '10px 18px', borderRadius: 30,
                  background: white, border: `1px solid ${softBorder}`,
                  color: muted, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
            gap: 6,
        padding: '10px 20px',
                }}
              >
                <FiDownload size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Экспорт CSV
              </button>

              {/* Block date */}
              <button
                onClick={() => setBlockDateModal(true)}
                style={{
                  padding: '10px 18px', borderRadius: 30,
                  background: 'rgba(178,74,60,0.06)', border: '1px solid rgba(178,74,60,0.18)',
                  color: '#B24A3C', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 20px',
                }}
              >
                <FiLock size={13} style={{
                   marginRight: 4,
                    verticalAlign: 'middle',
                     }} /> Блок дата
              </button>
            </div>

            {/* Bulk approve bar */}
            <AnimatePresence>
              {activeTab === 'pending' && selectedIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 18px', borderRadius: 16,
                    background: 'rgba(107,123,94,0.08)', border: '1px solid rgba(107,123,94,0.2)',
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: oliveDark }}>
                    {selectedIds.length} заявок выбрано
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={bulkApprove}
                      style={{
                        fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 20,
                        border: 'none', background: olive, color: '#fff', cursor: 'pointer',
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      Принять все
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      style={{
                        fontSize: 12, padding: '7px 14px', borderRadius: 20,
                        border: 'none', background: 'transparent', color: muted, cursor: 'pointer',
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── ORDERS LIST (matching screenshot) ── */}
            {filteredOrders.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 0', color: muted, fontSize: 14,
              }}>
                {search
                  ? 'Ничего не найдено'
                  : activeTab === 'pending'
                    ? 'Нет новых заявок'
                    : activeTab === 'approved'
                      ? 'Нет принятых заказов'
                      : 'История пуста'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <AnimatePresence>
                  {filteredOrders.map(o => {
                    const st = myStatusOf(o);
                    const urgent = st === 'pending' && Number.isFinite(daysUntil(o.date)) && daysUntil(o.date) <= 5 && daysUntil(o.date) >= 0;
                    const isRepeat = (clientCounts[o.client?.name || o.clientName] || 0) > 1;
                    return (
                      <motion.div
                        key={o.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOrderDetail(o)}
                        style={{
                          background: white,
                          border: `1px solid ${urgent ? 'rgba(178,74,60,0.35)' : softBorder}`,
                          borderRadius: 20,
                          padding: '18px 22px',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.2s, border-color 0.2s',
                          boxShadow: '0 2px 8px rgba(43,42,36,0.04)',
                        }}
                        whileHover={{ boxShadow: '0 6px 20px rgba(43,42,36,0.08)' }}
                      >
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', gap: 16,
                        }}>
                          {/* Left content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              marginBottom: 10, flexWrap: 'wrap',
                            }}>
                              {activeTab === 'pending' && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(o.id)}
                                  onClick={e => e.stopPropagation()}
                                  onChange={() =>
                                    setSelectedIds(p =>
                                      p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id]
                                    )
                                  }
                                  style={{ width: 15, height: 15, accentColor: olive }}
                                />
                              )}
                              <span style={{
                                color: muted, fontSize: 11, fontFamily: 'monospace', letterSpacing: 0.3,
                              }}>
                                {o.id}
                              </span>
                              <StatusBadge status={st} />
                              {urgent && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                                  background: 'rgba(178,74,60,0.12)', color: '#B24A3C',
                                }}>
                                  <FiZap size={10} style={{ marginRight: 3 }} /> срочно
                                </span>
                              )}
                              {isRepeat && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                                  background: 'rgba(107,123,94,0.12)', color: olive,
                                }}>
                                  <FiStar size={10} style={{ marginRight: 3 }} /> постоянный
                                </span>
                              )}
                            </div>

                            <div style={{
                              display: 'flex', flexWrap: 'wrap', gap: '6px 22px', marginBottom: 8,
                            }}>
                              <span style={{ color: muted, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><FiCalendar size={12} /> {o.date}</span>
                              <span style={{ color: muted, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><FiUsers size={12} /> {o.guests || 0} гостей</span>
                             <span style={{
  color: gold,
  fontWeight: 700,
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}}>
  <FiDollarSign size={13} />
  ${o.total_price_usd}
</span>
                            </div>

                            {(o.client?.name || o.clientName) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: muted, fontSize: 12, display: "inline-flex" }}><FiUser size={12} /></span>
                                <span style={{ color: ink, fontSize: 13, fontWeight: 600 }}>
                                  {o.client?.name || o.clientName}
                                </span>
                                {o.client?.phone && (
                                  <>
                                    <a
                                      href={`tel:${o.client.phone}`}
                                      onClick={e => e.stopPropagation()}
                                      style={{ color: gold, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                                    >
                                      {o.client.phone}
                                    </a>
                                    <button
                                      onClick={e => { e.stopPropagation(); copyPhone(o.client.phone); }}
                                      style={{
                                        background: 'none', border: 'none', color: muted,
                                        cursor: 'pointer', fontSize: 12, display: 'inline-flex',
                                      }}
                                    >
                                      <FiCopy size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {notes[o.id] && (
                              <div style={{ marginTop: 8, fontSize: 12, color: muted }}>
                                {notes[o.id]}
                              </div>
                            )}
                            {o.artist_rejection_reason && (
                              <div style={{
                                marginTop: 10, padding: '8px 12px', borderRadius: 12,
                                background: 'rgba(178,74,60,0.06)', border: '1px solid rgba(178,74,60,0.14)',
                                fontSize: 12, color: '#B24A3C',
                              }}>
                                Причина отказа: {o.artist_rejection_reason}
                              </div>
                            )}
                          </div>

                          {/* Right actions */}
                          {activeTab === 'pending' && (
  <div
    style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}
    onClick={e => e.stopPropagation()}
  >
    <button
      onClick={() => handleAccept(o.id)}
      disabled={actionLoading === o.id + '_accept'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 20px',
        borderRadius: 30,
        border: 'none',
        background: olive,
        color: '#fff',
        fontWeight: 700,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
        opacity: actionLoading === o.id + '_accept' ? 0.6 : 1,
      }}
    >
      {actionLoading === o.id + '_accept' ? '...' : (
        <>
          <FiCheck size={13} />
          Принять
        </>
      )}
    </button>
    <button
      onClick={() => { setRejectModal({ orderId: o.id }); setRejectReason(''); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 20px',
        borderRadius: 30,
        border: '1px solid rgba(178,74,60,0.3)',
        background: 'rgba(178,74,60,0.06)',
        color: '#B24A3C',
        fontWeight: 700,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <FiX size={13} />
      Отказать
    </button>
  </div>
)}
                          {activeTab === 'approved' && st === 'approved' && (
                            <button
                              onClick={e => { e.stopPropagation(); handleComplete(o.id); }}
                              disabled={actionLoading === o.id + '_complete'}
                              style={{
                                padding: '10px 18px', borderRadius: 30,
                                border: 'none',
                                background: olive, color: '#fff',
                                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                flexShrink: 0,
                                fontFamily: "'Poppins', sans-serif",
                                opacity: actionLoading === o.id + '_complete' ? 0.6 : 1,
                              }}
                            >
                              <><FiCheck size={13} style={{ marginRight: 4 }} /> Выполнено</>
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
    pending:   { label: 'Ожидает',     color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
    approved:  { label: 'Принят',      color: '#059669', bg: 'rgba(52,211,153,0.1)' },
    rejected:  { label: 'Отклонён',    color: '#dc2626', bg: 'rgba(239,68,68,0.1)' },
    cancelled: { label: 'Отменён',     color: '#64748b', bg: 'rgba(148,163,184,0.1)' },
    confirmed: { label: 'Подтверждён', color: '#4f46e5', bg: 'rgba(129,140,248,0.1)' },
    completed: { label: 'Выполнен',    color: '#059669', bg: 'rgba(110,231,183,0.1)' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: 20,
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {s.label}
    </span>
  );
}

function DetailRow({ label, val, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <span style={{ color: '#8A8878', fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{
        color: '#2B2A24', fontSize: 13,
        fontFamily: mono ? 'monospace' : 'inherit',
        textAlign: 'right', wordBreak: 'break-all',
      }}>
        {val}
      </span>
    </div>
  );
}
