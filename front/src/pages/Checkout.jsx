import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { jsPDF } from 'jspdf';
import BankCardForm, { isCardValid, detectCardType as detectBrand } from '../components/BankCardForm';

const API      = 'http://localhost:5000';
const USD_RATE = 12700;
const fmtMln   = uzs => `~${Math.round((uzs||0)/1_000_000)} млн`;
const fmtUZS   = usd => `~${Math.round(((usd||0)*USD_RATE)/1_000_000)} млн сум`;

// До даты тоя (в днях). Отрицательное/маленькое число — тревога.
const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.floor(diff / 86400000);
};

// Определение типа карты по первым цифрам (для UI-подсказки)
const detectCardType = (num) => {
  const clean = (num || '').replace(/\s/g, '');
  if (/^8600/.test(clean)) return { name: 'Uzcard', color: '#22c55e' };
  if (/^9860/.test(clean)) return { name: 'Humo',   color: '#38bdf8' };
  if (/^4/.test(clean))    return { name: 'Visa',   color: '#facc15' };
  if (/^5[1-5]/.test(clean)) return { name: 'Mastercard', color: '#f97316' };
  return null;
};

const STATUS = {
  pending:   { label:'Ожидает подтверждения', color:'#b45309', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.35)' },
  approved:  { label:'Подтверждён',           color:'#047857', bg:'rgba(16,185,129,0.10)', border:'rgba(16,185,129,0.30)' },
  confirmed: { label:'Подтверждён',           color:'#047857', bg:'rgba(16,185,129,0.10)', border:'rgba(16,185,129,0.30)' },
  rejected:  { label:'Отклонён',              color:'#dc2626', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.30)'  },
  cancelled: { label:'Отменён вами',          color:'#475569', bg:'rgba(148,163,184,0.12)',border:'rgba(148,163,184,0.25)'},
};

// Независимые статусы зала и артиста (не путать с общим o.status)
const hallStatusOf = (o) => {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.restaurant_status) return o.restaurant_status;
  if (!o.restaurant) return null;
  return 'pending';
};
const artistStatusOf = (o) => {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.artist_status) return o.artist_status;
  if (!((o.artists && o.artists.length) || o.artist)) return null;
  return 'pending';
};


