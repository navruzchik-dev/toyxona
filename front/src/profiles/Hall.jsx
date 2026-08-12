import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';

const API = 'http://localhost:5000';
const USD_RATE = 12700;
const fmtUZS = usd => `~${Math.round(((usd || 0) * USD_RATE) / 1_000_000)} млн сум`;

const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.floor(diff / 86400000);
};

// Относительное время создания заявки (сколько прошло с даты события в прошлом
// нет смысла — используем дату создания заказа, если она есть, иначе не показываем)
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

/* ── Мини-тост (замена алертам) ────────────────────────────────────────── */
function useLocalToast() {
  const [toasts, setToasts] = useState([]);
  const push = (text, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  };
  const node = (
    <div className="fixed top-20 right-4 z-[400] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl border pointer-events-auto"
            style={{
              background: t.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              borderColor: t.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
              color: t.type === 'error' ? '#dc2626' : '#059669',
              backdropFilter: 'blur(10px)',
            }}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, node };
}

/* ── Skeleton loader ───────────────────────────────────────────────────── */
const Skeleton = ({ className }) => (
  <div className={`animate-pulse rounded-xl ${className}`} style={{ background: 'rgba(0,0,0,0.06)' }} />
);

/* ── Статус-степпер для карточки заявки ────────────────────────────────── */
function StatusStepper({ status }) {
  const steps = ['pending', 'approved'];
  const isRejected = status === 'rejected';
  const isCancelled = status === 'cancelled';
  if (isCancelled) {
    return <div className="text-[10px] font-bold px-2 py-1 rounded-full inline-block" style={{ background: 'rgba(148,163,184,0.12)', color: '#64748b' }}>Отменено клиентом</div>;
  }
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => {
        const active = isRejected ? i === 0 : steps.indexOf(status) >= i || status === 'approved';
        const isRejectStep = isRejected && i === 1;
        return (
          <React.Fragment key={s}>
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: isRejectStep ? '#ef4444' : active ? 'var(--gold)' : 'rgba(0,0,0,0.12)' }} />
            {i === 0 && <div className="w-5 h-px flex-shrink-0" style={{ background: isRejected ? '#ef4444' : (status === 'approved' ? 'var(--gold)' : 'rgba(0,0,0,0.12)') }} />}
          </React.Fragment>
        );
      })}
      <span className="text-[10px] ml-1" style={{ color: isRejected ? '#dc2626' : status === 'approved' ? '#059669' : '#b45309' }}>
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
  const [rejectModal, setRejectModal] = useState(null); // { orderId }
  const [rejectReason, setRejectReason] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bay_vendor_notes')) || {}; } catch { return {}; }
  });
  const undoTimerRef = useRef(null);
  const searchRef = useRef(null);

  const isOwner = user?.role === 'hall' && String(user?.id) === String(id);

  // Статус этого зала внутри заказа — раздельно от артиста (restaurant_status).
  // Терминальные общие статусы (cancelled/completed) всегда побеждают,
  // иначе используем собственное поле, а если его ещё нет — 'pending'
  // (НИКОГДА не наследуем общий o.status, чтобы не "заражаться" отказом/
  // подтверждением другой стороны заказа — это и был главный баг).
  const myStatusOf = (o) => {
    // Только статус зала. Общий o.status НЕ используем для pending/approved/rejected.
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

  // "/" — быстрый фокус на поиск
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

  // aStatus по артисту: НЕ используем o.status как запасной вариант —
  // только собственное поле артиста или 'pending', если артист вообще есть в заказе.
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
      // Бэкфилл artist_status, если в заказе есть артист, но поле ещё не
      // выставлено — чтобы дальше у обеих сторон всегда были явные,
      // независимые статусы (это и чинит "заражение" статусами друг друга).
      const backfillArtist = order.artists?.length ? (order.artist_status || 'pending') : (order.artist_status ?? null);
      const res = await patchOrder(orderId, {
        restaurant_status: 'approved',
        restaurant_rejection_reason: null,
        artist_status: backfillArtist,
        status: deriveAggregate({ ...order, artist_status: backfillArtist }, 'approved'),
      });
      if (res.ok) {
        armUndo(orderId, myStatusOf(order), order.restaurant_rejection_reason || null);
        toast.push('Заявка принята ✓');
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
        toast.push('Профиль сохранён ✓');
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

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen px-4 pt-24 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>
      <Skeleton className="h-48 w-full mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
      </div>
      <Skeleton className="h-40 w-full mb-3" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
  if (!data) return (
    <div className="min-h-screen flex items-center justify-center text-center" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>
      <div><div className="text-5xl mb-4">😕</div><p>Зал не найден</p></div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {toast.node}

      {/* ── NAVBAR ── */}
      {isOwner ? (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 h-16"
          style={{ background: 'color-mix(in srgb, var(--bg2) 92%, transparent)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, black))' }}>B</div>
            <span className="font-black tracking-wider text-sm hidden sm:inline" style={{ color: 'var(--text)' }}>
              BAYRAMLY<span style={{ color: 'var(--gold)' }}>.ai</span> · Кабинет зала
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] hidden md:flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {lastSynced ? `Синхр. ${lastSynced.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : '—'}
            </span>
            <button onClick={fetchData} className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-transform active:rotate-180"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)' }}>↻</button>
            <button onClick={cycleTheme} title={`Тема: ${currentThemeInfo.label}`}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <span className="w-4 h-4 rounded-full block" style={{ background: currentThemeInfo.swatch }} />
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(var(--gold-rgb,201,168,76),0.1)', border: '1px solid rgba(var(--gold-rgb,201,168,76),0.25)', color: 'var(--gold, #C9A84C)' }}>
              ✏️ <span className="hidden sm:inline">Редактировать</span>
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }}>
              Выйти →
            </button>
          </div>
        </nav>
      ) : (
        <div className="h-16" />
      )}

      {/* Undo snackbar */}
      <AnimatePresence>
        {undoAction && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <span className="text-sm" style={{ color: 'var(--text)' }}>Статус заявки изменён</span>
            <button onClick={handleUndo} className="text-sm font-bold" style={{ color: 'var(--gold)' }}>↩ Отменить</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject reason modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(30,24,16,0.45)', backdropFilter: 'blur(12px)' }}
            onClick={() => { setRejectModal(null); setRejectReason(''); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-7 border" onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg2)', borderColor: 'rgba(239,68,68,0.35)' }}>
              <h3 className="text-lg font-black mb-1 text-center" style={{ color: '#dc2626' }}>Отклонить заявку</h3>
              <p className="text-xs text-center mb-4" style={{ color: 'var(--text2)' }}>Клиент получит уведомление с причиной</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {REJECT_TEMPLATES.map(t => (
                  <button key={t} onClick={() => setRejectReason(t)}
                    className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                    {t}
                  </button>
                ))}
              </div>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Причина отказа..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-4"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--text)' }} />
              <div className="flex gap-2">
                <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>Отмена</button>
                <button onClick={handleRejectSubmit} disabled={!rejectReason.trim()}
                  className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', color: '#dc2626' }}>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(30,24,16,0.45)', backdropFilter: 'blur(12px)' }}
            onClick={() => setBulkConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-3xl p-7 border text-center"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
              <div className="text-3xl mb-3">✓</div>
              <h3 className="font-black text-base mb-2" style={{ color: 'var(--text)' }}>Принять {selectedIds.length} заявок?</h3>
              <p className="text-xs mb-5" style={{ color: 'var(--text2)' }}>Это действие подтвердит все выбранные заявки сразу.</p>
              <div className="flex gap-2">
                <button onClick={() => setBulkConfirm(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>Отмена</button>
                <button onClick={bulkApprove} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'rgba(52,211,153,0.2)', color: '#059669' }}>Принять все</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-16">
        {/* Hero */}
        <div className="relative h-48 sm:h-64 overflow-hidden">
          <img
            src={data.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'}
            alt={data.name}
            className="w-full h-full object-cover"
            onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'; }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--bg) 0%, color-mix(in srgb, var(--bg) 40%, transparent) 60%, transparent 100%)' }} />
          <div className="absolute bottom-5 left-4 sm:left-8">
            <h1 className="text-2xl sm:text-4xl font-black" style={{ color: 'var(--text)' }}>{data.name}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>📍 {data.district} · {data.address}</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

          {/* Info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { emoji: '👥', label: 'Вместимость',    val: `${data.max_capacity_people} чел.` },
              { emoji: '🪑', label: 'Мест за столами', val: `${data.seating_capacity} чел.`    },
              { emoji: '🍽️', label: 'Официанты',      val: `${data.waiters_count} чел.`       },
              { emoji: '🎭', label: 'Сцена',           val: data.stage_size                    },
              { emoji: '🚗', label: 'Парковка',        val: `${data.parking_spaces} мест`      },
              { emoji: '🍜', label: 'Кухня',           val: data.kitchen_type                  },
              { emoji: '💡', label: 'LED экран',       val: data.has_led_screen ? 'Есть' : 'Нет' },
              { emoji: '💰', label: 'Цена/день',       val: `~${Math.round((data.price_per_day_uzs||0)/1e6)} млн` },
            ].map(({ emoji, label, val }) => (
              <motion.div whileHover={{ y: -2 }} key={label} className="rounded-2xl p-4 text-center border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="text-xl mb-1">{emoji}</div>
                <div className="text-xs mb-1" style={{ color: 'var(--text2)' }}>{label}</div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{val}</div>
              </motion.div>
            ))}
          </div>

          {/* Контакты */}
          <div className="grid sm:grid-cols-3 gap-3">
            {data.phone && (
              <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid rgba(var(--gold-rgb,201,168,76),0.2)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--gold-rgb,201,168,76),0.15)' }}>📞</div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text2)' }}>Телефон</div>
                  <a href={`tel:${data.phone}`} className="font-bold text-sm hover:underline" style={{ color: 'var(--gold)' }}>{data.phone}</a>
                </div>
              </div>
            )}
            {data.telegram && (
              <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid rgba(56,134,222,0.2)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(56,134,222,0.15)' }}>✈️</div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text2)' }}>Telegram</div>
                  <a href={`https://t.me/${data.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="font-bold text-sm hover:underline" style={{ color: '#5b9eed' }}>{data.telegram}</a>
                </div>
              </div>
            )}
            {data.payment_card && (
              <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,0.15)' }}>💳</div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text2)' }}>Карта оплаты</div>
                  <span className="font-bold text-xs font-mono" style={{ color: '#7c3aed', letterSpacing: '0.5px' }}>{data.payment_card.replace(/(\d{4})/g,'$1 ').trim()}</span>
                </div>
              </div>
            )}
          </div>

          {/* ═══ OWNER PANEL ═══ */}
          {isOwner && (
            <div className="border-t pt-6 space-y-6" style={{ borderColor: 'var(--border)' }}>

              {/* Срочные / конфликты */}
              <AnimatePresence>
                {urgentPending.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <span className="text-2xl flex-shrink-0">⚠️</span>
                    <div className="text-sm flex-1" style={{ color: '#dc2626' }}>
                      <strong>{urgentPending.length}</strong> {urgentPending.length === 1 ? 'заявка' : 'заявки'} с датой тоя меньше 5 дней ждут ответа.
                    </div>
                    <button onClick={() => { setUrgentOnly(true); }} className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                      Показать
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              {conflictDates.length > 0 && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}>
                  <span className="text-xl flex-shrink-0">⚠️</span>
                  <div className="text-xs" style={{ color: '#b45309' }}>
                    Несколько активных заявок на дату(ы): <strong>{conflictDates.join(', ')}</strong> — проверьте двойное бронирование.
                  </div>
                </div>
              )}

              {/* Stats */}
              <div>
                <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text)' }}>Моя статистика</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Все заявки',    val: orders.length,    color: 'var(--text)' },
                    { label: 'Ожидают',      val: pendingOrders.length, color: '#b45309' },
                    { label: 'Принято',      val: approvedOrders.length, color: '#059669' },
                    { label: 'Доход/месяц',  val: `$${thisMonthRevenue}`, color: 'var(--gold)', trend: revenueTrend },
                  ].map(({ label, val, color, trend }) => (
                    <motion.div whileHover={{ y: -2 }} key={label} className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text2)' }}>{label}</div>
                      <div className="flex items-end gap-2">
                        <div className="text-2xl font-black" style={{ color }}>{val}</div>
                        {trend !== undefined && trend !== null && (
                          <span className="text-[10px] font-bold mb-1" style={{ color: trend >= 0 ? '#34d399' : '#f87171' }}>
                            {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--text2)' }}>Доход всего: <strong style={{ color: 'var(--gold)' }}>${revenue}</strong> ({fmtUZS(revenue)})</div>
              </div>

              {/* Панель управления */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:flex-initial">
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск клиента/даты/ID... ( / )"
                    className="px-3 py-2 rounded-xl text-xs outline-none w-full sm:w-64"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setUrgentOnly(p => !p)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={urgentOnly
                      ? { background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', color: '#dc2626' }
                      : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                    🔥 Только срочные
                  </button>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <option value="date_asc">Дата ↑</option>
                    <option value="date_desc">Дата ↓</option>
                    <option value="amount_desc">Сумма ↓</option>
                    <option value="urgent">По срочности</option>
                  </select>
                  <button onClick={exportCSV} className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                    📥 CSV
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
                    <span className="text-xs font-semibold" style={{ color: '#059669' }}>{selectedIds.length} заявок выбрано</span>
                    <div className="flex gap-2">
                      <button onClick={() => setBulkConfirm(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52,211,153,0.2)', color: '#059669' }}>Принять все</button>
                      <button onClick={() => setSelectedIds([])} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--text2)' }}>Отмена</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-14">
                  <div className="text-3xl mb-2">🗂️</div>
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>{search || urgentOnly ? 'Ничего не найдено' : 'Заявок пока нет'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map(o => (
                    <HallOrderCard key={o.id} order={o} status={myStatusOf(o)}
                      urgent={myStatusOf(o) === 'pending' && Number.isFinite(daysUntil(o.date)) && daysUntil(o.date) <= 5 && daysUntil(o.date) >= 0}
                      isRepeat={(clientCounts[o.client?.name || o.clientName] || 0) > 1}
                      repeatCount={clientCounts[o.client?.name || o.clientName] || 0}
                      note={notes[o.id] || ''} onNoteChange={(v) => saveNote(o.id, v)}
                      onCopyPhone={copyPhone}
                      onCopyId={() => copyOrderId(o.id)}
                      onExportPDF={() => exportOrderPDF(o)}
                      selected={selectedIds.includes(o.id)}
                      onToggleSelect={() => setSelectedIds(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])}
                      onAccept={() => handleAccept(o.id)}
                      onReject={() => { setRejectModal({ orderId: o.id }); setRejectReason(''); }}
                      acceptLoading={actionLoading === o.id + '_accept'}
                      rejectLoading={actionLoading === o.id + '_reject'} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(30,24,16,0.45)', backdropFilter: 'blur(12px)' }}
          onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold" style={{ color: 'var(--text)' }}>Редактировать профиль</h3>
              <button onClick={() => setEditOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                style={{ background: 'var(--bg)', color: 'var(--text2)' }}>×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {EDITABLE_FIELDS.map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>{label}</label>
                  {type === 'boolean' ? (
                    <button
                      onClick={() => setEditForm(p => ({ ...p, [key]: !p[key] }))}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all"
                      style={{
                        background: editForm[key] ? 'rgba(16,185,129,0.12)' : 'var(--bg)',
                        border: `1px solid ${editForm[key] ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                      }}>
                      <div className={`w-10 h-5 rounded-full transition-all relative ${editForm[key] ? 'bg-emerald-500' : 'bg-black/15'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${editForm[key] ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: editForm[key] ? '#059669' : 'var(--text2)' }}>
                        {editForm[key] ? 'Есть' : 'Нет'}
                      </span>
                    </button>
                  ) : (
                    <input
                      type={type}
                      value={editForm[key] ?? ''}
                      onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? +e.target.value : e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  )}
                </div>
              ))}

              {editForm.image_url && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <img src={editForm.image_url} alt="preview" className="w-full h-32 object-cover" onError={e => { e.target.style.display = 'none'; }} />
                </div>
              )}
              <p className="text-[11px]" style={{ color: 'var(--text2)' }}>
                Широта/долгота используются для отображения зала на карте в разделе «Карта» на главной странице — обновите их, если зал переехал.
              </p>
            </div>

            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setEditOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: saveOk ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, black))', border: saveOk ? '1px solid rgba(16,185,129,0.5)' : 'none' }}>
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
function HallOrderCard({ order: o, status, urgent, isRepeat, repeatCount, note, onNoteChange, onCopyPhone, onCopyId, onExportPDF, selected, onToggleSelect, onAccept, onReject, acceptLoading, rejectLoading }) {
  const showActions = status === 'pending';
  const border = status === 'pending' ? 'rgba(245,158,11,0.25)' : status === 'approved' ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)';
  const bg = status === 'pending' ? 'rgba(245,158,11,0.05)' : status === 'approved' ? 'rgba(52,211,153,0.04)' : 'rgba(239,68,68,0.04)';
  const [showNote, setShowNote] = useState(false);
  const initials = (o.client?.name || o.clientName || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl border transition-all" style={{ background: bg, borderColor: border }}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex gap-3 flex-1">
          {showActions && (
            <input type="checkbox" checked={selected} onChange={onToggleSelect} className="w-3.5 h-3.5 mt-1.5 flex-shrink-0" />
          )}
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: 'rgba(var(--gold-rgb,201,168,76),0.15)', color: 'var(--gold)' }}>{initials}</div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={onCopyId} className="font-medium text-xs hover:underline" style={{ color: 'var(--text2)' }} title="Скопировать ID">ID: {o.id?.slice(-10)}</button>
              {urgent && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#dc2626' }}>🔥 срочно</span>}
              {isRepeat && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.15)', color: '#7c3aed' }} title={`${repeatCount} заявок от этого клиента`}>⭐ x{repeatCount}</span>}
            </div>
            <StatusStepper status={status} />
            <div className="text-xs" style={{ color: 'var(--text2)' }}>📅 {o.date} &nbsp;·&nbsp; 👥 {o.guests || 0} гостей</div>
            {(o.client || o.clientName) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs" style={{ color: 'var(--text2)' }}>Клиент:</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{o.client?.name || o.clientName}</span>
                {(o.client?.phone || o.clientPhone) && (
                  <>
                    <a href={`tel:${o.client?.phone || o.clientPhone}`} className="text-xs font-bold hover:underline" style={{ color: 'var(--gold)' }}>
                      {o.client?.phone || o.clientPhone}
                    </a>
                    <button onClick={() => onCopyPhone(o.client?.phone || o.clientPhone)} className="text-xs" style={{ color: 'var(--text2)' }}>📋</button>
                  </>
                )}
              </div>
            )}
            {o.artists?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                <span className="text-xs" style={{ color: 'var(--text2)' }}>Артисты:</span>
                {o.artists.map(a => (
                  <span key={a.id} className="text-xs" style={{ color: 'var(--text)' }}>
                    {a.name}
                    {a.phone && <a href={`tel:${a.phone}`} className="ml-1 hover:underline" style={{ color: 'var(--gold)' }}>{a.phone}</a>}
                  </span>
                ))}
              </div>
            )}
            <div className="font-bold text-sm pt-0.5" style={{ color: 'var(--gold)' }}>${o.total_price_usd} <span className="font-normal text-xs" style={{ color: 'var(--text2)' }}>({fmtUZS(o.total_price_usd)})</span></div>

            {status === 'rejected' && o.restaurant_rejection_reason && (
              <div className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>Причина: {o.restaurant_rejection_reason}</div>
            )}
            {status === 'cancelled' && o.cancellation_reason && (
              <div className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(148,163,184,0.08)', color: '#64748b' }}>Клиент отменил: {o.cancellation_reason}</div>
            )}
            {o.payment && (
              <div className="text-[11px] px-2.5 py-1.5 rounded-lg inline-block" style={{ background: 'rgba(139,92,246,0.08)', color: '#7c3aed' }}>
                💳 Оплачено: ${o.payment.amount_usd} ({o.payment.method === 'card' ? 'картой' : 'наличные'})
              </div>
            )}

            <div className="flex items-center gap-3">
              <button onClick={() => setShowNote(p => !p)} className="text-[11px]" style={{ color: 'var(--text2)' }}>
                {note ? `📝 ${note}` : '+ добавить заметку'}
              </button>
              <button onClick={onExportPDF} className="text-[11px]" style={{ color: 'var(--text2)' }}>📄 PDF заявки</button>
            </div>
            {showNote && (
              <textarea rows={2} value={note} onChange={e => onNoteChange(e.target.value)}
                placeholder="Заметка видна только вам..."
                className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none resize-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <button onClick={onAccept} disabled={acceptLoading || rejectLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#059669' }}>
              {acceptLoading ? '...' : '✓ Принять'}
            </button>
            <button onClick={onReject} disabled={acceptLoading || rejectLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626' }}>
              {rejectLoading ? '...' : '✗ Отказать'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}