import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import {
  FiPhone, FiSend, FiCreditCard, FiUsers, FiHome, FiTruck,
  FiMonitor, FiDollarSign, FiAlertTriangle, FiSearch, FiDownload,
  FiRefreshCw, FiEdit2, FiLogOut, FiCheck, FiX, FiCalendar,
  FiCopy, FiFileText, FiStar, FiZap, FiInbox, FiFrown,
  FiMapPin, FiUser, FiMusic,
} from 'react-icons/fi';
import { MdOutlineTableBar, MdOutlineRestaurant, MdOutlineTheaterComedy } from 'react-icons/md';

const API = 'http://localhost:5000';
const USD_RATE = 12700;
const fmtUZS = usd => `~${Math.round(((usd || 0) * USD_RATE) / 1_000_000)} млн сум`;

const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.floor(diff / 86400000);
};

const relTime = (iso) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'только что';
  if (h < 24) return `${h} ч. назад`;
  const d = Math.floor(h / 24);
  return `${d} дн. назад`;
};

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
  { key: 'lat',                 label: 'Широта (lat)',      type: 'number' },
  { key: 'lng',                 label: 'Долгота (lng)',     type: 'number' },
  { key: 'has_led_screen',      label: 'LED экран',         type: 'boolean'},
];

const REJECT_TEMPLATES = ['Дата уже занята', 'Не подходит по вместимости', 'Технические работы в этот день'];

/* ── Design tokens (portfolio mock) ── */
const olive = '#6B7B5E';
const oliveDark = '#5A6950';
const cream = '#F5F2EA';
const ink = '#2B2A24';
const gold = '#B98B4E';
const muted = '#8A8878';
const softBorder = '#EAE6DA';
const white = '#FFFFFF';

/* ── Мини-тост (замена алертам) ────────────────────────────────────────── */
function useLocalToast() {
  const [toasts, setToasts] = useState([]);
  const push = (text, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  };
  const node = (
    <div style={{
      position: 'fixed', top: 80, right: 16, zIndex: 400,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              padding: '10px 16px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              boxShadow: '0 8px 24px rgba(43,42,36,0.12)', border: '1px solid',
              pointerEvents: 'auto',
              background: t.type === 'error' ? 'rgba(178,74,60,0.1)' : 'rgba(107,123,94,0.1)',
              borderColor: t.type === 'error' ? 'rgba(178,74,60,0.3)' : 'rgba(107,123,94,0.3)',
              color: t.type === 'error' ? '#B24A3C' : oliveDark,
              backdropFilter: 'blur(10px)',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, node };
}

/* ── Skeleton loader ───────────────────────────────────────────────────── */
const Skeleton = ({ style }) => (
  <div style={{
    animation: 'pulse 1.5s ease-in-out infinite',
    borderRadius: 16,
    background: 'rgba(43,42,36,0.06)',
    ...style,
  }} />
);

/* ── Статус-степпер для карточки заявки ────────────────────────────────── */
function StatusStepper({ status }) {
  const steps = ['pending', 'approved'];
  const isRejected = status === 'rejected';
  const isCancelled = status === 'cancelled';
  if (isCancelled) {
    return (
      <div style={{
        fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
        display: 'inline-block', background: 'rgba(148,163,184,0.12)', color: '#64748b',
        fontFamily: "'Poppins', sans-serif",
      }}>
        Отменено клиентом
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => {
        const active = isRejected ? i === 0 : steps.indexOf(status) >= i || status === 'approved';
        const isRejectStep = isRejected && i === 1;
        return (
          <React.Fragment key={s}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: isRejectStep ? '#ef4444' : active ? gold : 'rgba(0,0,0,0.12)',
            }} />
            {i === 0 && (
              <div style={{
                width: 20, height: 1, flexShrink: 0,
                background: isRejected ? '#ef4444' : (status === 'approved' ? gold : 'rgba(0,0,0,0.12)'),
              }} />
            )}
          </React.Fragment>
        );
      })}
      <span style={{
        fontSize: 10, marginLeft: 4, fontWeight: 600,
        color: isRejected ? '#dc2626' : status === 'approved' ? '#059669' : '#b45309',
        fontFamily: "'Poppins', sans-serif",
      }}>
        {isRejected ? 'Отклонено' : status === 'approved' ? 'Принято' : 'Ожидает'}
      </span>
    </div>
  );
}

