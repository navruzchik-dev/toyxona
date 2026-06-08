import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';

const API = 'http://localhost:5000';
const USD_RATE = 12700;
const fmtMln = uzs => `~${Math.round(uzs / 1_000_000)} млн`;

const STATUS_LABELS = {
  pending:   { label: 'Ожидает подтверждения', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  approved:  { label: 'Подтверждён',           color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  rejected:  { label: 'Отклонён',              color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'  },
  cancelled: { label: 'Отменён вами',          color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',border: 'rgba(148,163,184,0.2)'},
};

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Approval notification modal
  const [approvalModal, setApprovalModal] = useState(null); // { order }

  // Cancel modal
  const [cancelModal, setCancelModal] = useState(null); // { orderId, itemName }
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // PDF download order
  const [pdfOrder, setPdfOrder] = useState(null);

  const pollingRef = useRef(null);
  const seenApprovals = useRef(
    new Set(JSON.parse(localStorage.getItem('bay_seen_approvals') || '[]'))
  );

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/wedding_orders`);
      const all = await res.json();
      const mine = all.filter(o =>
        o.clientId === user?.id || o.clientName === user?.name
      );
      setOrders(mine);
      setLoading(false);

      // Check for newly approved orders
      const newApproval = mine.find(o =>
        o.status === 'approved' && !seenApprovals.current.has(o.id)
      );
      if (newApproval) {
        seenApprovals.current.add(newApproval.id);
        localStorage.setItem('bay_seen_approvals', JSON.stringify([...seenApprovals.current]));
        setApprovalModal(newApproval);
      }
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    pollingRef.current = setInterval(fetchOrders, 7000);
    return () => clearInterval(pollingRef.current);
  }, [user]);

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await fetch(`${API}/wedding_orders/${cancelModal.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancellation_reason: cancelReason }),
      });
      setCancelModal(null);
      setCancelReason('');
      fetchOrders();
    } catch {}
    setCancelLoading(false);
  };

  const downloadPDF = (order) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('BAYRAMLY', 20, 20);
    doc.setFontSize(12);
    doc.text(`Договор: ${order.id}`, 20, 40);
    doc.text(`Статус: ${STATUS_LABELS[order.status]?.label || order.status}`, 20, 50);
    doc.text(`Дата торжества: ${order.date}`, 20, 60);
    doc.text(`Гостей: ${order.guests}`, 20, 70);
    doc.text(`Зал: ${order.restaurant?.name || 'Не выбран'}`, 20, 90);
    const artists = (order.artists || (order.artist ? [order.artist] : [])).map(a => a.name).join(', ');
    doc.text(`Артисты: ${artists || 'Не выбраны'}`, 20, 100);
    doc.text(`Кортеж: ${order.car?.model || 'Не выбран'}`, 20, 110);
    doc.text(`Декор: ${order.decor?.service_name || 'Не выбран'}`, 20, 120);
    doc.setFontSize(16);
    doc.text(`Итого: $${order.total_price_usd}`, 20, 145);
    doc.save(`bayramly-${order.id}.pdf`);
  };

  const activeOrders    = orders.filter(o => ['pending', 'approved'].includes(o.status));
  const historicOrders  = orders.filter(o => ['rejected', 'cancelled'].includes(o.status));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-10 h-10 border-2 rounded-full animate-spin"
        style={{ borderColor: 'rgba(201,168,76,0.2)', borderTopColor: '#C9A84C' }} />
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-20 px-4" style={{ background: 'var(--bg)' }}>

      {/* ── Approval modal ── */}
      <AnimatePresence>
        {approvalModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="w-full max-w-md rounded-3xl p-8 text-center border"
              style={{ background: 'linear-gradient(135deg, #0a1a0a, #0d1a10)', borderColor: 'rgba(52,211,153,0.4)' }}>
              {/* Animated ring */}
              <div className="relative w-24 h-24 mx-auto mb-6">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.15)', border: '2px solid rgba(52,211,153,0.3)' }} />
                <div className="absolute inset-3 rounded-full flex items-center justify-center text-4xl"
                  style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.4)' }}>
                  🎉
                </div>
              </div>
              <h2 className="text-2xl font-black mb-2" style={{ color: '#6ee7b7' }}>
                Заявка подтверждена!
              </h2>
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <strong style={{ color: 'white' }}>
                  {approvalModal.restaurant?.name || approvalModal.artists?.[0]?.name || 'Исполнитель'}
                </strong>{' '}
                принял(а) вашу заявку
              </p>
              <div className="my-5 p-4 rounded-2xl text-sm text-left space-y-2"
                style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Дата торжества</span>
                  <span style={{ color: 'white', fontWeight: 700 }}>{approvalModal.date}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Гостей</span>
                  <span style={{ color: 'white', fontWeight: 700 }}>{approvalModal.guests}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Итоговая сумма</span>
                  <span style={{ color: '#6ee7b7', fontWeight: 800 }}>${approvalModal.total_price_usd}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { downloadPDF(approvalModal); setApprovalModal(null); }}
                  className="w-full py-3.5 rounded-xl font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}>
                  Скачать смету PDF
                </button>
                <button
                  onClick={() => setApprovalModal(null)}
                  className="w-full py-3 rounded-xl text-sm"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cancel Modal ── */}
      <AnimatePresence>
        {cancelModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-7 border"
              style={{ background: 'linear-gradient(135deg, #1a0a0a, #0d0d1a)', borderColor: 'rgba(239,68,68,0.35)' }}>
              <div className="text-3xl mb-4 text-center">⚠️</div>
              <h3 className="text-lg font-black mb-1 text-center" style={{ color: '#fca5a5' }}>
                Отменить бронирование?
              </h3>
              <p className="text-sm mb-4 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {cancelModal.itemName}
              </p>
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Причина отмены *
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Напишите причину отмены..."
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: 'white',
                  }} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCancelModal(null); setCancelReason(''); }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                  Назад
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!cancelReason.trim() || cancelLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
                  {cancelLoading ? 'Отменяем...' : 'Отменить бронь'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black" style={{ color: 'var(--text)' }}>Мои брони</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              {activeOrders.length > 0
                ? `${activeOrders.length} активных бронирований`
                : 'Нет активных бронирований'}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold)' }}>
            + Новое событие
          </button>
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-4xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>📋</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Бронирований пока нет</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
              Перейдите в конструктор и создайте идеальный той
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-7 py-3.5 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, var(--gold, #C9A84C), #7A5C1E)' }}>
              Открыть конструктор
            </button>
          </div>
        )}

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div className="space-y-4 mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text2)' }}>
              Активные бронирования
            </h2>
            {activeOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={() => setCancelModal({
                  orderId:  order.id,
                  itemName: order.restaurant?.name || order.artists?.[0]?.name || 'Бронирование',
                })}
                onDownload={() => downloadPDF(order)}
                onPay={() => alert('Перенаправление на платёжный шлюз Uzum Pay...')}
              />
            ))}
          </div>
        )}

        {/* History */}
        {historicOrders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text2)' }}>
              История
            </h2>
            {historicOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onDownload={() => downloadPDF(order)}
                readonly
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── OrderCard ─── */
function OrderCard({ order: o, onCancel, onDownload, onPay, readonly }) {
  const st = STATUS_LABELS[o.status] || STATUS_LABELS.pending;
  const artists = o.artists?.length > 0 ? o.artists : (o.artist ? [o.artist] : []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: st.border }}>

      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b"
        style={{ background: st.bg, borderColor: st.border }}>
        <div className="flex items-center gap-2">
          {o.status === 'approved' && (
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
          {o.status === 'pending' && (
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-amber-400" />
          )}
          <span className="text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {o.id}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoChip icon="📅" label="Дата торжества" val={o.date || '—'} />
          <InfoChip icon="👥" label="Гостей" val={`${o.guests || 0} чел.`} />
          <InfoChip icon="💰" label="Итого" val={`$${o.total_price_usd}`} gold />
        </div>

        {/* Services */}
        <div className="space-y-2">
          {o.restaurant && (
            <ServiceRow icon="🏛️" label="Зал" name={o.restaurant.name}
              price={fmtMln(o.restaurant.price_per_day_uzs)} />
          )}
          {artists.length > 0 && artists.map((a, i) => (
            <ServiceRow key={i} icon="🎤" label="Артист" name={a.name}
              price={`$${a.price_per_hour_usd}/ч`} />
          ))}
          {(o.cars?.length > 0 ? o.cars : o.car ? [o.car] : []).map((c, i) => (
            <ServiceRow key={i} icon="🚗" label="Кортеж" name={c.model}
              price={`$${c.price_per_day_usd}/д`} />
          ))}
          {(o.decors?.length > 0 ? o.decors : o.decor ? [o.decor] : []).map((d, i) => (
            <ServiceRow key={i} icon="✨" label="Декор" name={d.service_name}
              price={fmtMln(d.price_uzs)} />
          ))}
        </div>

        {/* Rejection reason */}
        {o.status === 'rejected' && o.rejection_reason && (
          <div className="p-3 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#f87171' }}>Причина отказа</div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{o.rejection_reason}</p>
          </div>
        )}

        {/* Cancellation reason */}
        {o.status === 'cancelled' && o.cancellation_reason && (
          <div className="p-3 rounded-xl text-sm"
            style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)' }}>
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Причина отмены</div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{o.cancellation_reason}</p>
          </div>
        )}

        {/* Actions */}
        {!readonly && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={onDownload}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              📄 Скачать смету
            </button>
            {o.status === 'approved' && (
              <button
                onClick={onPay}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, var(--gold, #C9A84C), #7A5C1E)' }}>
                💳 Оплатить заказ
              </button>
            )}
            {['pending', 'approved'].includes(o.status) && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all ml-auto"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                Отменить бронь
              </button>
            )}
          </div>
        )}

        {readonly && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onDownload}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              📄 Архив — скачать смету
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const InfoChip = ({ icon, label, val, gold }) => (
  <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
    <div className="text-lg mb-0.5">{icon}</div>
    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text2)' }}>{label}</div>
    <div className="font-bold text-sm" style={{ color: gold ? 'var(--gold, #C9A84C)' : 'var(--text)' }}>{val}</div>
  </div>
);

const ServiceRow = ({ icon, label, name, price }) => (
  <div className="flex items-center justify-between py-2 px-3 rounded-xl"
    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text2)' }}>{label}</div>
        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{name}</div>
      </div>
    </div>
    <span className="text-sm font-bold" style={{ color: 'var(--gold, #C9A84C)' }}>{price}</span>
  </div>
);