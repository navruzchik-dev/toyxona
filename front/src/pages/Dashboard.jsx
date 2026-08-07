import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoLayersOutline,
  IoCheckmarkDoneOutline,
  IoCloseCircleOutline,
  IoTrendingUpOutline,
  IoEyeOutline,
} from 'react-icons/io5';

const API = 'http://localhost:5000';

/**
 * Заказ (wedding_orders) может включать зал И артиста одновременно.
 * Раньше у заказа было ОДНО общее поле status — когда артист подтверждал
 * заявку, статус всего заказа менялся, и зал "тоже подтверждался" вместе
 * с ним, хотя владелец зала ничего не одобрял. Теперь статус хранится
 * раздельно: restaurant_status и artist_status. Этот дашборд патчит
 * только то поле, которое относится к вошедшему вендору.
 */
const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.floor(diff / 86400000);
};

// ── Модалка подробного просмотра заказа ───────────────────────────────────
const OrderDetailModal = ({ order, vendorType, onClose, onApprove, onReject }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!order) return null;
  const myStatus = vendorType === 'hall' ? (order.restaurant_status || order.status || 'pending') : (order.artist_status || order.status || 'pending');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}
        onClick={onClose}>
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border"
          style={{ background: 'linear-gradient(135deg, #0a0a1a, #0f0f20)', borderColor: 'rgba(var(--gold-rgb,201,168,76),0.3)' }}
          onClick={e => e.stopPropagation()}>

          {/* Шапка */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Детали заявки</p>
              <h3 className="text-white font-black text-lg">#{order.id?.slice(-10)}</h3>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition"
              style={{ background: 'rgba(255,255,255,0.06)' }}>×</button>
          </div>

          {/* Клиент */}
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-center gap-3 p-4 rounded-2xl mb-4"
              style={{ background: 'rgba(var(--gold-rgb,201,168,76),0.06)', border: '1px solid rgba(var(--gold-rgb,201,168,76),0.2)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-base"
                style={{ background: 'linear-gradient(135deg, var(--gold, #C9A84C), #7A5C1E)' }}>
                {(order.clientName || 'G')[0].toUpperCase()}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{order.clientName || 'Гость'}</div>
                <div className="text-white/40 text-xs">{order.client?.phone || '—'}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[color:var(--gold,#C9A84C)] font-black text-lg">${order.total_price_usd}</div>
                <div className="text-white/35 text-xs">итого</div>
              </div>
            </div>

            {/* Детали */}
            <div className="space-y-2 mb-4">
              {[
                ['📅 Дата торжества', order.date],
                ['👥 Гостей', `${order.guests || 0} человек`],
                ['🏛️ Ресторан', order.restaurant?.name || '— не выбран'],
                ['🎤 Артисты', (order.artists || []).map(a => a.name).join(', ') || '— не выбраны'],
                ['🚗 Кортеж', (order.cars || []).map(c => c.model).join(', ') || '— не выбран'],
                ['✨ Декор', (order.decors || []).map(d => d.service_name).join(', ') || '— не выбран'],
              ].map(([label, val]) => (
                <div key={label} className="flex items-start justify-between py-2 border-b border-white/5">
                  <span className="text-white/40 text-xs w-36 flex-shrink-0 pt-0.5">{label}</span>
                  <span className="text-white/85 text-sm text-right">{val}</span>
                </div>
              ))}
            </div>

            {/* Причина отклонения */}
            {showRejectInput && (
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-widest mb-2 text-white/40">Причина отказа</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Укажите причину отклонения заявки..."
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', color: 'white' }} />
              </div>
            )}

            {/* Кнопки действий — реагируют только на СВОЙ статус (зал/артист) */}
            {myStatus === 'pending' && (
              <div className="flex gap-3 pb-6">
                {!showRejectInput ? (
                  <>
                    <button
                      onClick={() => { onApprove(order.id); onClose(); }}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white transition hover:opacity-88"
                      style={{ background: 'linear-gradient(135deg, #10b981, #047857)' }}>
                      ✓ Принять заявку
                    </button>
                    <button
                      onClick={() => setShowRejectInput(true)}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm transition"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                      ✕ Отклонить
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { onReject(order.id, rejectReason); onClose(); }}
                      disabled={!rejectReason.trim()}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm disabled:opacity-40 transition"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
                      Подтвердить отклонение
                    </button>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm transition"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                      Назад
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const toast = useToast();

  const isArtist = user?.role === 'artist';
  const isHall   = user?.role === 'hall';
  const vendorType = isHall ? 'hall' : 'artist';

  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, activeCount: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);

  const knownOrderIds = React.useRef(new Set());

  // Статус, который относится именно к этому вендору (не общий o.status)
  const myStatusOf = useCallback((o) => {
    if (isHall) return o.restaurant_status || o.status || 'pending';
    return o.artist_status || o.status || 'pending';
  }, [isHall]);

  const fetchOrders = useCallback(async () => {
    if (!user || (!isArtist && !isHall)) return;
    try {
      const res = await fetch(`${API}/wedding_orders`);
      const data = await res.json();
      const myOrders = (data || []).filter(order => {
        if (isHall) return String(order.restaurant?.id) === String(user.id);
        return String(order.artist?.id) === String(user.id) ||
          (order.artists || []).some(a => String(a.id) === String(user.id));
      });

      // Уведомление о новых заявках (только по своему статусу)
      myOrders.filter(o => myStatusOf(o) === 'pending').forEach(o => {
        if (!knownOrderIds.current.has(o.id)) {
          if (knownOrderIds.current.size > 0) {
            toast?.add(`Новая заявка от ${o.clientName || 'клиента'} на ${o.date}!`, 'info', 6000);
          }
          knownOrderIds.current.add(o.id);
        }
      });

      setOrders(myOrders);

      const revenue = myOrders.reduce((acc, curr) =>
        myStatusOf(curr) === 'approved' ? acc + (curr.total_price_usd || 0) : acc, 0);
      const approvedCount = myOrders.filter(o => myStatusOf(o) === 'approved').length;
      setAnalytics({ totalRevenue: revenue, activeCount: approvedCount });
    } catch (err) {
      console.error(err);
    }
  }, [user, toast, isArtist, isHall, myStatusOf]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Патчим ТОЛЬКО своё поле статуса — restaurant_status для зала,
  // artist_status для артиста. Общий status пересчитываем как best-effort
  // агрегат для старого кода, который может его ещё читать.
  const deriveAggregate = (o, myField, value) => {
    const rStatus = myField === 'restaurant_status' ? value : (o.restaurant_status || (o.restaurant ? o.status : null) || (o.restaurant ? 'pending' : null));
    const aStatus = myField === 'artist_status' ? value : (o.artist_status || ((o.artists || []).length ? o.status : null) || ((o.artists || []).length ? 'pending' : null));
    const parts = [rStatus, aStatus].filter(Boolean);
    if (parts.length === 0) return value;
    if (parts.includes('rejected')) return 'rejected';
    if (parts.every(p => p === 'approved')) return 'approved';
    return 'pending';
  };

  const handleApprove = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const myField = isHall ? 'restaurant_status' : 'artist_status';
    try {
      await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [myField]: 'approved', status: deriveAggregate(order, myField, 'approved') }),
      });
      toast?.add('✅ Заявка принята! Клиент получит уведомление.', 'success');
      fetchOrders();
    } catch (err) {
      toast?.add('Ошибка при обновлении статуса', 'error');
    }
  };

  const handleReject = async (orderId, reason) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const myField = isHall ? 'restaurant_status' : 'artist_status';
    const reasonField = isHall ? 'restaurant_rejection_reason' : 'artist_rejection_reason';
    try {
      await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [myField]: 'rejected',
          [reasonField]: reason,
          status: deriveAggregate(order, myField, 'rejected'),
        }),
      });
      toast?.add('Заявка отклонена. Клиент получит уведомление.', 'warning');
      fetchOrders();
    } catch (err) {
      toast?.add('Ошибка при обновлении статуса', 'error');
    }
  };

  if (!user || (!isArtist && !isHall)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-xl font-bold text-white">Доступ ограничен</h2>
        <p className="text-sm text-white/50 mt-1 max-w-xs">
          Пожалуйста, войдите в систему под аккаунтом Артиста или Ресторана.
        </p>
      </div>
    );
  }

  const pendingOrders  = orders.filter(o => myStatusOf(o) === 'pending');
  const approvedOrders = orders.filter(o => myStatusOf(o) === 'approved');
  const rejectedOrders = orders.filter(o => myStatusOf(o) === 'rejected');

  const statusLabel = (s) => ({ pending: 'Новый', approved: 'Принят', rejected: 'Отклонён' }[s] || s);
  const statusClass = (s) => ({
    pending:  'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    approved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    rejected: 'bg-red-500/15 text-red-400 border border-red-500/25',
  }[s] || '');

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">

      {/* Модалка деталей */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          vendorType={vendorType}
          onClose={() => setSelectedOrder(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-2">
          <IoLayersOutline style={{ color: 'var(--gold, #C9A84C)' }} />
          Кабинет {isHall ? 'Ресторана' : 'Исполнителя'} BAYRAMLY
        </h1>
        <p className="text-xs text-white/50 mt-1">
          Добро пожаловать,{' '}
          <span className="text-white font-semibold">{user.name}</span>!
          {pendingOrders.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {pendingOrders.length} новых заявок
            </span>
          )}
        </p>
      </div>

      {/* Уведомление о новых заявках */}
      <AnimatePresence>
        {pendingOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl border"
            style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}>
              <span className="text-2xl">🔔</span>
            </motion.div>
            <div>
              <div className="text-amber-400 font-semibold text-sm">
                У вас {pendingOrders.length} {pendingOrders.length === 1 ? 'новая заявка' : 'новых заявки'}!
              </div>
              <div className="text-amber-400/60 text-xs mt-0.5">
                Клиенты ждут вашего ответа. Нажмите на заявку для просмотра.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Аналитика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Подтверждённый доход', value: `$${analytics.totalRevenue.toLocaleString()}`, icon: <IoTrendingUpOutline className="text-2xl text-emerald-400" />, gold: true },
          { label: isHall ? 'Принято броней' : 'Принято выступлений', value: `${analytics.activeCount} тоев`, icon: <IoCheckmarkDoneOutline className="text-2xl" style={{ color: 'var(--gold, #C9A84C)' }} />, gold: false },
          { label: 'Ожидают ответа', value: `${pendingOrders.length} шт.`, icon: <span className="text-2xl">⏳</span>, gold: false, pulse: pendingOrders.length > 0 },
          { label: 'Всего заявок', value: `${orders.length} шт.`, icon: <IoLayersOutline className="text-2xl text-purple-400" />, gold: false },
        ].map((card, i) => (
          <div key={i} className="rounded-2xl p-5 border flex flex-row items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: card.pulse ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)' }}>
            <div>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{card.label}</span>
              <h3 className="text-2xl font-black mt-1" style={{ color: card.gold ? 'var(--gold, #C9A84C)' : 'white' }}>{card.value}</h3>
            </div>
            {card.icon}
          </div>
        ))}
      </div>

      {/* Таблица заявок */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="px-6 py-5 border-b border-white/8">
          <h3 className="font-bold text-lg text-white">Входящие заявки</h3>
          <p className="text-white/35 text-xs mt-0.5">Нажмите на заявку для просмотра деталей и управления</p>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="table w-full text-left text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/8">
                <th className="px-5 py-3">ID Заказа</th>
                <th className="px-5 py-3">Дата / Гости</th>
                <th className="px-5 py-3">Клиент</th>
                <th className="px-5 py-3">{isHall ? 'Артисты' : 'Ресторан'}</th>
                <th className="px-5 py-3">Сумма</th>
                <th className="px-5 py-3">Статус (ваш)</th>
                <th className="px-5 py-3 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-white/30">
                    <div className="text-4xl mb-2">📭</div>
                    Новых заявок на ваше имя пока не поступало
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const st = myStatusOf(order);
                  return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-white/4 transition cursor-pointer"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--gold, #C9A84C)' }}>
                        #{order.id?.slice(-8)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-white font-semibold">{order.date}</div>
                      <div className="text-xs text-white/40">{order.guests || 0} гостей</div>
                    </td>
                    <td className="px-5 py-4">
                      {order.clientName ? (
                        <div>
                          <div className="text-white font-medium">{order.clientName}</div>
                          <div className="text-xs text-white/40">{order.client?.phone || '—'}</div>
                        </div>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-white/70">
                      {isHall
                        ? ((order.artists || []).map(a => a.name).join(', ') || <span className="text-white/30">Без артистов</span>)
                        : (order.restaurant?.name || <span className="text-white/30">Только артист</span>)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold" style={{ color: 'var(--gold, #C9A84C)' }}>${order.total_price_usd}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass(st)}`}>
                        {st === 'pending' && (
                          <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            ●{' '}
                          </motion.span>
                        )}
                        {statusLabel(st)}
                      </span>
                    </td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition hover:opacity-80"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                          <IoEyeOutline /> Просмотр
                        </button>
                        {st === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(order.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition hover:opacity-80"
                              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                              <IoCheckmarkDoneOutline /> Принять
                            </button>
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition hover:opacity-80"
                              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                              <IoCloseCircleOutline /> Отклонить
                            </button>
                          </>
                        )}
                        {st !== 'pending' && (
                          <span className="text-xs text-white/25">Обработано</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;