export default function Hall() {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const { user, logout } = useAuth();
  const { theme, cycleTheme, THEMES } = useTheme();
  const toast = useLocalToast();

  const [data,          setData]          = useState(null);
  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  /* Edit state */
  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState({});
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);

  /* Панель владельца */
  const [search, setSearch]           = useState('');
  const [sortBy, setSortBy]           = useState('date_asc');
  const [urgentOnly, setUrgentOnly]   = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSynced, setLastSynced]   = useState(null);
  const [undoAction, setUndoAction]   = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bay_vendor_notes')) || {}; } catch { return {}; }
  });
  const undoTimerRef = useRef(null);
  const searchRef = useRef(null);

  const isOwner = user?.role === 'hall' && String(user?.id) === String(id);

  const myStatusOf = (o) => {
    if (o.status === 'cancelled') return 'cancelled';
    if (o.status === 'completed' && o.restaurant_status === 'approved') return 'completed';
    if (o.restaurant_status) return o.restaurant_status;
    return 'pending';
  };

  const fetchData = () => {
    fetch(`${API}/restaurants/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setEditForm(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(`${API}/wedding_orders`)
      .then(r => r.json())
      .then(list => { setOrders(list.filter(o => String(o.restaurant?.id) === String(id))); setLastSynced(new Date()); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pendingOrders  = orders.filter(o => myStatusOf(o) === 'pending');
  const approvedOrders = orders.filter(o => myStatusOf(o) === 'approved');
  const rejectedOrders = orders.filter(o => ['rejected', 'cancelled'].includes(myStatusOf(o)));
  const revenue = approvedOrders.reduce((s, o) => s + (o.total_price_usd || 0), 0);

  const now = new Date();
  const thisMonthRevenue = approvedOrders.filter(o => {
    const d = new Date(o.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, o) => s + (o.total_price_usd || 0), 0);
  const lastMonthRevenue = approvedOrders.filter(o => {
    const d = new Date(o.date); const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }).reduce((s, o) => s + (o.total_price_usd || 0), 0);
  const revenueTrend = lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null;

  const clientCounts = orders.reduce((acc, o) => { const k = o.client?.name || o.clientName || '—'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const dateCounts = orders.reduce((acc, o) => { if (['pending', 'approved'].includes(myStatusOf(o))) acc[o.date] = (acc[o.date] || 0) + 1; return acc; }, {});
  const conflictDates = Object.entries(dateCounts).filter(([, c]) => c > 1).map(([d]) => d);
  const urgentPending = pendingOrders.filter(o => Number.isFinite(daysUntil(o.date)) && daysUntil(o.date) <= 5 && daysUntil(o.date) >= 0);

  const currentThemeInfo = THEMES.find(t => t.key === theme) || THEMES[0];

  const filteredOrders = useMemo(() => {
    let list = orders.filter(o => {
      if (urgentOnly && !(Number.isFinite(daysUntil(o.date)) && daysUntil(o.date) <= 5 && daysUntil(o.date) >= 0 && myStatusOf(o) === 'pending')) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (o.client?.name || o.clientName || '').toLowerCase().includes(q) || (o.date || '').includes(q) || (o.id || '').toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'date_asc')  return new Date(a.date) - new Date(b.date);
      if (sortBy === 'date_desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'amount_desc') return (b.total_price_usd || 0) - (a.total_price_usd || 0);
      if (sortBy === 'urgent') return daysUntil(a.date) - daysUntil(b.date);
      return 0;
    });
    return list;
  }, [orders, search, sortBy, urgentOnly]);

  const deriveAggregate = (o, value) => {
    const rStatus = value;
    const aStatus = o.artist_status || ((o.artists || []).length ? 'pending' : null);
    const parts = [rStatus, aStatus].filter(Boolean);
    if (parts.includes('rejected')) return 'rejected';
    if (parts.every(p => p === 'approved')) return 'approved';
    return 'pending';
  };

  const patchOrder = (orderId, patch) => fetch(`${API}/wedding_orders/${orderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });

  const armUndo = (orderId, prevValue, prevReason) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAction({ orderId, prevValue, prevReason });
    undoTimerRef.current = setTimeout(() => setUndoAction(null), 6000);
  };

  const handleAccept = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setActionLoading(orderId + '_accept');
    try {
      const backfillArtist = order.artists?.length ? (order.artist_status || 'pending') : (order.artist_status ?? null);
      const res = await patchOrder(orderId, {
        restaurant_status: 'approved',
        restaurant_rejection_reason: null,
        artist_status: backfillArtist,
        status: deriveAggregate({ ...order, artist_status: backfillArtist }, 'approved'),
      });
      if (res.ok) {
        armUndo(orderId, myStatusOf(order), order.restaurant_rejection_reason || null);
        toast.push('Заявка принята');
        fetchData();
      }
    } catch { toast.push('Ошибка при сохранении', 'error'); }
    setActionLoading(null);
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim() || !rejectModal) return;
    const order = orders.find(o => o.id === rejectModal.orderId);
    if (!order) return;
    setActionLoading(rejectModal.orderId + '_reject');
    try {
      const backfillArtist = order.artists?.length ? (order.artist_status || 'pending') : (order.artist_status ?? null);
      const res = await patchOrder(rejectModal.orderId, {
        restaurant_status: 'rejected',
        restaurant_rejection_reason: rejectReason,
        artist_status: backfillArtist,
        status: deriveAggregate({ ...order, artist_status: backfillArtist }, 'rejected'),
      });
      if (res.ok) {
        armUndo(rejectModal.orderId, myStatusOf(order), order.restaurant_rejection_reason || null);
        setRejectModal(null); setRejectReason('');
        toast.push('Заявка отклонена');
        fetchData();
      }
    } catch { toast.push('Ошибка при сохранении', 'error'); }
    setActionLoading(null);
  };

  const handleUndo = async () => {
    if (!undoAction) return;
    const order = orders.find(o => o.id === undoAction.orderId);
    try {
      await patchOrder(undoAction.orderId, {
        restaurant_status: undoAction.prevValue,
        restaurant_rejection_reason: undoAction.prevReason,
        status: order ? deriveAggregate(order, undoAction.prevValue) : 'pending',
      });
      setUndoAction(null);
      toast.push('Действие отменено');
      fetchData();
    } catch {}
  };

  const bulkApprove = async () => {
    for (const orderId of selectedIds) await handleAccept(orderId);
    setSelectedIds([]);
    setBulkConfirm(false);
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
        toast.push('Профиль сохранён');
        setTimeout(() => { setSaveOk(false); setEditOpen(false); }, 1500);
      }
    } catch { toast.push('Ошибка сохранения', 'error'); }
    setSaving(false);
  };

  const saveNote = (orderId, text) => {
    setNotes(prev => {
      const next = { ...prev, [orderId]: text };
      localStorage.setItem('bay_vendor_notes', JSON.stringify(next));
      return next;
    });
  };

  const copyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    toast.push('Телефон скопирован');
  };

  const copyOrderId = (orderId) => {
    navigator.clipboard?.writeText(orderId);
    toast.push('ID заявки скопирован');
  };

  const exportCSV = () => {
    const rows = [['ID', 'Дата', 'Клиент', 'Телефон', 'Гостей', 'Сумма USD', 'Статус']];
    filteredOrders.forEach(o => rows.push([o.id, o.date, o.client?.name || o.clientName || '', o.client?.phone || '', o.guests || 0, o.total_price_usd || 0, myStatusOf(o)]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `hall-orders-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.push('CSV скачан');
  };

  const exportOrderPDF = (o) => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('BAYRAMLY — Заявка на зал', 20, 20);
    doc.setFontSize(11);
    doc.text(`Заявка: ${o.id}`, 20, 34);
    doc.text(`Зал: ${data?.name || ''}`, 20, 42);
    doc.text(`Статус: ${myStatusOf(o)}`, 20, 50);
    doc.text(`Дата тоя: ${o.date}`, 20, 58);
    doc.text(`Гостей: ${o.guests || 0}`, 20, 66);
    doc.text(`Клиент: ${o.client?.name || o.clientName || '—'}`, 20, 74);
    doc.text(`Телефон: ${o.client?.phone || '—'}`, 20, 82);
    doc.text(`Сумма: $${o.total_price_usd || 0}`, 20, 90);
    doc.save(`hall-order-${o.id}.pdf`);
    toast.push('PDF заявки скачан');
  };

  /* Shared style helpers */
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

  /* ── Loading ── */
  if (loading) return (
    <div style={{
      minHeight: '100vh', background: cream,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '96px 16px 40px', maxWidth: 1200, margin: '0 auto',
    }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <Skeleton style={{ height: 200, width: '100%', marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, width: '100%', marginBottom: 24 }}>
        {[1,2,3,4].map(i => <Skeleton key={i} style={{ height: 64 }} />)}
      </div>
      <Skeleton style={{ height: 160, width: '100%', marginBottom: 12 }} />
      <Skeleton style={{ height: 160, width: '100%' }} />
    </div>
  );

  if (!data) return (
    <div style={{
      minHeight: '100vh', background: cream,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', color: muted,
    }}>
      <div>
        <div style={{ fontSize: 48, marginBottom: 16, color: muted, display: "flex", justifyContent: "center" }}><FiFrown /></div>
        <p>Зал не найден</p>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: cream,
      fontFamily: "'Poppins', sans-serif",
      color: ink,
    }}>
      {toast.node}

      {/* ── NAVBAR (owner) ── */}
      {isOwner ? (
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: 64,
          background: 'rgba(245,242,234,0.92)',
          borderBottom: `1px solid ${softBorder}`,
          backdropFilter: 'blur(16px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 900, fontSize: 14,
              background: `linear-gradient(135deg, ${gold}, ${olive})`,
            }}>
              B
            </div>
            <span style={{ fontWeight: 800, letterSpacing: 1, fontSize: 13, color: ink }}>
              BAYRAMLY<span style={{ color: gold }}>.ai</span>
              <span style={{ color: muted, fontWeight: 500 }}> · Кабинет зала</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, color: muted, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }}
              />
              {lastSynced ? `Синхр. ${lastSynced.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : '—'}
            </span>
            <button
              onClick={fetchData}
              style={{
                width: 36, height: 36, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: white, border: `1px solid ${softBorder}`, color: muted, cursor: 'pointer', fontSize: 14,
              }}
            >
              <FiRefreshCw size={15} color="#8A8878" />
            </button>
            <button
              onClick={cycleTheme}
              title={`Тема: ${currentThemeInfo.label}`}
              style={{
                width: 36, height: 36, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: white, border: `1px solid ${softBorder}`, cursor: 'pointer',
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'block', background: currentThemeInfo.swatch }} />
            </button>
            <button
              onClick={() => setEditOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 30,
                background: 'rgba(185,139,78,0.1)', border: '1px solid rgba(185,139,78,0.25)',
                color: gold, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <FiEdit2 size={13} style={{ marginRight: 4 }} /> Редактировать
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 30,
                background: 'rgba(178,74,60,0.08)', border: '1px solid rgba(178,74,60,0.2)',
                color: '#B24A3C', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Выйти →
            </button>
          </div>
        </nav>
      ) : (
        <div style={{ height: 64 }} />
      )}

      {/* Undo snackbar */}
      <AnimatePresence>
        {undoAction && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 150,
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 24px', borderRadius: 30,
              background: ink, color: '#fff',
              boxShadow: '0 12px 40px rgba(43,42,36,0.25)',
            }}
          >
            <span style={{ fontSize: 13 }}>Статус заявки изменён</span>
            <button
              onClick={handleUndo}
              style={{ background: 'none', border: 'none', color: gold, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              ↩ Отменить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject reason modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              background: 'rgba(43,42,36,0.45)', backdropFilter: 'blur(12px)',
            }}
            onClick={() => { setRejectModal(null); setRejectReason(''); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              style={{
                width: '100%', maxWidth: 400,
                background: white, border: `1px solid ${softBorder}`,
                borderRadius: 24, padding: 28,
                boxShadow: '0 24px 60px rgba(43,42,36,0.12)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{
                fontSize: 20, fontWeight: 700, margin: '0 0 6px', textAlign: 'center',
                color: '#B24A3C', fontFamily: "'Playfair Display', Georgia, serif",
              }}>
                Отклонить заявку
              </h3>
              <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 16, color: muted }}>
                Клиент получит уведомление с причиной
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
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
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Причина отказа..."
                style={{ ...inputStyle, resize: 'none', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  style={{ ...btnGhost, flex: 1, padding: '12px 0' }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim()}
                  style={{
                    ...btnPrimary, flex: 1, padding: '12px 0',
                    background: rejectReason.trim() ? '#B24A3C' : '#D4A5A0',
                    cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                    opacity: rejectReason.trim() ? 1 : 0.6,
                  }}
                >
                  Отклонить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk confirm modal */}
      <AnimatePresence>
        {bulkConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              background: 'rgba(43,42,36,0.45)', backdropFilter: 'blur(12px)',
            }}
            onClick={() => setBulkConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92 }} animate={{ scale: 1 }}
              style={{
                width: '100%', maxWidth: 380,
                background: white, border: `1px solid ${softBorder}`,
                borderRadius: 24, padding: 28, textAlign: 'center',
                boxShadow: '0 24px 60px rgba(43,42,36,0.12)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: 32, marginBottom: 12, color: olive, display: "flex", justifyContent: "center" }}><FiCheck size={36} /></div>
              <h3 style={{
                fontWeight: 700, fontSize: 18, margin: '0 0 8px', color: ink,
                fontFamily: "'Playfair Display', Georgia, serif",
              }}>
                Принять {selectedIds.length} заявок?
              </h3>
              <p style={{ fontSize: 13, marginBottom: 20, color: muted }}>
                Это действие подтвердит все выбранные заявки сразу.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setBulkConfirm(false)} style={{ ...btnGhost, flex: 1, padding: '12px 0' }}>
                  Отмена
                </button>
                <button onClick={bulkApprove} style={{ ...btnOlive, flex: 1, padding: '12px 0' }}>
                  Принять все
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════ MAIN ══════════════ */}
      <div style={{ paddingTop: isOwner ? 64 : 0 }}>

        {/* ── HERO ── */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 48,
          alignItems: 'center',
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 40px 48px',
        }}>
          {/* Left text */}
          <div>
            <p style={{
              fontFamily: "'Dancing Script', cursive",
              fontSize: 24, color: gold, margin: 0, lineHeight: 1,
            }}>
              {data.district || 'Зал'}
            </p>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 52, lineHeight: 1.05, margin: '6px 0 14px',
              color: gold, fontWeight: 700,
            }}>
              {data.name}
            </h1>
            <p style={{
              letterSpacing: 2, fontSize: 13, color: olive,
              fontWeight: 600, marginBottom: 10, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center',
            }}>
              <FiMapPin size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> {data.address || data.district}
            </p>
            <p style={{
              maxWidth: 380, fontSize: 14, color: muted, lineHeight: 1.6, marginBottom: 28,
            }}>
              Вместимость до {data.max_capacity_people || '—'} гостей · {data.kitchen_type || 'Кухня'} · {data.stage_size || 'Сцена'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{
                ...btnPrimary,
                background: olive,
                padding: '14px 28px',
              }}>
                ~{Math.round((data.price_per_day_uzs || 0) / 1e6)} млн
                <span style={{ opacity: 0.75, fontWeight: 400, fontSize: 12 }}>/ день</span>
              </div>
            </div>
          </div>

          {/* Right portrait */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: olive,
              borderRadius: '220px 220px 20px 20px',
              height: 400,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
            }}>
              <img
                src={data.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'}
                alt={data.name}
                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'; }}
                style={{
                  width: '88%', height: '92%',
                  borderRadius: '200px 200px 0 0',
                  objectFit: 'cover',
                }}
              />
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section style={{
  maxWidth: 1200, margin: '0 auto 56px',
  padding: '0 40px',
}}>
  <div style={{
    background: olive,
    borderRadius: 20,
    padding: '28px 48px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
  }}>
    {[
      { v: `${data.max_capacity_people || '—'}`, l: 'вместимость' },
      { v: `${data.seating_capacity || '—'}`, l: 'мест за столами' },
      { v: data.kitchen_type || '—', l: 'кухня' },
      { v: data.has_led_screen ? 'Есть' : 'Нет', l: 'LED экран' },
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
  </div>
</section>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 80px' }}>

          {/* ── INFO CARDS ── */}
       <section style={{ marginBottom: 48 }}>
  <div style={{ marginBottom: 24 }}>
    <p style={sectionLabel}>DETAILS</p>
    <h2 style={{
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: 28, color: gold, margin: 0,
    }}>
      О зале
    </h2>
  </div>
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
  }}>
    {[
      { Icon: FiUsers, label: 'Вместимость',    val: `${data.max_capacity_people || '—'} чел.` },
      { Icon: MdOutlineTableBar, label: 'Мест за столами', val: `${data.seating_capacity || '—'} чел.` },
      { Icon: MdOutlineRestaurant, label: 'Официанты',      val: `${data.waiters_count || '—'} чел.` },
      { Icon: MdOutlineTheaterComedy, label: 'Сцена',           val: data.stage_size || '—' },
      { Icon: FiTruck, label: 'Парковка',        val: `${data.parking_spaces || '—'} мест` },
      { Icon: MdOutlineRestaurant, label: 'Кухня',           val: data.kitchen_type || '—' },
      { Icon: FiMonitor, label: 'LED экран',       val: data.has_led_screen ? 'Есть' : 'Нет' },
      { Icon: FiDollarSign, label: 'Цена/день',       val: `~${Math.round((data.price_per_day_uzs || 0) / 1e6)} млн` },
    ].map(({ Icon, label, val }) => (
      <motion.div
        whileHover={{ y: -3 }}
        key={label}
        style={{
          ...card, padding: '18px 14px', textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
          <Icon size={22} color={olive} />
        </div>
        <div style={{ fontSize: 11, color: muted, marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 13, color: ink }}>{val}</div>
      </motion.div>
    ))}
  </div>
</section>

          {/* ── PROFILE INFO (contacts) ── */}
          {(data.phone || data.telegram || data.payment_card) && (
            <section style={{ marginBottom: 48 }}>
              <div style={{ marginBottom: 24 }}>
                <p style={sectionLabel}>SELECTED</p>
                <h2 style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 28, color: gold, margin: 0,
                }}>
                  Profile info
                </h2>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
              }}>
                {data.phone && (
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
                        href={`tel:${data.phone}`}
                        style={{
                          color: gold, fontWeight: 700, fontSize: 15,
                          textDecoration: 'none', fontFamily: "'Playfair Display', Georgia, serif",
                        }}
                      >
                        {data.phone}
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
                        Карта оплаты
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

          {/* ═══ OWNER PANEL ═══ */}
          {isOwner && (
            <div style={{ borderTop: `1px solid ${softBorder}`, paddingTop: 40 }}>

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
                    <span style={{ flexShrink: 0, display: "flex" }}><FiAlertTriangle size={22} color="#B24A3C" /></span>
                    <div style={{ fontSize: 13, color: '#B24A3C', flex: 1 }}>
                      <strong>{urgentPending.length}</strong>{' '}
                      {urgentPending.length === 1 ? 'заявка' : 'заявки'} с датой тоя меньше 5 дней ждут ответа.
                    </div>
                    <button
                      onClick={() => setUrgentOnly(true)}
                      style={{
                        fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 20,
                        background: 'rgba(178,74,60,0.12)', color: '#B24A3C', border: 'none',
                        cursor: 'pointer', flexShrink: 0, fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      Показать
                    </button>
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
                  <span style={{ flexShrink: 0, display: "flex" }}><FiAlertTriangle size={18} color="#8A6A34" /></span>
                  <div style={{ fontSize: 12, color: '#8A6A34' }}>
                    Несколько активных заявок на дату(ы): <strong>{conflictDates.join(', ')}</strong> — проверьте двойное бронирование.
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
                    { t: String(orders.length), d: 'все заявки' },
                    { t: String(pendingOrders.length), d: 'ждут' },
                    { t: String(approvedOrders.length), d: 'принято' },
                    { t: `$${thisMonthRevenue}`, d: 'доход / мес', trend: revenueTrend },
                  ].map((p) => (
                    <motion.div
                      whileHover={{ y: -3 }}
                      key={p.d}
                      style={{ ...card, padding: '22px 16px', textAlign: 'center' }}
                    >
                      <p style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: 28, margin: '0 0 4px', color: gold, fontWeight: 700,
                      }}>
                        {p.t}
                        {p.trend !== undefined && p.trend !== null && (
                          <span style={{
                            fontSize: 12, fontWeight: 700, marginLeft: 6,
                            color: p.trend >= 0 ? '#34d399' : '#f87171',
                            fontFamily: "'Poppins', sans-serif",
                          }}>
                            {p.trend >= 0 ? '↑' : '↓'}{Math.abs(p.trend)}%
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: 12, color: muted, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>
                        {p.d}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: muted, marginTop: 16 }}>
                  Доход всего:{' '}
                  <strong style={{ color: gold }}>${revenue}</strong> ({fmtUZS(revenue)})
                </div>
              </section>

              {/* ── TOOLBAR ── */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'center',
              }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск клиента/даты/ID... ( / )"
                    style={{
                      width: '100%',
                      background: white, border: `1px solid ${softBorder}`,
                      borderRadius: 30, padding: '10px 18px',
                      color: ink, fontSize: 13, outline: 'none',
                      fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  onClick={() => setUrgentOnly(p => !p)}
                  style={{
                    padding: '10px 18px', borderRadius: 30,
                    fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    background: urgentOnly ? 'rgba(178,74,60,0.1)' : white,
                    border: urgentOnly ? '1px solid rgba(178,74,60,0.3)' : `1px solid ${softBorder}`,
                    color: urgentOnly ? '#B24A3C' : muted,
                  }}
                >
                  Только срочные
                </button>
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
                  <option value="urgent">По срочности</option>
                </select>
                <button
                  onClick={exportCSV}
                  style={{
                    padding: '10px 18px', borderRadius: 30,
                    background: white, border: `1px solid ${softBorder}`,
                    color: muted, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  <FiDownload size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> CSV
                </button>
              </div>

              {/* Bulk select bar */}
              <AnimatePresence>
                {selectedIds.length > 0 && (
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
                        onClick={() => setBulkConfirm(true)}
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

              {/* Orders list */}
              {filteredOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: muted, fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8, color: muted, display: "flex", justifyContent: "center" }}><FiInbox size={36} /></div>
                  {search || urgentOnly ? 'Ничего не найдено' : 'Заявок пока нет'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredOrders.map(o => (
                    <HallOrderCard
                      key={o.id}
                      order={o}
                      status={myStatusOf(o)}
                      urgent={myStatusOf(o) === 'pending' && Number.isFinite(daysUntil(o.date)) && daysUntil(o.date) <= 5 && daysUntil(o.date) >= 0}
                      isRepeat={(clientCounts[o.client?.name || o.clientName] || 0) > 1}
                      repeatCount={clientCounts[o.client?.name || o.clientName] || 0}
                      note={notes[o.id] || ''}
                      onNoteChange={(v) => saveNote(o.id, v)}
                      onCopyPhone={copyPhone}
                      onCopyId={() => copyOrderId(o.id)}
                      onExportPDF={() => exportOrderPDF(o)}
                      selected={selectedIds.includes(o.id)}
                      onToggleSelect={() => setSelectedIds(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])}
                      onAccept={() => handleAccept(o.id)}
                      onReject={() => { setRejectModal({ orderId: o.id }); setRejectReason(''); }}
                      acceptLoading={actionLoading === o.id + '_accept'}
                      rejectLoading={actionLoading === o.id + '_reject'}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              background: 'rgba(43,42,36,0.45)', backdropFilter: 'blur(12px)',
            }}
            onClick={() => setEditOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              style={{
                width: '100%', maxWidth: 500, maxHeight: '85vh',
                display: 'flex', flexDirection: 'column',
                background: white, border: `1px solid ${softBorder}`,
                borderRadius: 24, overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(43,42,36,0.12)',
              }}
              onClick={e => e.stopPropagation()}
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
                  onClick={() => setEditOpen(false)}
                  style={{
                    background: cream, border: 'none', color: muted,
                    width: 34, height: 34, borderRadius: 12, cursor: 'pointer', fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {EDITABLE_FIELDS.map(({ key, label, type }) => (
                  <div key={key}>
                    <label style={{
                      display: 'block', color: muted, fontSize: 11,
                      letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
                    }}>
                      {label}
                    </label>
                    {type === 'boolean' ? (
                      <button
                        onClick={() => setEditForm(p => ({ ...p, [key]: !p[key] }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px', borderRadius: 14, width: '100%',
                          textAlign: 'left', cursor: 'pointer',
                          background: editForm[key] ? 'rgba(107,123,94,0.1)' : cream,
                          border: `1px solid ${editForm[key] ? 'rgba(107,123,94,0.3)' : softBorder}`,
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        <div style={{
                          width: 40, height: 22, borderRadius: 20, position: 'relative',
                          background: editForm[key] ? olive : 'rgba(0,0,0,0.12)',
                          transition: 'background 0.2s',
                        }}>
                          <div style={{
                            position: 'absolute', top: 2,
                            left: editForm[key] ? 20 : 2,
                            width: 18, height: 18, borderRadius: '50%',
                            background: '#fff', transition: 'left 0.2s',
                          }} />
                        </div>
                        <span style={{
                          fontSize: 13, fontWeight: 600,
                          color: editForm[key] ? oliveDark : muted,
                        }}>
                          {editForm[key] ? 'Есть' : 'Нет'}
                        </span>
                      </button>
                    ) : (
                      <input
                        type={type}
                        value={editForm[key] ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? +e.target.value : e.target.value }))}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}

                {editForm.image_url && (
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${softBorder}` }}>
                    <img
                      src={editForm.image_url}
                      alt="preview"
                      style={{ width: '100%', height: 128, objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <p style={{ fontSize: 11, color: muted, margin: 0 }}>
                  Широта/долгота используются для отображения зала на карте в разделе «Карта» на главной странице — обновите их, если зал переехал.
                </p>
              </div>

              <div style={{
                padding: '16px 24px', borderTop: `1px solid ${softBorder}`,
                display: 'flex', gap: 12,
              }}>
                <button onClick={() => setEditOpen(false)} style={{ ...btnGhost, flex: 1, padding: '12px 0' }}>
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    ...btnPrimary, flex: 1, padding: '12px 0',
                    background: saveOk ? olive : ink,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Сохраняем...' : saveOk ? (<><FiCheck size={13} style={{ marginRight: 4 }} /> Сохранено!</>) : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── HallOrderCard ─── */
function HallOrderCard({
  order: o, status, urgent, isRepeat, repeatCount,
  note, onNoteChange, onCopyPhone, onCopyId, onExportPDF,
  selected, onToggleSelect, onAccept, onReject, acceptLoading, rejectLoading,
}) {
  const showActions = status === 'pending';
  const [showNote, setShowNote] = useState(false);
  const initials = (o.client?.name || o.clientName || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: white,
        border: `1px solid ${urgent ? 'rgba(178,74,60,0.35)' : softBorder}`,
        borderRadius: 20,
        padding: '18px 22px',
        boxShadow: '0 2px 8px rgba(43,42,36,0.04)',
        transition: 'box-shadow 0.2s',
      }}
      whileHover={{ boxShadow: '0 6px 20px rgba(43,42,36,0.08)' }}
    >
      <div style={{
        display: 'flex', flexWrap: 'wrap',
        justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
      }}>
        <div style={{ display: 'flex', gap: 14, flex: 1, minWidth: 0 }}>
          {showActions && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              style={{ width: 15, height: 15, marginTop: 6, flexShrink: 0, accentColor: olive }}
            />
          )}
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
            background: 'rgba(185,139,78,0.12)', color: gold,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button
                onClick={onCopyId}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: 500, fontSize: 11, color: muted, fontFamily: 'monospace',
                  padding: 0,
                }}
                title="Скопировать ID"
              >
                ID: {o.id?.slice(-10)}
              </button>
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
                }} title={`${repeatCount} заявок от этого клиента`}>
                  <FiStar size={10} style={{ marginRight: 3 }} /> x{repeatCount}
                </span>
              )}
            </div>

            <StatusStepper status={status} />

            <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>
              <FiCalendar size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> {o.date} &nbsp;·&nbsp; <FiUsers size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> {o.guests || 0} гостей
            </div>

            {(o.client || o.clientName) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: muted }}>Клиент:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: ink }}>
                  {o.client?.name || o.clientName}
                </span>
                {(o.client?.phone || o.clientPhone) && (
                  <>
                    <a
                      href={`tel:${o.client?.phone || o.clientPhone}`}
                      style={{ fontSize: 12, fontWeight: 700, color: gold, textDecoration: 'none' }}
                    >
                      {o.client?.phone || o.clientPhone}
                    </a>
                    <button
                      onClick={() => onCopyPhone(o.client?.phone || o.clientPhone)}
                      style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 12 }}
                    >
                      <FiCopy size={12} />
                    </button>
                  </>
                )}
              </div>
            )}

            {o.artists?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 12, color: muted }}>Артисты:</span>
                {o.artists.map(a => (
                  <span key={a.id} style={{ fontSize: 12, color: ink }}>
                    {a.name}
                    {a.phone && (
                      <a href={`tel:${a.phone}`} style={{ marginLeft: 4, color: gold, textDecoration: 'none' }}>
                        {a.phone}
                      </a>
                    )}
                  </span>
                ))}
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 15, color: gold, marginTop: 8 }}>
              ${o.total_price_usd}{' '}
              <span style={{ fontWeight: 400, fontSize: 12, color: muted }}>
                ({fmtUZS(o.total_price_usd)})
              </span>
            </div>

            {status === 'rejected' && o.restaurant_rejection_reason && (
              <div style={{
                fontSize: 12, padding: '8px 12px', borderRadius: 12, marginTop: 8,
                background: 'rgba(178,74,60,0.06)', color: '#B24A3C',
              }}>
                Причина: {o.restaurant_rejection_reason}
              </div>
            )}
            {status === 'cancelled' && o.cancellation_reason && (
              <div style={{
                fontSize: 12, padding: '8px 12px', borderRadius: 12, marginTop: 8,
                background: 'rgba(148,163,184,0.08)', color: '#64748b',
              }}>
                Клиент отменил: {o.cancellation_reason}
              </div>
            )}
            {o.payment && (
              <div style={{
                fontSize: 11, padding: '6px 10px', borderRadius: 12, marginTop: 8,
                display: 'inline-block',
                background: 'rgba(139,111,170,0.08)', color: '#8B6FAA',
              }}>
                <FiCreditCard size={11} style={{ marginRight: 4, verticalAlign: "middle" }} /> Оплачено: ${o.payment.amount_usd} ({o.payment.method === 'card' ? 'картой' : 'наличные'})
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
              <button
                onClick={() => setShowNote(p => !p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: muted, padding: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {note ? note : '+ добавить заметку'}
              </button>
              <button
                onClick={onExportPDF}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: muted, padding: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <FiFileText size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> PDF заявки
              </button>
            </div>
            {showNote && (
              <textarea
                rows={2}
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                placeholder="Заметка видна только вам..."
                style={{
                  width: '100%', marginTop: 8, padding: '8px 12px',
                  borderRadius: 12, fontSize: 12, outline: 'none', resize: 'none',
                  background: cream, border: `1px solid ${softBorder}`, color: ink,
                  boxSizing: 'border-box', fontFamily: "'Poppins', sans-serif",
                }}
              />
            )}
          </div>
        </div>

        {showActions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onAccept}
              disabled={acceptLoading || rejectLoading}
              style={{
                padding: '10px 20px', borderRadius: 30, border: 'none',
                background: olive, color: '#fff',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                opacity: (acceptLoading || rejectLoading) ? 0.5 : 1,
              }}
            >
              {acceptLoading ? '...' : (<><FiCheck size={13} style={{ marginRight: 4 }} /> Принять</>)}
            </button>
            <button
              onClick={onReject}
              disabled={acceptLoading || rejectLoading}
              style={{
                padding: '10px 20px', borderRadius: 30,
                border: '1px solid rgba(178,74,60,0.3)',
                background: 'rgba(178,74,60,0.06)', color: '#B24A3C',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                opacity: (acceptLoading || rejectLoading) ? 0.5 : 1,
              }}
            >
              {rejectLoading ? '...' : (<><FiX size={13} style={{ marginRight: 4 }} /> Отказать</>)}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