// ─── Rejection Modal ──────────────────────────────────────────────────────
const RejectionModal = ({ order, onClose, onChooseOther }) => {
  if (!order) return null;
  const isHall   = !!order.restaurant;
  const itemName = order.restaurant?.name || (order.artists||[])[0]?.name || 'Исполнитель';
  return (
    <Overlay onClick={onClose}>
      <motion.div initial={{scale:0.85,y:30,opacity:0}} animate={{scale:1,y:0,opacity:1}} exit={{scale:0.85,opacity:0}}
        transition={{type:'spring',stiffness:280,damping:22}}
        className="w-full max-w-md rounded-3xl p-8 text-center border"
        style={{background:'var(--bg2)',borderColor:'rgba(239,68,68,0.4)'}}
        onClick={e=>e.stopPropagation()}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl"
          style={{background:'rgba(239,68,68,0.1)',border:'2px solid rgba(239,68,68,0.3)'}}>😔</div>
        <h2 className="text-2xl font-black mb-2" style={{color:'#dc2626'}}>Заявка отклонена</h2>
        <p className="text-sm mb-2" style={{color:'var(--text2)'}}>
          <span style={{color:'#f87171',fontWeight:700}}>{itemName}</span> отклонил(а) вашу заявку
        </p>
        {order.rejection_reason&&(
          <div className="my-4 p-4 rounded-2xl text-sm text-left"
            style={{background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.2)',color:'var(--text)'}}>
            <div className="text-xs uppercase tracking-widest mb-1.5" style={{color:'rgba(239,68,68,0.7)'}}>Причина:</div>
            {order.rejection_reason}
          </div>
        )}
        {daysUntil(order.date) < 5 && (
          <div className="mb-4 p-3 rounded-xl text-xs" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',color:'#fbbf24'}}>
            ⏳ До тоя меньше 5 дней — выберите замену как можно скорее
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button onClick={()=>{onChooseOther();onClose();}}
            className="w-full py-3.5 rounded-xl font-bold text-[color:var(--text)] text-sm"
            style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
            Выбрать другой {isHall?'зал':'артиста'}
          </button>
          <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-medium" style={{color:'var(--text2)'}}>Закрыть</button>
        </div>
      </motion.div>
    </Overlay>
  );
};

// ─── PAYMENT MODAL ────────────────────────────────────────────────────────
const PaymentModal = ({ order, onClose, onPaid }) => {
  const [step, setStep]         = useState('choose');   // 'choose' | 'hall' | 'artist' | 'method' | 'done'
  const [payType, setPayType]   = useState(null);       // 'hall' | 'artist'
  const [selArtist, setSelArtist] = useState(null);
  const [hours, setHours]       = useState(1);
  const [date, setDate]         = useState(order?.date || '');
  const [time, setTime]         = useState('12:00');
  const [method, setMethod]     = useState(null);       // 'card' | 'cash'
  const [cardNum, setCardNum]   = useState('');
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [depositMode, setDepositMode] = useState('full'); // 'full' | 'deposit'
  const [saving, setSaving]     = useState(false);
  const [lastPayload, setLastPayload] = useState(null);
  const toast = useToast();

  const artists = (order?.artists?.length > 0 ? order.artists : (order?.artist ? [order.artist] : []));
  const hallPrice = order?.restaurant?.price_per_day_uzs;
  const hallPriceUSD = Math.round((hallPrice || 0) / 12700);
  const artistPrice = selArtist ? (selArtist.price_per_hour_usd || 0) * hours : 0;
  const baseAmount = payType === 'hall' ? hallPriceUSD : artistPrice;
  const amount = depositMode === 'deposit' ? Math.round(baseAmount * 0.3) : baseAmount;

  // Карта ресторана / артиста
  const [hallCard,   setHallCard]   = useState('');
  const [artistCard, setArtistCard] = useState('');

  useEffect(()=>{
    if (!order) return;
    if (order.restaurant?.id) {
      fetch(`${API}/restaurants/${order.restaurant.id}`).then(r=>r.json())
        .then(d=>{ if(d.payment_card) setHallCard(d.payment_card); }).catch(()=>{});
    }
  },[order]);

  useEffect(()=>{
    if (!selArtist?.id) return;
    fetch(`${API}/artists/${selArtist.id}`).then(r=>r.json())
      .then(d=>{ if(d.payment_card) setArtistCard(d.payment_card); }).catch(()=>{});
  },[selArtist]);

  if (!order) return null;

  const formatCard  = (v) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const cardTypeInfo = detectCardType(cardNum);

  const copyCard = (card) => {
    if (!card) return;
    navigator.clipboard?.writeText(card).then(()=> toast?.add('Номер карты скопирован', 'success'));
  };

  const handlePay = async () => {
    if (method === 'card') {
      const num = (cardData.number || cardNum || '').replace(/\s/g,'');
      if (num.length < 16) { toast?.add('Введите полный номер карты (16 цифр)', 'error'); return; }
      if (cardData.name !== undefined && !isCardValid({ ...cardData, number: num })) {
        toast?.add('Заполните имя, срок и CVV карты', 'error'); return;
      }
    }
    setSaving(true);
    try {
      const targetName  = payType==='hall' ? order.restaurant?.name : selArtist?.name;
      const targetCard  = payType==='hall' ? hallCard : artistCard;
      const payId       = 'PAY-' + Date.now();
      const payload = {
        id:          payId,
        order_id:    order.id,
        clientName:  order.clientName || 'Клиент',
        type:        payType,
        targetName,
        method,
        deposit:     depositMode === 'deposit',
        card_last4:  method==='card' ? (cardData.number || cardNum).replace(/\s/g,'').slice(-4) : null,
        card_brand:  method==='card' ? (detectBrand(cardData.number || cardNum)?.name || cardTypeInfo?.name || null) : null,
        receiver_card: targetCard || null,
        amount_usd:  amount,
        full_amount_usd: baseAmount,
        hours:       payType==='artist' ? hours : null,
        pay_date:    date,
        pay_time:    payType==='artist' ? time : null,
        paid_at:     new Date().toISOString(),
      };
      await fetch(`${API}/payments`,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      await fetch(`${API}/wedding_orders/${order.id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ payment: payload }) });
      toast?.add(`✅ Оплата $${amount} подтверждена!`, 'success', 7000);
      setLastPayload(payload);
      setStep('done');
      onPaid?.();
    } catch {
      toast?.add('Ошибка при сохранении платежа', 'error');
    }
    setSaving(false);
  };

  const downloadReceipt = () => {
    if (!lastPayload) return;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text('BAYRAMLY — Чек об оплате', 20, 20);
    doc.setFontSize(11);
    doc.text(`Платёж: ${lastPayload.id}`, 20, 36);
    doc.text(`Заказ: ${order.id}`, 20, 44);
    doc.text(`Получатель: ${lastPayload.targetName}`, 20, 54);
    doc.text(`Тип: ${lastPayload.type === 'hall' ? 'Оплата зала' : 'Оплата артиста'}${lastPayload.deposit ? ' (задаток 30%)' : ''}`, 20, 64);
    doc.text(`Способ: ${lastPayload.method === 'card' ? `Карта •••• ${lastPayload.card_last4}` : 'Наличные'}`, 20, 74);
    doc.text(`Сумма: $${lastPayload.amount_usd} (${fmtUZS(lastPayload.amount_usd)})`, 20, 84);
    doc.text(`Дата операции: ${new Date(lastPayload.paid_at).toLocaleString('ru-RU')}`, 20, 94);
    doc.save(`receipt-${lastPayload.id}.pdf`);
    toast?.add('Чек скачан', 'success');
  };

  return (
    <Overlay onClick={onClose}>
      <motion.div initial={{scale:0.9,opacity:0,y:20}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.9,opacity:0}}
        transition={{type:'spring',stiffness:280,damping:22}}
        className="w-full max-w-md rounded-3xl border overflow-hidden"
        style={{background:'var(--bg2)',borderColor:'rgba(201,168,76,0.3)',maxHeight:'92vh',overflowY:'auto'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[color:var(--border)]">
          <div>
            <p className="text-[color:var(--text2)] text-xs uppercase tracking-wider mb-0.5">Оплата заказа</p>
            <h3 className="text-[color:var(--text)] font-black text-base">{order.id?.slice(-12)}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-[color:var(--text2)] hover:text-[color:var(--text)] text-lg transition"
            style={{background:'rgba(0,0,0,0.04)'}}>×</button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">

          {/* ── Step 1: choose ── */}
          {step==='choose'&&(
            <>
              <p className="text-[color:var(--text2)] text-sm text-center">Что вы хотите оплатить?</p>
              <div className="space-y-3">
                {order.restaurant&&(
                  <button onClick={()=>{setPayType('hall');setStep('hall');}}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border transition hover:border-[#C9A84C]/40 text-left"
                    style={{background:'var(--bg)',borderColor:'rgba(0,0,0,0.05)'}}>
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={order.restaurant.image_url||''} alt="" className="w-full h-full object-cover bg-black/5"
                        onError={e=>{e.target.style.display='none'}}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[color:var(--text)] font-bold text-sm">🏛 {order.restaurant.name}</div>
                      <div className="text-[color:var(--text2)] text-xs mt-0.5">Аренда зала на целый день</div>
                      {hallCard&&<div className="text-purple-400 text-xs mt-0.5">💳 Карта получателя: •••• {hallCard.slice(-4)}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[#C9A84C] font-black text-lg">${hallPriceUSD}</div>
                      <div className="text-[color:var(--text2)] text-xs">весь день</div>
                    </div>
                  </button>
                )}
                {artists.length>0&&artists.map(a=>(
                  <button key={a.id} onClick={()=>{setPayType('artist');setSelArtist(a);setStep('artist');}}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border transition hover:border-[#C9A84C]/40 text-left"
                    style={{background:'var(--bg)',borderColor:'rgba(0,0,0,0.05)'}}>
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={a.image_url||''} alt="" className="w-full h-full object-cover bg-black/5"
                        onError={e=>{e.target.style.display='none'}}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[color:var(--text)] font-bold text-sm">🎤 {a.name}</div>
                      <div className="text-[color:var(--text2)] text-xs mt-0.5">{a.genre} · {a.category}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[#C9A84C] font-black text-lg">${a.price_per_hour_usd}/ч</div>
                      <div className="text-[color:var(--text2)] text-xs">за час</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Step 2a: hall — just confirm full day ── */}
          {step==='hall'&&(
            <>
              <div className="p-4 rounded-2xl" style={{background:'rgba(201,168,76,0.06)',border:'1px solid rgba(201,168,76,0.2)'}}>
                <div className="text-[color:var(--text)] font-bold mb-1">🏛 {order.restaurant?.name}</div>
                <div className="text-[color:var(--text2)] text-sm">Аренда зала на весь день торжества</div>
                {hallCard&&(
                  <div className="mt-3 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2"
                    style={{background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#c4b5fd'}}>
                    <span>💳 Номер карты для оплаты: {hallCard.replace(/(\d{4})/g,'$1 ').trim()}</span>
                    <button onClick={()=>copyCard(hallCard)} className="text-[color:var(--text2)] hover:text-[color:var(--text)] flex-shrink-0">📋</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[color:var(--text2)] text-xs uppercase tracking-wider mb-1.5">Дата</label>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[color:var(--text)] text-sm focus:outline-none transition"
                  style={{background:'var(--bg)',border:'1px solid rgba(0,0,0,0.08)'}}/>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[color:var(--text2)] text-sm">Итого за зал:</span>
                <div className="text-right">
                  <div className="text-[#C9A84C] font-black text-2xl">${hallPriceUSD}</div>
                  <div className="text-[color:var(--text2)] text-xs">{fmtUZS(hallPriceUSD)}</div>
                </div>
              </div>
              <button onClick={()=>setStep('method')}
                className="w-full py-3.5 rounded-xl font-bold text-[color:var(--text)] text-sm"
                style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
                Выбрать способ оплаты →
              </button>
            </>
          )}

          {/* ── Step 2b: artist — hours + date + time ── */}
          {step==='artist'&&selArtist&&(
            <>
              <div className="p-4 rounded-2xl" style={{background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.2)'}}>
                <div className="text-[color:var(--text)] font-bold mb-1">🎤 {selArtist.name}</div>
                <div className="text-[color:var(--text2)] text-sm">${selArtist.price_per_hour_usd}/час · {selArtist.genre}</div>
                {artistCard&&(
                  <div className="mt-3 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2"
                    style={{background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#c4b5fd'}}>
                    <span>💳 Карта артиста: {artistCard.replace(/(\d{4})/g,'$1 ').trim()}</span>
                    <button onClick={()=>copyCard(artistCard)} className="text-[color:var(--text2)] hover:text-[color:var(--text)] flex-shrink-0">📋</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[color:var(--text2)] text-xs uppercase tracking-wider mb-1.5">Дата выступления</label>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[color:var(--text)] text-sm focus:outline-none transition"
                  style={{background:'var(--bg)',border:'1px solid rgba(0,0,0,0.08)'}}/>
              </div>
              <div>
                <label className="block text-[color:var(--text2)] text-xs uppercase tracking-wider mb-1.5">Время начала</label>
                <input type="time" value={time} onChange={e=>setTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[color:var(--text)] text-sm focus:outline-none transition"
                  style={{background:'var(--bg)',border:'1px solid rgba(0,0,0,0.08)'}}/>
              </div>
              <div>
                <label className="block text-[color:var(--text2)] text-xs uppercase tracking-wider mb-2">
                  Количество часов: <span className="text-[#C9A84C] font-bold">{hours} ч</span>
                </label>
                <input type="range" min={1} max={12} value={hours} onChange={e=>setHours(Number(e.target.value))}
                  className="w-full accent-[#C9A84C]"/>
                <div className="flex justify-between text-[color:var(--text2)] text-xs mt-1"><span>1ч</span><span>12ч</span></div>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[color:var(--text2)] text-sm">Итого за артиста:</span>
                <div className="text-right">
                  <div className="text-[#C9A84C] font-black text-2xl">${artistPrice}</div>
                  <div className="text-[color:var(--text2)] text-xs">{fmtUZS(artistPrice)}</div>
                </div>
              </div>
              <button onClick={()=>setStep('method')} disabled={!date}
                className="w-full py-3.5 rounded-xl font-bold text-[color:var(--text)] text-sm disabled:opacity-40"
                style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
                Выбрать способ оплаты →
              </button>
            </>
          )}

          {/* ── Step 3: method ── */}
          {step==='method'&&(
            <>
              <p className="text-[color:var(--text2)] text-sm text-center">Как хотите оплатить?</p>

              {/* Полная / задаток */}
              <div className="flex rounded-xl overflow-hidden border" style={{borderColor:'rgba(0,0,0,0.08)'}}>
                <button onClick={()=>setDepositMode('full')}
                  className="flex-1 py-2.5 text-xs font-bold transition"
                  style={{background: depositMode==='full'?'rgba(201,168,76,0.18)':'transparent', color: depositMode==='full'?'#C9A84C':'rgba(255,255,255,0.4)'}}>
                  Полная оплата
                </button>
                <button onClick={()=>setDepositMode('deposit')}
                  className="flex-1 py-2.5 text-xs font-bold transition"
                  style={{background: depositMode==='deposit'?'rgba(201,168,76,0.18)':'transparent', color: depositMode==='deposit'?'#C9A84C':'rgba(255,255,255,0.4)'}}>
                  Задаток 30%
                </button>
              </div>

              {/* Сумма */}
              <div className="text-center py-3">
                <div className="text-[#C9A84C] font-black text-4xl">${amount}</div>
                <div className="text-[color:var(--text2)] text-sm mt-1">{fmtUZS(amount)}</div>
                <div className="text-[color:var(--text2)] text-xs mt-1">
                  {payType==='hall'?`Зал — ${order.restaurant?.name}`:`Артист — ${selArtist?.name}, ${hours}ч`}
                  {depositMode==='deposit' && ` · задаток от $${baseAmount}`}
                </div>
              </div>

              {/* Карта получателя */}
              {(payType==='hall'?hallCard:artistCard)&&(
                <div className="p-4 rounded-2xl" style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)'}}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-purple-400 text-xs font-bold">💳 Реквизиты получателя</div>
                    <button onClick={()=>copyCard(payType==='hall'?hallCard:artistCard)} className="text-[color:var(--text2)] hover:text-[color:var(--text)] text-xs">📋 Копировать</button>
                  </div>
                  <div className="text-[color:var(--text)] font-mono text-sm tracking-widest">
                    {(payType==='hall'?hallCard:artistCard).replace(/(\d{4})/g,'$1 ').trim()}
                  </div>
                </div>
              )}

              {/* Способы */}
              <div className="space-y-3">
                {/* Картой */}
                <button onClick={()=>setMethod(method==='card'?null:'card')}
                  className="w-full p-4 rounded-2xl border transition text-left"
                  style={{
                    background: method==='card'?'rgba(139,92,246,0.1)':'var(--bg)',
                    borderColor: method==='card'?'rgba(139,92,246,0.4)':'rgba(0,0,0,0.05)',
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💳</span>
                    <div className="flex-1">
                      <div className="text-[color:var(--text)] font-semibold text-sm">Оплата картой сейчас</div>
                      <div className="text-[color:var(--text2)] text-xs mt-0.5">Перевод на карту получателя</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method==='card'?'border-purple-400 bg-purple-400':'border-[color:var(--border)]'}`}>
                      {method==='card'&&<span className="text-[color:var(--text)] text-xs">✓</span>}
                    </div>
                  </div>
                  {method==='card'&&(
                    <div className="mt-4" onClick={e=>e.stopPropagation()}>
                      <BankCardForm
                        value={cardData}
                        onChange={(next)=>{ setCardData(next); setCardNum(next.number||''); }}
                        receiverCard={payType==='hall'?hallCard:artistCard}
                        amount={amount}
                      />
                    </div>
                  )}
                </button>

                {/* Наличными */}
                <button onClick={()=>setMethod(method==='cash'?null:'cash')}
                  className="w-full p-4 rounded-2xl border transition text-left"
                  style={{
                    background: method==='cash'?'rgba(16,185,129,0.08)':'var(--bg)',
                    borderColor: method==='cash'?'rgba(16,185,129,0.35)':'rgba(0,0,0,0.05)',
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💵</span>
                    <div className="flex-1">
                      <div className="text-[color:var(--text)] font-semibold text-sm">Наличными при встрече</div>
                      <div className="text-[color:var(--text2)] text-xs mt-0.5">Оплата в день мероприятия</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method==='cash'?'border-emerald-400 bg-emerald-400':'border-[color:var(--border)]'}`}>
                      {method==='cash'&&<span className="text-[color:var(--text)] text-xs">✓</span>}
                    </div>
                  </div>
                </button>
              </div>

              <button onClick={handlePay} disabled={!method||saving}
                className="w-full py-4 rounded-xl font-black text-[color:var(--text)] text-sm disabled:opacity-40 transition hover:opacity-88"
                style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)',boxShadow:'0 8px 24px rgba(201,168,76,0.25)'}}>
                {saving?'Обработка...':`Подтвердить оплату $${amount} →`}
              </button>
            </>
          )}

          {/* ── Step 4: done ── */}
          {step==='done'&&(
            <div className="text-center py-4">
              <motion.div animate={{scale:[0.8,1.1,1]}} transition={{duration:0.5}} className="text-6xl mb-4">🎉</motion.div>
              <h3 className="text-2xl font-black mb-2" style={{color:'#047857'}}>Оплата принята!</h3>
              <p className="text-[color:var(--text2)] text-sm mb-6">
                {method==='card'?'Ваш перевод зафиксирован':'Оплата наличными зарегистрирована'}
              </p>
              <div className="p-4 rounded-2xl mb-6 text-sm text-left space-y-2"
                style={{background:'rgba(52,211,153,0.07)',border:'1px solid rgba(52,211,153,0.2)'}}>
                {[
                  ['Объект', payType==='hall'?order.restaurant?.name:selArtist?.name],
                  ['Тип', depositMode==='deposit'?'Задаток 30%':'Полная оплата'],
                  ['Сумма', `$${amount} (${fmtUZS(amount)})`],
                  ['Дата', date],
                  ['Способ', method==='card'?`Карта •••• ${cardNum.replace(/\s/g,'').slice(-4)}`:'Наличными'],
                ].map(([l,v])=>(
                  <div key={l} className="flex justify-between text-xs">
                    <span style={{color:'var(--text2)'}}>{l}</span>
                    <span style={{color:'white',fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={downloadReceipt}
                  className="w-full py-3 rounded-xl font-bold text-[color:var(--text)] text-sm"
                  style={{background:'rgba(0,0,0,0.05)'}}>
                  📄 Скачать чек
                </button>
                <button onClick={onClose}
                  className="w-full py-3.5 rounded-xl font-bold text-[color:var(--text)] text-sm"
                  style={{background:'linear-gradient(135deg,#34d399,#059669)'}}>
                  Закрыть
                </button>
              </div>
            </div>
          )}

          {/* Back buttons */}
          {['hall','artist','method'].includes(step)&&(
            <button onClick={()=>setStep(step==='method'?(payType==='hall'?'hall':'artist'):'choose')}
              className="w-full py-2.5 rounded-xl text-xs font-medium"
              style={{color:'var(--text2)'}}>
              ← Назад
            </button>
          )}
        </div>
      </motion.div>
    </Overlay>
  );
};

const Overlay = ({onClick,children})=>(
  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
    className="fixed inset-0 z-[300] flex items-center justify-center p-4"
    style={{background:'rgba(30,24,16,0.45)',backdropFilter:'blur(12px)'}}
    onClick={onClick}>
    {children}
  </motion.div>
);

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast    = useToast();

  const [orders,         setOrders]         = useState([]);
  const [payments,       setPayments]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [approvalModal,  setApprovalModal]  = useState(null);
  const [rejectionModal, setRejectionModal] = useState(null);
  const [cancelModal,    setCancelModal]    = useState(null);
  const [cancelReason,   setCancelReason]   = useState('');
  const [cancelLoading,  setCancelLoading]  = useState(false);
  const [paymentModal,   setPaymentModal]   = useState(null);
  const [extraServices,  setExtraServices]  = useState([]);
  const [cortegeStation, setCortegeStation] = useState(null);

  const pollingRef      = useRef(null);
  const seenApprovals   = useRef(new Set(JSON.parse(localStorage.getItem('bay_seen_approvals')   ||'[]')));
  const seenRejections  = useRef(new Set(JSON.parse(localStorage.getItem('bay_seen_rej_checkout')||'[]')));

  useEffect(()=>{
    fetch(`${API}/extra_services`).then(r=>r.json()).then(setExtraServices).catch(()=>{});
    fetch(`${API}/cortege_stations`).then(r=>r.json()).then(d=>setCortegeStation(d[0]||null)).catch(()=>{});
  },[]);

  // ── Фикс: показываем брони только текущего пользователя ──────────────
  // Раньше при отсутствии clientId у заказа и/или user.id получалось
  // undefined === undefined → true, и показывались брони ВСЕХ клиентов.
  const isMine = (o) => {
    if (o.clientId) return !!user?.id && o.clientId === user.id;
    return !!user?.name && o.clientName === user.name;
  };

  const fetchOrders = async () => {
    try {
      const res  = await fetch(`${API}/wedding_orders`);
      const all  = await res.json();
      const mine = all.filter(isMine);
      setOrders(mine);
      setLoading(false);

      // Платежи — только те, что относятся к заказам этого пользователя
      const mineIds = new Set(mine.map(o=>o.id));
      fetch(`${API}/payments`).then(r=>r.json())
        .then(allPayments => setPayments(allPayments.filter(p=>mineIds.has(p.order_id))))
        .catch(()=>{});

      const newApproval = mine.find(o=>['approved','confirmed'].includes(o.status)&&!seenApprovals.current.has(o.id));
      if (newApproval) {
        seenApprovals.current.add(newApproval.id);
        localStorage.setItem('bay_seen_approvals', JSON.stringify([...seenApprovals.current]));
        setApprovalModal(newApproval);
        toast?.add(`🎉 ${newApproval.restaurant?.name||newApproval.artists?.[0]?.name||'Исполнитель'} принял вашу заявку!`,'success',7000);
      }
      const newRejection = mine.find(o=>o.status==='rejected'&&!seenRejections.current.has(o.id));
      if (newRejection) {
        seenRejections.current.add(newRejection.id);
        localStorage.setItem('bay_seen_rej_checkout', JSON.stringify([...seenRejections.current]));
        setRejectionModal(newRejection);
        toast?.add('К сожалению, заявка отклонена. Выберите другой вариант.','error',7000);
      }
    } catch { setLoading(false); }
  };

  useEffect(()=>{
    fetchOrders();
    pollingRef.current = setInterval(fetchOrders, 7000);
    return ()=>clearInterval(pollingRef.current);
  },[user]);

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await fetch(`${API}/wedding_orders/${cancelModal.orderId}`,{
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status:'cancelled',cancellation_reason:cancelReason}),
      });
      toast?.add('Бронирование отменено','warning');
      setCancelModal(null); setCancelReason(''); fetchOrders();
    } catch { toast?.add('Ошибка при отмене','error'); }
    setCancelLoading(false);
  };

  const downloadPDF = (order) => {
    const doc = new jsPDF();
    doc.setFontSize(22); doc.text('BAYRAMLY',20,20);
    doc.setFontSize(12);
    doc.text(`Договор: ${order.id}`,20,40);
    doc.text(`Статус: ${STATUS[order.status]?.label||order.status}`,20,50);
    doc.text(`Дата: ${order.date}`,20,60);
    doc.text(`Гостей: ${order.guests}`,20,70);
    doc.text(`Зал: ${order.restaurant?.name||'—'}`,20,90);
    const arts=(order.artists||(order.artist?[order.artist]:[])).map(a=>a.name).join(', ');
    doc.text(`Артисты: ${arts||'—'}`,20,100);
    doc.text(`Итого: $${order.total_price_usd}`,20,120);
    doc.save(`bayramly-${order.id}.pdf`);
    toast?.add('PDF скачан!','success');
  };

  const activeOrders   = orders.filter(o=>['pending','approved','confirmed'].includes(o.status));
  const historicOrders = orders.filter(o=>['rejected','cancelled','completed'].includes(o.status));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg)'}}>
      <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{borderColor:'rgba(201,168,76,0.2)',borderTopColor:'#C9A84C'}}/>
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-20 px-4" style={{background:'var(--bg)'}}>

      {/* Rejection */}
      <AnimatePresence>
        {rejectionModal&&<RejectionModal order={rejectionModal} onClose={()=>setRejectionModal(null)} onChooseOther={()=>navigate('/home')}/>}
      </AnimatePresence>

      {/* Payment */}
      <AnimatePresence>
        {paymentModal&&<PaymentModal order={paymentModal} onClose={()=>setPaymentModal(null)} onPaid={fetchOrders}/>}
      </AnimatePresence>

      {/* Approval */}
      <AnimatePresence>
        {approvalModal&&(
          <Overlay onClick={()=>setApprovalModal(null)}>
            <motion.div initial={{scale:0.8,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.8,opacity:0}}
              transition={{type:'spring',stiffness:280,damping:22}}
              className="w-full max-w-md rounded-3xl p-8 text-center border"
              style={{background:'linear-gradient(135deg,#0a1a0a,#0d1a10)',borderColor:'rgba(52,211,153,0.4)'}}
              onClick={e=>e.stopPropagation()}>
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-black mb-2" style={{color:'#047857'}}>Заявка подтверждена!</h2>
              <p className="text-sm mb-5" style={{color:'rgba(255,255,255,0.65)'}}>
                <strong style={{color:'white'}}>{approvalModal.restaurant?.name||approvalModal.artists?.[0]?.name||'Исполнитель'}</strong> принял вашу заявку
              </p>
              <div className="my-4 p-4 rounded-2xl text-sm text-left space-y-2"
                style={{background:'rgba(52,211,153,0.07)',border:'1px solid rgba(52,211,153,0.2)'}}>
                {[['Дата',approvalModal.date],['Гостей',approvalModal.guests],['Итого',`$${approvalModal.total_price_usd}`]].map(([l,v])=>(
                  <div key={l} className="flex justify-between text-xs">
                    <span style={{color:'var(--text2)'}}>{l}</span>
                    <span style={{color:l==='Итого'?'#6ee7b7':'white',fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={()=>{setPaymentModal(approvalModal);setApprovalModal(null);}}
                  className="w-full py-3.5 rounded-xl font-bold text-[color:var(--text)] text-sm"
                  style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
                  💳 Оплатить сейчас
                </button>
                <button onClick={()=>{downloadPDF(approvalModal);setApprovalModal(null);}}
                  className="w-full py-3 rounded-xl text-sm" style={{color:'var(--text2)'}}>
                  📄 Скачать смету
                </button>
                <button onClick={()=>setApprovalModal(null)} className="w-full py-2 rounded-xl text-xs" style={{color:'rgba(255,255,255,0.25)'}}>
                  Позже
                </button>
              </div>
            </motion.div>
          </Overlay>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelModal&&(
          <Overlay onClick={()=>setCancelModal(null)}>
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
              className="w-full max-w-sm rounded-3xl p-7 border"
              style={{background:'linear-gradient(135deg,#1a0a0a,#0d0d1a)',borderColor:'rgba(239,68,68,0.35)'}}
              onClick={e=>e.stopPropagation()}>
              <div className="text-3xl mb-4 text-center">⚠️</div>
              <h3 className="text-lg font-black mb-1 text-center" style={{color:'#dc2626'}}>Отменить бронирование?</h3>
              <p className="text-sm mb-4 text-center" style={{color:'var(--text2)'}}>{cancelModal.itemName}</p>
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-widest mb-2" style={{color:'var(--text2)'}}>Причина *</label>
                <textarea rows={3} value={cancelReason} onChange={e=>setCancelReason(e.target.value)}
                  placeholder="Напишите причину..."
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{background:'var(--bg)',border:'1px solid rgba(239,68,68,0.3)',color:'white'}}/>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{setCancelModal(null);setCancelReason('');}}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{background:'var(--bg)',color:'var(--text2)'}}>Назад</button>
                <button onClick={handleCancel} disabled={!cancelReason.trim()||cancelLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',color:'#f87171'}}>
                  {cancelLoading?'Отменяем...':'Отменить бронь'}
                </button>
              </div>
            </motion.div>
          </Overlay>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black" style={{color:'var(--text)'}}>Мои брони</h1>
            <p className="text-sm mt-1" style={{color:'var(--text2)'}}>
              {activeOrders.length>0?`${activeOrders.length} активных бронирований`:'Нет активных бронирований'}
            </p>
          </div>
          <button onClick={()=>navigate('/home')}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all w-fit"
            style={{background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.2)',color:'var(--gold,#C9A84C)'}}>
            + Новое событие
          </button>
        </div>

        {/* Empty */}
        {orders.length===0&&(
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-4xl"
              style={{background:'var(--bg)',border:'1px solid var(--border)'}}>📋</div>
            <h2 className="text-xl font-bold mb-2" style={{color:'var(--text)'}}>Бронирований пока нет</h2>
            <p className="text-sm mb-6" style={{color:'var(--text2)'}}>Перейдите в конструктор и создайте идеальный той</p>
            <button onClick={()=>navigate('/home')} className="px-7 py-3.5 rounded-xl font-bold text-[color:var(--text)] text-sm"
              style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
              Открыть конструктор
            </button>
          </div>
        )}

        {/* Active */}
        {activeOrders.length>0&&(
          <div className="space-y-4 mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{color:'var(--text2)'}}>Активные бронирования</h2>
            {activeOrders.map(order=>(
              <OrderCard key={order.id} order={order} extraServices={extraServices} cortegeStation={cortegeStation}
                onCancel={()=>setCancelModal({orderId:order.id,itemName:order.restaurant?.name||order.artists?.[0]?.name||'Бронирование'})}
                onDownload={()=>downloadPDF(order)}
                onPay={()=>setPaymentModal(order)}
                onRefunded={fetchOrders}/>
            ))}
          </div>
        )}

        {/* History */}
        {historicOrders.length>0&&(
          <div className="space-y-4 mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{color:'var(--text2)'}}>История</h2>
            {historicOrders.map(order=>(
              <OrderCard key={order.id} order={order} extraServices={extraServices} cortegeStation={cortegeStation}
                onDownload={()=>downloadPDF(order)} onRefunded={fetchOrders} readonly/>
            ))}
          </div>
        )}

        {/* Payment history */}
        {payments.length>0&&(
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{color:'var(--text2)'}}>История платежей</h2>
            {[...payments].sort((a,b)=>new Date(b.paid_at)-new Date(a.paid_at)).map(p=>(
              <div key={p.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border"
                style={{background:'var(--card)', borderColor:'var(--border)'}}>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{color:'var(--text)'}}>
                    {p.type==='hall'?'🏛':'🎤'} {p.targetName}{p.deposit&&<span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:'rgba(245,158,11,0.15)',color:'#f59e0b'}}>задаток</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{color:'var(--text2)'}}>
                    {p.method==='card'?`Карта${p.card_brand?` ${p.card_brand}`:''} •••• ${p.card_last4}`:'Наличные'} · {new Date(p.paid_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-sm" style={{color:'var(--gold)'}}>${p.amount_usd}</div>
                  <div className="text-[10px]" style={{color:'var(--text2)'}}>{fmtUZS(p.amount_usd)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────
function OrderCard({ order:o, extraServices, cortegeStation, onCancel, onDownload, onPay, onRefunded, readonly }) {
  const st        = STATUS[o.status]||STATUS.pending;
  const artists   = o.artists?.length>0?o.artists:(o.artist?[o.artist]:[]);
  const cars      = o.cars?.length>0?o.cars:(o.car?[o.car]:[]);
  const decors    = o.decors?.length>0?o.decors:(o.decor?[o.decor]:[]);
  const getDecorPhone = (d) => extraServices.find(s=>s.id===d?.id)?.contact_phone||'+998712223344';
  const getCarPhone   = (c) => c?.owner_phone||cortegeStation?.manager_phone||'+998901001001';

  const left            = daysUntil(o.date);
  const swapLocked       = left < 5;
  const hSt = hallStatusOf(o);
  const aSt = artistStatusOf(o);
  const bothOk = (
    (!o.restaurant || hSt === 'approved' || hSt === 'confirmed') &&
    (!((o.artists&&o.artists.length)||o.artist) || aSt === 'approved' || aSt === 'confirmed')
  );
  const needsPayment     = bothOk && !o.payment;
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundSent,    setRefundSent]    = useState(false);

  const requestRefund = async () => {
    setRefundLoading(true);
    try {
      await fetch(`${API}/refund_requests`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          id: 'REF-' + Date.now(),
          order_id: o.id,
          amount_usd: o.payment?.amount_usd || 0,
          reason: o.status === 'rejected' ? 'Заявка отклонена площадкой/артистом' : 'Бронирование отменено клиентом',
          status: 'pending',
          requested_at: new Date().toISOString(),
        }),
      });
      setRefundSent(true);
    } catch {}
    setRefundLoading(false);
  };

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
      className="rounded-2xl border overflow-hidden"
      style={{background:'var(--card)',borderColor:st.border}}>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b gap-2"
        style={{background:st.bg,borderColor:st.border}}>
        <div className="flex items-center gap-2 flex-wrap">
          {['approved','confirmed'].includes(o.status)&&<motion.div animate={{scale:[1,1.3,1]}} transition={{duration:1.5,repeat:Infinity}} className="w-2 h-2 rounded-full bg-emerald-400"/>}
          {o.status==='pending'&&<motion.div animate={{opacity:[1,0.4,1]}} transition={{duration:1.2,repeat:Infinity}} className="w-2 h-2 rounded-full bg-amber-400"/>}
          <span className="text-xs font-bold" style={{color:st.color}}>{st.label}</span>
          {o.payment&&<span className="text-xs px-2 py-0.5 rounded-full font-semibold border bg-purple-500/15 text-purple-400 border-purple-500/25">💳 Оплачен{o.payment.deposit?' (задаток)':''}</span>}
        </div>
        <span className="text-[10px] text-[color:var(--text2)] flex-shrink-0">{o.id?.slice(-14)}</span>
      </div>

      <div className="p-4 sm:p-5 space-y-4">

        {/* Напоминание об оплате / блокировке замены за 5 дней */}
        {needsPayment && Number.isFinite(left) && left <= 10 && (
          <div className="p-3 rounded-xl text-xs flex items-center gap-2"
            style={{
              background: left <= 5 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${left <= 5 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
              color: left <= 5 ? '#f87171' : '#fbbf24',
            }}>
            ⏳ {left >= 0 ? `Осталось ${left} дн. до тоя — оплатите бронь` : 'Дата тоя уже прошла'}
            {left <= 5 && left >= 0 && ' — смена зала/артиста больше недоступна'}
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoChip icon="📅" label="Дата" val={o.date||'—'}/>
          <InfoChip icon="👥" label="Гостей" val={`${o.guests||0} чел.`}/>
          <InfoChip icon="💰" label="Итого" val={`$${o.total_price_usd}`} gold/>
        </div>

        {/* Зал и Артисты — со статусом и телефоном */}
        {(o.restaurant||artists.length>0)&&(
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--text2)]">Зал и артисты</p>
            {o.restaurant&&<VenueRow icon="🏛" label="Зал" name={o.restaurant.name}
              price={fmtMln(o.restaurant.price_per_day_uzs)+' сум'} status={hallStatusOf(o)||'pending'}
              reason={o.restaurant_rejection_reason}/>}
            {artists.map((a,i)=><VenueRow key={i} icon="🎤" label="Артист" name={a.name}
              price={`$${a.price_per_hour_usd}/ч`} status={artistStatusOf(o)||'pending'}
              reason={o.artist_rejection_reason}/>)}
            {!readonly && swapLocked && (
              <p className="text-[10px] px-1" style={{color:'var(--text2)'}}>
                🔒 До тоя меньше 5 дней — зал/артиста в этой брони изменить нельзя
              </p>
            )}
          </div>
        )}

        {/* Причина отклонения/отмены */}
        {o.status==='rejected'&&o.rejection_reason&&(
          <div className="p-3 rounded-xl" style={{background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.2)'}}>
            <div className="text-[10px] uppercase tracking-widest mb-1 text-red-400">Причина отказа</div>
            <p className="text-xs text-[color:var(--text)]">{o.rejection_reason}</p>
          </div>
        )}
        {o.status==='cancelled'&&o.cancellation_reason&&(
          <div className="p-3 rounded-xl" style={{background:'rgba(148,163,184,0.06)',border:'1px solid rgba(148,163,184,0.15)'}}>
            <div className="text-[10px] uppercase tracking-widest mb-1 text-slate-400">Причина отмены</div>
            <p className="text-xs text-[color:var(--text2)]">{o.cancellation_reason}</p>
          </div>
        )}

        {/* Информация об оплате */}
        {o.payment&&(
          <div className="p-3 rounded-xl" style={{background:'rgba(139,92,246,0.07)',border:'1px solid rgba(139,92,246,0.2)'}}>
            <div className="text-[10px] uppercase tracking-widest mb-1 text-purple-400">Платёж</div>
            <div className="text-xs text-[color:var(--text)]">
              {o.payment.method==='card'?`Карта${o.payment.card_brand?` ${o.payment.card_brand}`:''} •••• ${o.payment.card_last4||'****'}`:'Наличные при встрече'}
              {' · '}{o.payment.type==='hall'?'Оплата зала':'Оплата артиста'}
              {' · '}<span className="text-purple-400 font-bold">${o.payment.amount_usd}</span>
              {o.payment.paid_at && <span className="text-[color:var(--text2)]"> · {new Date(o.payment.paid_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
            </div>
          </div>
        )}

        {/* Возврат средств — для отменённых/отклонённых оплаченных заказов */}
        {['rejected','cancelled'].includes(o.status) && o.payment && (
          <div className="p-3 rounded-xl flex items-center justify-between gap-3" style={{background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.2)'}}>
            <div className="text-xs text-[color:var(--text2)]">
              Бронь оплачена (${o.payment.amount_usd}), но не состоится. Можно запросить возврат средств.
            </div>
            {refundSent ? (
              <span className="text-xs font-bold flex-shrink-0" style={{color:'#34d399'}}>Запрос отправлен ✓</span>
            ) : (
              <button onClick={requestRefund} disabled={refundLoading}
                className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50"
                style={{background:'rgba(52,211,153,0.15)',color:'#34d399',border:'1px solid rgba(52,211,153,0.3)'}}>
                {refundLoading?'Отправка...':'Запросить возврат'}
              </button>
            )}
          </div>
        )}

        {/* Кортеж и Декор — без статуса, только телефоны */}
        {(cars.length>0||decors.length>0)&&(
          <div className="rounded-2xl p-4 space-y-2.5"
            style={{background:'var(--bg)',border:'1px solid rgba(0,0,0,0.04)'}}>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--text2)]">
              Кортеж и спецэффекты — свяжитесь напрямую
            </p>
            {cars.map((c,i)=><ContactRow key={i} icon="🚗" label="Кортеж" name={c.model}
              sub={`${c.color} · ${c.year} · $${c.price_per_day_usd}/д`} phone={getCarPhone(c)}/>)}
            {decors.map((d,i)=><ContactRow key={i} icon="✨" label="Декор" name={d.service_name}
              sub={fmtMln(d.price_uzs)+' сум'} phone={getDecorPhone(d)}/>)}
          </div>
        )}

        {/* Actions */}
        {!readonly&&(
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={onDownload}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text2)'}}>
              📄 Скачать смету
            </button>
            {['approved','confirmed'].includes(o.status)&&!o.payment&&(
              <button onClick={onPay}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[color:var(--text)] transition-all"
                style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)',boxShadow:'0 4px 16px rgba(201,168,76,0.25)'}}>
                💳 Оплатить заказ
              </button>
            )}
            {['approved','confirmed'].includes(o.status)&&o.payment&&(
              <button onClick={onPay}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.3)',color:'#a78bfa'}}>
                💳 Другой платёж
              </button>
            )}
            {['pending','approved','confirmed'].includes(o.status)&&(
              <button onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold ml-auto"
                style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>
                Отменить бронь
              </button>
            )}
          </div>
        )}
        {readonly&&(
          <button onClick={onDownload}
            className="px-4 py-2 rounded-xl text-xs font-semibold"
            style={{background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text2)'}}>
            📄 Архив — скачать смету
          </button>
        )}
      </div>
    </motion.div>
  );
}

const VenueRow = ({ icon, label, name, price, phone, status, reason }) => {
  const st = STATUS[status]||STATUS.pending;
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{background:'var(--bg)',border:'1px solid rgba(0,0,0,0.04)'}}>
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-[color:var(--text2)]">{label}</div>
        <div className="text-sm font-semibold truncate text-[color:var(--text)]">{name}</div>
        {/* Телефоны скрыты — связь только через платформу */}
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className="text-sm font-bold text-[#C9A84C]">{price}</span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
          style={{background:st.bg,borderColor:st.border,color:st.color}}>
          {status==='pending'&&<motion.span animate={{opacity:[1,0.3,1]}} transition={{duration:1.2,repeat:Infinity}}>●</motion.span>}
          {['approved','confirmed'].includes(status)&&<motion.span animate={{scale:[1,1.4,1]}} transition={{duration:1.5,repeat:Infinity}}>●</motion.span>}
          {['rejected','cancelled'].includes(status)&&'● '}
          {st.label}
        </span>
        {reason && status==='rejected' && (
          <span className="text-[10px] max-w-[140px] text-right" style={{color:'#dc2626'}}>{reason}</span>
        )}
      </div>
    </div>
  );
};

const ContactRow = ({ icon, label, name, sub, phone }) => (
  <div className="flex flex-wrap items-center gap-3 py-1.5">
    <span className="text-base flex-shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-[color:var(--text2)]">{label}</div>
      <div className="text-sm font-semibold truncate text-[color:var(--text)]">{name}</div>
      <div className="text-xs text-[color:var(--text2)]">{sub}</div>
    </div>
    <span className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0" style={{background:'rgba(var(--gold-rgb),0.08)',color:'var(--gold)'}}>через платформу</span>
  </div>
);

const InfoChip = ({ icon, label, val, gold }) => (
  <div className="p-3 rounded-xl" style={{background:'var(--bg)',border:'1px solid var(--border)'}}>
    <div className="text-lg mb-0.5">{icon}</div>
    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{color:'var(--text2)'}}>{label}</div>
    <div className="font-bold text-sm" style={{color:gold?'var(--gold,#C9A84C)':'var(--text)'}}>{val}</div>
  </div>
);