import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:5000';
const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const fmtMln = (v) => `${Math.round((v||0)/1e6)} млн`;

// ─── helpers ──────────────────────────────────────────────────────────────
const shortId = (id) => { const s = String(id||''); return s.length > 14 ? '…' + s.slice(-12) : s; };

const STATUS_MAP = {
  pending:   { label:'Ожидает',      cls:'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  approved:  { label:'Подтверждён',  cls:'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  confirmed: { label:'Подтверждён',  cls:'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  rejected:  { label:'Отклонён',     cls:'bg-red-500/15 text-red-400 border-red-500/25' },
  cancelled: { label:'Отменён',      cls:'bg-slate-500/15 text-slate-400 border-slate-500/25' },
  completed: { label:'Завершён',     cls:'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  paid:      { label:'Оплачен',      cls:'bg-purple-500/15 text-purple-400 border-purple-500/25' },
};
const Badge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${s.cls}`}>{s.label}</span>;
};

// ─── Sidebar tabs ─────────────────────────────────────────────────────────
const TABS = [
  { key:'overview',    icon:'◉', label:'Обзор' },
  { key:'orders',      icon:'📋', label:'Заказы' },
  { key:'payments',    icon:'💳', label:'Оплаты' },
  { key:'calendar',    icon:'📅', label:'Календарь' },
  { key:'pending',     icon:'⏳', label:'На одобрение' },
  { key:'restaurants', icon:'🏛', label:'Рестораны' },
  { key:'artists',     icon:'🎤', label:'Артисты' },
  { key:'users',       icon:'👥', label:'Пользователи' },
  { key:'analytics',   icon:'📊', label:'Аналитика' },
  { key:'settings',    icon:'⚙', label:'Настройки' },
];

// ─── Card component ───────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`rounded-2xl border ${className}`}
    style={{ background:'rgba(255,255,255,0.025)', borderColor:'rgba(255,255,255,0.07)' }}>
    {children}
  </div>
);

// ─── Stat tile ────────────────────────────────────────────────────────────
const Stat = ({ icon, label, value, sub, color = '#C9A84C' }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
      style={{ background:`${color}18`, border:`1px solid ${color}30` }}>
      {icon}
    </div>
    <div>
      <div className="text-white font-black text-xl leading-none">{value}</div>
      <div className="text-white/40 text-xs mt-1">{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color }}>{sub}</div>}
    </div>
  </Card>
);

// ─── MODALS ────────────────────────────────────────────────────────────────

// Детали заявки на одобрение
const PendingModal = ({ item, onClose, onApprove, onReject }) => {
  if (!item) return null;
  const isRest = item._type === 'restaurant';
  const rows = isRest ? [
    ['Название', item.name], ['Район', item.district], ['Адрес', item.address],
    ['Вместимость', item.max_capacity_people ? `${item.max_capacity_people} чел.` : '—'],
    ['Цена/день', item.price_per_day_uzs ? `${fmtMln(item.price_per_day_uzs)} сум` : '—'],
    ['Телефон', item.phone || item.admin_phone || '—'],
    ['Кухня', item.kitchen_type || '—'],
  ] : [
    ['Имя', item.name], ['Категория', item.category || '—'],
    ['Жанр', item.genre || '—'],
    ['Цена/час', item.price_per_hour_usd ? `$${item.price_per_hour_usd}` : '—'],
    ['Рейтинг', item.rating ?? '—'],
    ['Телефон', item.phone || item.admin_phone || '—'],
  ];
  return (
    <Overlay onClick={onClose}>
      <ModalBox>
        <div className="relative h-44 overflow-hidden rounded-t-3xl">
          <img src={item.image_url||'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'}
            className="w-full h-full object-cover" alt=""
            onError={e=>{e.target.src='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'}}/>
          <div className="absolute inset-0" style={{background:'linear-gradient(to top,rgba(5,5,15,0.95),transparent)'}}/>
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-black/50 text-white/60 hover:text-white flex items-center justify-center text-lg">×</button>
          <div className="absolute bottom-4 left-5 flex gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold border bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Ожидает одобрения</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${isRest?'bg-emerald-500/20 text-emerald-400 border-emerald-500/30':'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
              {isRest?'🏛 Ресторан':'🎤 Артист'}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-2">
          <h3 className="text-white font-black text-lg mb-4">{item.name || '—'}</h3>
          {rows.map(([l,v])=>(
            <div key={l} className="flex justify-between py-2 border-b border-white/5 text-sm">
              <span className="text-white/40 uppercase tracking-wider text-xs">{l}</span>
              <span className="text-white/80 text-right">{v}</span>
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button onClick={()=>{onApprove(item._type,item);onClose();}}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-85"
              style={{background:'linear-gradient(135deg,#10b981,#047857)'}}>✓ Одобрить</button>
            <button onClick={()=>{onReject(item._type,item);onClose();}}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition"
              style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171'}}>✕ Отклонить</button>
          </div>
        </div>
      </ModalBox>
    </Overlay>
  );
};

// Детали заказа
const OrderModal = ({ order, onClose }) => {
  if (!order) return null;
  const artists = order.artists?.length > 0 ? order.artists : (order.artist ? [order.artist] : []);
  const cars    = order.cars?.length > 0 ? order.cars : (order.car ? [order.car] : []);
  const decors  = order.decors?.length > 0 ? order.decors : (order.decor ? [order.decor] : []);
  return (
    <Overlay onClick={onClose}>
      <ModalBox>
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Детали заказа</p>
            <h3 className="text-white font-black text-base">{shortId(order.id)}</h3>
          </div>
          <div className="flex items-center gap-3">
            <Badge status={order.status}/>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white text-lg" style={{background:'rgba(255,255,255,0.06)'}}>×</button>
          </div>
        </div>
        <div className="p-6 space-y-3 max-h-[65vh] overflow-y-auto">
          {/* Клиент */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:'rgba(201,168,76,0.07)',border:'1px solid rgba(201,168,76,0.2)'}}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm"
              style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
              {(order.clientName||'G')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-sm">{order.clientName||'—'}</div>
              <div className="text-white/40 text-xs">{order.client?.phone||'—'}</div>
            </div>
            <div className="text-right">
              <div className="text-[#C9A84C] font-black">${order.total_price_usd||0}</div>
              <div className="text-white/30 text-xs">{order.date}</div>
            </div>
          </div>
          {/* Мета */}
          {[
            ['📅 Дата', order.date||'—'],
            ['👥 Гостей', `${order.guests||0} чел.`],
            ['🏛 Зал', order.restaurant?.name||'—'],
          ].map(([l,v])=>(
            <div key={l} className="flex justify-between py-1.5 border-b border-white/5 text-sm">
              <span className="text-white/40 text-xs">{l}</span>
              <span className="text-white/80 text-xs text-right">{v}</span>
            </div>
          ))}
          {/* Артисты */}
          {artists.length>0 && <div>
            <div className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Артисты</div>
            {artists.map((a,i)=>(
              <div key={i} className="flex items-center gap-2 py-1.5">
                <img src={a.image_url||''} alt="" className="w-8 h-8 rounded-full object-cover bg-white/10"
                  onError={e=>{e.target.style.display='none'}}/>
                <div className="text-sm text-white/80">{a.name}</div>
                <div className="ml-auto text-[#C9A84C] text-xs">${a.price_per_hour_usd}/ч</div>
              </div>
            ))}
          </div>}
          {/* Кортеж */}
          {cars.length>0 && <div>
            <div className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Кортеж</div>
            {cars.map((c,i)=><div key={i} className="text-xs text-white/60 py-1">{c.model} · {c.color} · ${c.price_per_day_usd}/д</div>)}
          </div>}
          {/* Декор */}
          {decors.length>0 && <div>
            <div className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Декор/Эффекты</div>
            {decors.map((d,i)=><div key={i} className="text-xs text-white/60 py-1">{d.service_name} · {fmtMln(d.price_uzs)} сум</div>)}
          </div>}
          {/* Платёж */}
          {order.payment && (
            <div className="p-3 rounded-xl" style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)'}}>
              <div className="text-purple-400 text-xs font-bold mb-1">💳 Платёж</div>
              <div className="text-sm text-white/70">{order.payment.method === 'card' ? `Карта •••• ${order.payment.card_last4||'****'}` : 'Наличные при встрече'}</div>
              <div className="text-xs text-white/40 mt-0.5">{order.payment.type === 'hall' ? 'Оплата зала' : 'Оплата артиста'} · {order.payment.paid_at?.slice(0,10)||'—'}</div>
            </div>
          )}
        </div>
      </ModalBox>
    </Overlay>
  );
};

// Платёж детали
const PaymentModal = ({ payment, onClose }) => {
  if (!payment) return null;
  return (
    <Overlay onClick={onClose}>
      <ModalBox>
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Детали платежа</p>
            <h3 className="text-white font-black text-base">#{payment.id?.slice(-10)}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white text-lg" style={{background:'rgba(255,255,255,0.06)'}}>×</button>
        </div>
        <div className="p-6 space-y-3">
          {[
            ['Клиент', payment.clientName||'—'],
            ['Тип', payment.type==='hall'?'Оплата зала':'Оплата артиста'],
            ['Объект', payment.targetName||'—'],
            ['Способ', payment.method==='card'?`Карта •••• ${payment.card_last4||'****'}`:'Наличные при встрече'],
            ['Сумма', `$${payment.amount_usd||0}`],
            ['Дата', payment.paid_at?.slice(0,10)||'—'],
            ['Заказ', payment.order_id||'—'],
          ].map(([l,v])=>(
            <div key={l} className="flex justify-between py-2 border-b border-white/5">
              <span className="text-white/40 text-xs uppercase tracking-wider">{l}</span>
              <span className="text-white/80 text-sm">{v}</span>
            </div>
          ))}
        </div>
      </ModalBox>
    </Overlay>
  );
};

// Редактирование
const EditModal = ({ item, type, onClose, onSave }) => {
  const [form, setForm] = useState({...item});
  if (!item) return null;
  const fields = type==='restaurant'
    ? ['name','district','address','phone','max_capacity_people','seating_capacity','price_per_day_uzs','waiters_count','stage_size','parking_spaces','kitchen_type','has_led_screen','image_url']
    : ['name','category','genre','price_per_hour_usd','rating','phone','admin_phone','image_url'];
  return (
    <Overlay onClick={onClose}>
      <ModalBox>
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <h3 className="text-white font-bold">✏️ Редактировать</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white text-lg" style={{background:'rgba(255,255,255,0.06)'}}>×</button>
        </div>
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {fields.map(k=>(
            <div key={k}>
              <label className="block text-white/40 text-xs uppercase tracking-wider mb-1">{k}</label>
              <input value={form[k]??''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#C9A84C]/50 transition"/>
            </div>
          ))}
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-white/50" style={{background:'rgba(255,255,255,0.04)'}}>Отмена</button>
          <button onClick={()=>onSave(form)} className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
            style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>Сохранить</button>
        </div>
      </ModalBox>
    </Overlay>
  );
};

const Overlay = ({onClick,children}) => (
  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(14px)'}}
    onClick={onClick}>
    {children}
  </motion.div>
);
const ModalBox = ({children}) => (
  <motion.div initial={{scale:0.9,opacity:0,y:20}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.9,opacity:0}}
    transition={{type:'spring',stiffness:280,damping:22}}
    className="w-full max-w-md rounded-3xl border overflow-hidden"
    style={{background:'linear-gradient(135deg,#08080f,#0d0d1a)',borderColor:'rgba(201,168,76,0.25)',maxHeight:'90vh'}}
    onClick={e=>e.stopPropagation()}>
    {children}
  </motion.div>
);

// ─── CALENDAR ─────────────────────────────────────────────────────────────
const Calendar = ({ orders }) => {
  const today = new Date();
  const [year,setYear] = useState(today.getFullYear());
  const [month,setMonth] = useState(today.getMonth());
  const [sel,setSel] = useState(null);
  const days = new Date(year,month+1,0).getDate();
  const first = (new Date(year,month,1).getDay()+6)%7;
  const byDate = {};
  orders.forEach(o=>{ if(!o.date) return; const k=o.date.slice(0,10); if(!byDate[k]) byDate[k]=[]; byDate[k].push(o); });
  const todayStr = today.toISOString().slice(0,10);
  const prev = ()=>{ month===0?(setYear(y=>y-1),setMonth(11)):setMonth(m=>m-1); setSel(null); };
  const next = ()=>{ month===11?(setYear(y=>y+1),setMonth(0)):setMonth(m=>m+1); setSel(null); };
  const cells = [...Array(first).fill(null),...Array(days).fill(0).map((_,i)=>i+1)];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold">📅 Календарь свадеб</h2>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition" style={{background:'rgba(255,255,255,0.06)'}}>‹</button>
          <span className="text-white text-sm font-semibold min-w-[140px] text-center">{MONTHS_FULL[month]} {year}</span>
          <button onClick={next} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition" style={{background:'rgba(255,255,255,0.06)'}}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_RU.map(d=><div key={d} className="text-center text-white/25 text-xs py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const k=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const cnt=(byDate[k]||[]).length;
          const isToday=k===todayStr;
          const isSel=sel===day;
          return (
            <button key={day} onClick={()=>setSel(isSel?null:day)}
              className={`relative rounded-xl min-h-[40px] flex flex-col items-center py-1.5 transition-all text-xs
                ${isToday?'ring-1 ring-[#C9A84C]/60':''}
                ${isSel?'bg-[#C9A84C]/20 border border-[#C9A84C]/40':'hover:bg-white/6'}`}
              style={{background:isSel?undefined:'rgba(255,255,255,0.02)'}}>
              <span className={`font-semibold ${isToday?'text-[#C9A84C]':'text-white/75'}`}>{day}</span>
              {cnt>0&&<span className="mt-0.5 w-1.5 h-1.5 rounded-full" style={{background:'#C9A84C'}}/>}
            </button>
          );
        })}
      </div>
      {sel&&(()=>{
        const k=`${year}-${String(month+1).padStart(2,'0')}-${String(sel).padStart(2,'0')}`;
        const list=byDate[k]||[];
        return (
          <div className="mt-4 pt-4 border-t border-white/8">
            <div className="text-white/40 text-xs mb-2">{sel} {MONTHS_FULL[month]} — {list.length} заказов</div>
            {list.length===0?<div className="text-white/25 text-sm text-center py-2">Нет заказов</div>:
              list.map(o=>(
                <div key={o.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <span className="text-base">{o.restaurant?'🏛':'🎤'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{o.restaurant?.name||o.artists?.[0]?.name||'—'}</div>
                    <div className="text-white/35 text-xs">{o.clientName||'—'} · ${o.total_price_usd||0}</div>
                  </div>
                  <Badge status={o.status}/>
                </div>
              ))
            }
          </div>
        );
      })()}
    </Card>
  );
};

// ─── PAYMENTS TAB ─────────────────────────────────────────────────────────
const PaymentsTab = ({ payments, onDetail }) => {
  const total = payments.reduce((s,p)=>s+(Number(p.amount_usd)||0),0);
  const byCard = payments.filter(p=>p.method==='card');
  const byCash = payments.filter(p=>p.method==='cash');
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon="💰" label="Общая сумма платежей" value={`$${total.toLocaleString()}`} color="#C9A84C"/>
        <Stat icon="💳" label="Оплачено картой" value={byCard.length} sub={`$${byCard.reduce((s,p)=>s+(p.amount_usd||0),0).toLocaleString()}`} color="#8b5cf6"/>
        <Stat icon="💵" label="Наличными" value={byCash.length} sub={`$${byCash.reduce((s,p)=>s+(p.amount_usd||0),0).toLocaleString()}`} color="#10b981"/>
      </div>

      {payments.length===0?(
        <div className="text-center py-24">
          <div className="text-5xl mb-4">💳</div>
          <p className="text-white/30">Платежей пока нет</p>
        </div>
      ):(
        <Card>
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-b text-white/30 text-xs uppercase tracking-wider" style={{borderColor:'rgba(255,255,255,0.07)'}}>
            <span>Заказ / Клиент</span><span>Объект</span><span>Тип</span><span>Способ</span><span>Сумма</span><span>Дата</span>
          </div>
          <div className="divide-y" style={{borderColor:'rgba(255,255,255,0.05)'}}>
            {payments.map(p=>(
              <div key={p.id} onClick={()=>onDetail(p)}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3.5 hover:bg-white/4 cursor-pointer transition">
                <div>
                  <div className="text-white text-sm font-medium">{p.clientName||'—'}</div>
                  <div className="text-white/30 text-xs font-mono">{p.order_id?.slice(-10)}</div>
                </div>
                <div className="text-white/70 text-sm truncate">{p.targetName||'—'}</div>
                <div><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type==='hall'?'bg-emerald-500/15 text-emerald-400':'bg-blue-500/15 text-blue-400'}`}>{p.type==='hall'?'Зал':'Артист'}</span></div>
                <div><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.method==='card'?'bg-purple-500/15 text-purple-400':'bg-green-500/15 text-green-400'}`}>{p.method==='card'?'Карта':'Нал.'}</span></div>
                <div className="text-[#C9A84C] font-bold text-sm">${p.amount_usd||0}</div>
                <div className="text-white/40 text-xs">{p.paid_at?.slice(0,10)||'—'}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── ANALYTICS TAB ────────────────────────────────────────────────────────
const AnalyticsTab = ({ orders, restaurants, artists, payments }) => {
  // Revenue by month
  const monthly = {};
  orders.forEach(o=>{ if(!o.date||!o.total_price_usd) return; const k=o.date.slice(0,7); monthly[k]=(monthly[k]||0)+Number(o.total_price_usd); });
  const sorted = Object.entries(monthly).sort().slice(-6);
  const maxRev = Math.max(...sorted.map(([,v])=>v),1);

  // Top artists
  const artCounts = {};
  orders.forEach(o=>(o.artists||[]).forEach(a=>{ artCounts[a.id]=(artCounts[a.id]||{name:a.name,count:0,rev:0}); artCounts[a.id].count++; artCounts[a.id].rev+=o.total_price_usd||0; }));
  const topArtists = Object.values(artCounts).sort((a,b)=>b.count-a.count).slice(0,5);

  // Status pie
  const stCounts = {};
  orders.forEach(o=>{ const s=o.status||'pending'; stCounts[s]=(stCounts[s]||0)+1; });

  const totalPaid = payments.reduce((s,p)=>s+(Number(p.amount_usd)||0),0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat icon="💰" label="Общий доход" value={`$${orders.reduce((s,o)=>s+(Number(o.total_price_usd)||0),0).toLocaleString()}`} color="#C9A84C"/>
        <Stat icon="💳" label="Оплачено" value={`$${totalPaid.toLocaleString()}`} color="#8b5cf6"/>
        <Stat icon="📊" label="Конверсия (опл/заказ)" value={orders.length?`${Math.round((payments.length/orders.length)*100)}%`:'—'} color="#10b981"/>
        <Stat icon="📋" label="Средний чек" value={orders.length?`$${Math.round(orders.reduce((s,o)=>s+(Number(o.total_price_usd)||0),0)/orders.length)}`:'—'} color="#f59e0b"/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue chart */}
        <Card className="p-5">
          <h3 className="text-white font-bold mb-4">📈 Доход по месяцам (USD)</h3>
          {sorted.length===0?<div className="text-white/25 text-center py-8">Нет данных</div>:(
            <div className="flex items-end gap-2 h-36">
              {sorted.map(([m,v])=>(
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[#C9A84C] text-xs font-bold">${Math.round(v/1000)}к</span>
                  <div className="w-full rounded-t-lg transition-all" style={{height:`${(v/maxRev)*100}px`,background:'linear-gradient(180deg,#C9A84C,#7A5C1E)'}}/>
                  <span className="text-white/30 text-[10px]">{m.slice(5)}/{m.slice(2,4)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        {/* Top artists */}
        <Card className="p-5">
          <h3 className="text-white font-bold mb-4">🏆 Топ артисты по заказам</h3>
          {topArtists.length===0?<div className="text-white/25 text-center py-8">Нет данных</div>:(
            <div className="space-y-3">
              {topArtists.map((a,i)=>(
                <div key={i} className="flex items-center gap-3">
                  <span className="text-white/30 text-sm w-5">{i+1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/80">{a.name}</span>
                      <span className="text-[#C9A84C] font-bold">{a.count} заказов</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                      <div className="h-full rounded-full" style={{width:`${(a.count/topArtists[0].count)*100}%`,background:'linear-gradient(90deg,#C9A84C,#7A5C1E)'}}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        {/* Status breakdown */}
        <Card className="p-5">
          <h3 className="text-white font-bold mb-4">📊 Статусы заказов</h3>
          {[
            {key:'approved',  label:'Подтверждено', color:'#10b981'},
            {key:'confirmed', label:'Подтверждено', color:'#10b981'},
            {key:'pending',   label:'Ожидает',      color:'#f59e0b'},
            {key:'rejected',  label:'Отклонено',    color:'#ef4444'},
            {key:'cancelled', label:'Отменено',     color:'#94a3b8'},
            {key:'completed', label:'Завершено',    color:'#3b82f6'},
          ].filter((s,i,arr)=>arr.findIndex(x=>x.key===s.key)===i).map(s=>{
            const cnt = stCounts[s.key]||0;
            if(!cnt) return null;
            return (
              <div key={s.key} className="flex items-center justify-between py-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:s.color}}/>
                  <span className="text-white/60 text-sm">{s.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                    <div className="h-full rounded-full" style={{width:`${(cnt/orders.length)*100}%`,background:s.color}}/>
                  </div>
                  <span className="text-white/50 text-sm w-8 text-right">{cnt}</span>
                </div>
              </div>
            );
          })}
        </Card>
        {/* Payments by type */}
        <Card className="p-5">
          <h3 className="text-white font-bold mb-4">💳 Платежи по способам</h3>
          {[
            {key:'card', label:'Картой', icon:'💳', color:'#8b5cf6'},
            {key:'cash', label:'Наличными', icon:'💵', color:'#10b981'},
          ].map(m=>{
            const cnt = payments.filter(p=>p.method===m.key).length;
            const total = payments.filter(p=>p.method===m.key).reduce((s,p)=>s+(Number(p.amount_usd)||0),0);
            return (
              <div key={m.key} className="flex items-center gap-4 py-3 border-b border-white/5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{background:`${m.color}18`}}>{m.icon}</div>
                <div className="flex-1">
                  <div className="text-white text-sm">{m.label}</div>
                  <div className="text-white/40 text-xs">{cnt} транзакций</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm" style={{color:m.color}}>${total.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
};

// ─── SETTINGS TAB ────────────────────────────────────────────────────────
const SettingsTab = ({ user, onLogout }) => (
  <div className="max-w-lg space-y-4">
    <Card className="p-5">
      <h3 className="text-white font-bold mb-4">👤 Аккаунт администратора</h3>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black text-white"
          style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
          {(user?.name||'A')[0].toUpperCase()}
        </div>
        <div>
          <div className="text-white font-bold">{user?.name||'Admin'}</div>
          <div className="text-white/40 text-sm mt-0.5">Роль: Администратор</div>
          <div className="text-white/30 text-xs mt-0.5">ID: {user?.id||'—'}</div>
        </div>
      </div>
    </Card>
    <Card className="p-5">
      <h3 className="text-white font-bold mb-4">⚙️ Системная информация</h3>
      {[
        ['Сервер API', API],
        ['Версия', 'BAYRAMLY Admin v2.0'],
        ['База данных', 'JSON Server'],
      ].map(([l,v])=>(
        <div key={l} className="flex justify-between py-2.5 border-b border-white/5 text-sm">
          <span className="text-white/40 text-xs uppercase tracking-wider">{l}</span>
          <span className="text-white/70 font-mono text-xs">{v}</span>
        </div>
      ))}
    </Card>
    <button onClick={onLogout}
      className="w-full py-3 rounded-xl font-bold text-sm transition hover:opacity-85"
      style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171'}}>
      Выйти из панели
    </button>
  </div>
);

// ─── ENTITY GRID (restaurants / artists) ─────────────────────────────────
const EntityGrid = ({ items, type, onEdit, onDelete }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.length===0&&(
      <div className="col-span-full text-center py-24">
        <div className="text-5xl mb-4">{type==='restaurant'?'🏛':'🎤'}</div>
        <p className="text-white/25">Пусто</p>
      </div>
    )}
    {items.map(item=>(
      <Card key={item.id} className="overflow-hidden hover:border-white/15 transition-all group">
        <div className="relative h-40 overflow-hidden">
          <img src={item.image_url||'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400'} alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={e=>{e.target.src='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400'}}/>
          <div className="absolute inset-0" style={{background:'linear-gradient(to top,rgba(0,0,0,0.75),transparent)'}}/>
          {item.payment_card && (
            <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{background:'rgba(139,92,246,0.9)',backdropFilter:'blur(8px)',color:'white'}}>
              💳 •••• {item.payment_card.slice(-4)}
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-white font-bold text-sm truncate">{item.name||'—'}</div>
          <div className="text-white/35 text-xs mt-0.5 truncate">
            {type==='restaurant'?`${item.district} · ${item.kitchen_type||'—'}`:`${item.genre||'—'} · ${item.category||'—'}`}
          </div>
          <div className="text-[#C9A84C] font-bold text-sm mt-2">
            {type==='restaurant'?`${fmtMln(item.price_per_day_uzs)} сум/д`:`$${item.price_per_hour_usd||0}/ч`}
          </div>
          {(item.phone||item.admin_phone)&&(
            <div className="text-white/40 text-xs mt-1">📞 {item.phone||item.admin_phone}</div>
          )}
          {item.payment_card&&(
            <div className="mt-2 px-2.5 py-1.5 rounded-lg text-xs"
              style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
              💳 Карта оплаты: •••• {item.payment_card.slice(-4)}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={()=>onEdit(item)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition"
              style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',color:'#93c5fd'}}>
              ✏️ Изменить
            </button>
            <button onClick={()=>onDelete(item.id)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition"
              style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>
              🗑 Удалить
            </button>
          </div>
        </div>
      </Card>
    ))}
  </div>
);

// ─── ORDERS TAB ──────────────────────────────────────────────────────────
const OrdersTab = ({ orders, onDetail }) => {
  const [filter,setFilter] = useState('all');
  const [search,setSearch] = useState('');
  const filtered = orders
    .filter(o=>filter==='all'||(o.status||'pending')===filter)
    .filter(o=>!search||JSON.stringify(o).toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {k:'all',      label:'Все',          value:orders.length,                                  color:'text-white'},
          {k:'approved', label:'Подтверждено', value:orders.filter(o=>['approved','confirmed'].includes(o.status)).length, color:'text-emerald-400'},
          {k:'pending',  label:'Ожидает',      value:orders.filter(o=>o.status==='pending').length,  color:'text-amber-400'},
          {k:'cancelled',label:'Отменено',     value:orders.filter(o=>o.status==='cancelled').length,color:'text-red-400'},
        ].map(s=>(
          <button key={s.k} onClick={()=>setFilter(s.k)}
            className={`p-3 rounded-xl text-center transition border ${filter===s.k?'border-[#C9A84C]/40':'border-white/6 hover:border-white/15'}`}
            style={{background:filter===s.k?'rgba(201,168,76,0.08)':'rgba(255,255,255,0.025)'}}>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-white/40 text-xs mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Поиск по заказам..."
        className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#C9A84C]/40 transition"/>
      {filtered.length===0?<div className="text-center py-20 text-white/25"><div className="text-5xl mb-3">📭</div><p>Нет заказов</p></div>:(
        <Card>
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-b text-white/25 text-xs uppercase tracking-wider" style={{borderColor:'rgba(255,255,255,0.07)'}}>
            <span>Клиент</span><span>Место</span><span>Дата</span><span>Гости</span><span>Сумма</span><span>Статус</span>
          </div>
          <div className="divide-y" style={{borderColor:'rgba(255,255,255,0.05)'}}>
            {filtered.map(o=>(
              <div key={o.id} onClick={()=>onDetail(o)}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3.5 hover:bg-white/4 cursor-pointer transition">
                <div>
                  <div className="text-white text-sm font-medium">{o.clientName||'—'}</div>
                  <div className="text-white/30 text-xs font-mono">{o.id?.slice(-10)}</div>
                </div>
                <div className="text-white/70 text-sm truncate">{o.restaurant?.name||o.artists?.[0]?.name||'—'}</div>
                <div className="text-white/50 text-sm">{o.date||'—'}</div>
                <div className="text-white/50 text-sm">{o.guests||'—'}</div>
                <div className="text-[#C9A84C] font-bold text-sm">${o.total_price_usd||0}</div>
                <Badge status={o.status}/>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [loginInput,    setLoginInput]    = useState('');
  const [passInput,     setPassInput]     = useState('');
  const [loginErr,      setLoginErr]      = useState('');
  const [loginLoading,  setLoginLoading]  = useState(false);

  const [tab,           setTab]           = useState('overview');
  const [sidebarOpen,   setSidebarOpen]   = useState(false);

  const [restaurants,   setRestaurants]   = useState([]);
  const [artists,       setArtists]       = useState([]);
  const [pendingRest,   setPendingRest]   = useState([]);
  const [pendingArt,    setPendingArt]    = useState([]);
  const [orders,        setOrders]        = useState([]);
  const [users,         setUsers]         = useState([]);
  const [payments,      setPayments]      = useState([]);
  const [loading,       setLoading]       = useState(false);

  const [pendingModal,  setPendingModal]  = useState(null);
  const [orderModal,    setOrderModal]    = useState(null);
  const [editModal,     setEditModal]     = useState(null);
  const [editType,      setEditType]      = useState(null);
  const [paymentModal,  setPaymentModal]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r,a,o,u,p] = await Promise.all([
        fetch(`${API}/restaurants`).then(x=>x.json()),
        fetch(`${API}/artists`).then(x=>x.json()),
        fetch(`${API}/wedding_orders`).then(x=>x.json()).catch(()=>[]),
        fetch(`${API}/users`).then(x=>x.json()).catch(()=>[]),
        fetch(`${API}/payments`).then(x=>x.json()).catch(()=>[]),
      ]);
      setRestaurants(r.filter(x=>!x.pending));
      setPendingRest(r.filter(x=>x.pending));
      setArtists(a.filter(x=>!x.pending));
      setPendingArt(a.filter(x=>x.pending));
      setOrders(o);
      setUsers(u);
      setPayments(p);
    } catch(e){ console.error(e); }
    setLoading(false);
  }, []);

  useEffect(()=>{ if(user?.role==='admin') load(); },[user,load]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginErr(''); setLoginLoading(true);
    const r = await login(loginInput, passInput, 'admin');
    setLoginLoading(false);
    if (!r.success) setLoginErr(r.error);
  };

  const approve = async (type, item) => {
    const ep = type==='restaurant'?'restaurants':'artists';
    await fetch(`${API}/${ep}/${item.id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pending:false}) });
    load();
  };
  const reject = async (type, item) => {
    if(!confirm('Отклонить и удалить?')) return;
    const ep = type==='restaurant'?'restaurants':'artists';
    await fetch(`${API}/${ep}/${item.id}`,{ method:'DELETE' });
    load();
  };
  const deleteItem = async (type, id) => {
    if(!confirm('Удалить?')) return;
    const ep = type==='restaurant'?'restaurants':'artists';
    await fetch(`${API}/${ep}/${id}`,{ method:'DELETE' });
    load();
  };
  const saveEdit = async (form) => {
    const ep = editType==='restaurant'?'restaurants':'artists';
    await fetch(`${API}/${ep}/${form.id}`,{ method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
    setEditModal(null);
    load();
  };

  // ── Login screen ──────────────────────────────────────────────────────
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{background:'#05050d'}}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-black text-white"
              style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>B</div>
            <h1 className="text-2xl font-black text-white">BAYRAMLY Admin</h1>
            <p className="text-white/30 text-sm mt-1">Панель управления платформой</p>
          </div>
          <Card className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {[{l:'Логин',p:'admin',v:loginInput,s:setLoginInput,t:'text'},{l:'Пароль',p:'••••••••',v:passInput,s:setPassInput,t:'password'}].map(f=>(
                <div key={f.l}>
                  <label className="block text-white/40 text-xs uppercase tracking-wider mb-1.5">{f.l}</label>
                  <input type={f.t} value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p} required autoComplete={f.t==='password'?'current-password':'username'}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition"
                    style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}/>
                </div>
              ))}
              {loginErr&&<div className="px-4 py-3 rounded-xl text-red-400 text-sm text-center" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)'}}>{loginErr}</div>}
              <button type="submit" disabled={loginLoading}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-50 transition hover:opacity-85"
                style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
                {loginLoading?'Вход...':'Войти'}
              </button>
            </form>
          </Card>
          <button onClick={()=>navigate('/')} className="mt-4 w-full text-center text-white/25 text-xs hover:text-white/50 transition">← На главную</button>
        </div>
      </div>
    );
  }

  const allPending = [...pendingRest.map(x=>({...x,_type:'restaurant'})),...pendingArt.map(x=>({...x,_type:'artist'}))];
  const totalRevenue = orders.reduce((s,o)=>s+(Number(o.total_price_usd)||0),0);
  const totalPaid = payments.reduce((s,p)=>s+(Number(p.amount_usd)||0),0);
  const confirmedOrders = orders.filter(o=>['approved','confirmed'].includes(o.status)).length;

  return (
    <div className="min-h-screen flex" style={{background:'#05050d'}}>

      {/* ── Sidebar ── */}
      <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ${sidebarOpen?'w-56':'w-16'} lg:relative lg:flex`}
        style={{background:'rgba(8,8,18,0.97)',borderRight:'1px solid rgba(255,255,255,0.06)'}}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
            style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>B</div>
          {sidebarOpen&&<span className="text-white font-black tracking-wider text-sm whitespace-nowrap">BAYRAMLY<span style={{color:'#C9A84C'}}>.ai</span></span>}
        </div>
        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {TABS.map(t=>(
            <button key={t.key}
              onClick={()=>{ setTab(t.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all relative ${tab===t.key?'text-[#C9A84C]':'text-white/40 hover:text-white/70'}`}
              style={{background:tab===t.key?'rgba(201,168,76,0.08)':undefined}}>
              {tab===t.key&&<span className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full" style={{background:'#C9A84C'}}/>}
              <span className="text-base flex-shrink-0">{t.icon}</span>
              {sidebarOpen&&(
                <span className="text-sm font-medium whitespace-nowrap">{t.label}
                  {t.key==='pending'&&allPending.length>0&&<span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{allPending.length}</span>}
                </span>
              )}
              {!sidebarOpen&&t.key==='pending'&&allPending.length>0&&(
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400"/>
              )}
            </button>
          ))}
        </nav>
        {/* Toggle */}
        <button onClick={()=>setSidebarOpen(x=>!x)}
          className="flex items-center justify-center py-4 border-t text-white/30 hover:text-white transition"
          style={{borderColor:'rgba(255,255,255,0.06)'}}>
          <span className="text-lg">{sidebarOpen?'←':'→'}</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 flex flex-col" style={{marginLeft: sidebarOpen?0:undefined}}>
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 h-14 sticky top-0 z-30"
          style={{background:'rgba(5,5,13,0.95)',borderBottom:'1px solid rgba(255,255,255,0.06)',backdropFilter:'blur(12px)'}}>
          <div className="flex items-center gap-3">
            <button onClick={()=>setSidebarOpen(x=>!x)} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white" style={{background:'rgba(255,255,255,0.05)'}}>☰</button>
            <div>
              <h1 className="text-white font-bold text-sm">{TABS.find(t=>t.key===tab)?.label}</h1>
              {loading&&<span className="text-white/30 text-xs">Обновление...</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allPending.length>0&&(
              <button onClick={()=>setTab('pending')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.3)',color:'#fbbf24'}}>
                ⏳ {allPending.length}
              </button>
            )}
            <button onClick={load} disabled={loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition disabled:opacity-30"
              style={{background:'rgba(255,255,255,0.05)'}}>
              ↻
            </button>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
              {(user?.name||'A')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.15}}>

              {/* ── OVERVIEW ── */}
              {tab==='overview'&&(
                <div className="space-y-5">
                  {/* Pending alert */}
                  {allPending.length>0&&(
                    <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
                      className="flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer"
                      style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.25)'}}
                      onClick={()=>setTab('pending')}>
                      <motion.span animate={{scale:[1,1.2,1]}} transition={{duration:1.5,repeat:Infinity}} className="text-2xl">🔔</motion.span>
                      <div className="flex-1">
                        <div className="text-amber-400 font-semibold text-sm">{allPending.length} заявок ждут одобрения</div>
                        <div className="text-amber-400/50 text-xs mt-0.5">Нажмите чтобы перейти</div>
                      </div>
                      <span className="text-amber-400/60 text-sm">→</span>
                    </motion.div>
                  )}
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat icon="👥" label="Пользователей"   value={users.length} color="#3b82f6"/>
                    <Stat icon="💍" label="Заказов"          value={orders.length} color="#C9A84C"/>
                    <Stat icon="✅" label="Подтверждено"     value={confirmedOrders} color="#10b981"/>
                    <Stat icon="💰" label="Доход (USD)"      value={`$${(totalRevenue/1000).toFixed(0)}к`} color="#C9A84C"/>
                    <Stat icon="💳" label="Оплачено (USD)"   value={`$${totalPaid.toLocaleString()}`} color="#8b5cf6"/>
                    <Stat icon="🏛" label="На платформе"     value={restaurants.length+artists.length} color="#f59e0b"/>
                  </div>
                  {/* Recent orders */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <Card className="p-5">
                        <h3 className="text-white font-bold mb-4">📋 Последние заказы</h3>
                        {orders.slice(-8).reverse().map(o=>(
                          <div key={o.id} onClick={()=>setOrderModal(o)}
                            className="flex items-center gap-3 py-2.5 border-b border-white/5 hover:bg-white/4 cursor-pointer transition rounded-lg px-2 -mx-2">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style={{background:'rgba(201,168,76,0.1)'}}>
                              {o.restaurant?'🏛':'🎤'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{o.restaurant?.name||o.artists?.[0]?.name||'—'}</div>
                              <div className="text-white/35 text-xs">{o.clientName||'—'} · {o.date}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[#C9A84C] font-bold text-sm">${o.total_price_usd||0}</span>
                              <Badge status={o.status}/>
                            </div>
                          </div>
                        ))}
                      </Card>
                    </div>
                    <div className="space-y-4">
                      {/* Recent payments */}
                      <Card className="p-5">
                        <h3 className="text-white font-bold mb-3">💳 Последние платежи</h3>
                        {payments.length===0?<div className="text-white/25 text-sm text-center py-4">Пока нет платежей</div>:
                          payments.slice(-5).reverse().map(p=>(
                            <div key={p.id} onClick={()=>setPaymentModal(p)}
                              className="flex items-center justify-between py-2 border-b border-white/5 cursor-pointer hover:bg-white/4 rounded transition px-1">
                              <div>
                                <div className="text-white text-xs font-medium">{p.clientName||'—'}</div>
                                <div className="text-white/30 text-[10px]">{p.type==='hall'?'Зал':'Артист'} · {p.method==='card'?'Карта':'Нал.'}</div>
                              </div>
                              <div className="text-[#C9A84C] font-bold text-sm">${p.amount_usd||0}</div>
                            </div>
                          ))
                        }
                      </Card>
                      {/* Activity */}
                      <Card className="p-5">
                        <h3 className="text-white font-bold mb-3">🔔 Активность</h3>
                        <div className="space-y-2.5">
                          {[
                            ...orders.slice(-2).map(o=>({icon:'💍',text:`Заказ от ${o.clientName||'клиента'}`,color:'text-[#C9A84C]'})),
                            ...allPending.slice(0,2).map(i=>({icon:'⏳',text:`${i._type==='restaurant'?'Ресторан':'Артист'}: ${i.name} ждёт одобрения`,color:'text-amber-400'})),
                            ...payments.slice(-2).map(p=>({icon:'💳',text:`Оплата $${p.amount_usd} от ${p.clientName||'—'}`,color:'text-purple-400'})),
                          ].slice(0,5).map((f,i)=>(
                            <div key={i} className="flex items-start gap-2">
                              <span className={`text-base flex-shrink-0 ${f.color}`}>{f.icon}</span>
                              <span className="text-white/60 text-xs">{f.text}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ORDERS ── */}
              {tab==='orders'&&<OrdersTab orders={orders} onDetail={setOrderModal}/>}

              {/* ── PAYMENTS ── */}
              {tab==='payments'&&<PaymentsTab payments={payments} onDetail={setPaymentModal}/>}

              {/* ── CALENDAR ── */}
              {tab==='calendar'&&<Calendar orders={orders}/>}

              {/* ── PENDING ── */}
              {tab==='pending'&&(
                <div className="space-y-3">
                  {allPending.length===0&&(
                    <div className="text-center py-24">
                      <div className="text-5xl mb-4">✅</div>
                      <p className="text-white/25">Нет заявок на одобрение</p>
                    </div>
                  )}
                  {allPending.map(item=>(
                    <Card key={item.id} className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{background:'rgba(255,255,255,0.06)'}}>
                          <img src={item.image_url||'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=100'} alt=""
                            className="w-full h-full object-cover"
                            onError={e=>{e.target.src='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=100'}}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold truncate">{item.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${item._type==='restaurant'?'bg-emerald-500/15 text-emerald-400 border-emerald-500/25':'bg-blue-500/15 text-blue-400 border-blue-500/25'}`}>
                              {item._type==='restaurant'?'🏛 Ресторан':'🎤 Артист'}
                            </span>
                          </div>
                          <div className="text-white/35 text-xs mt-0.5">
                            {item._type==='restaurant'?`${item.district} · ${item.address}`:`${item.genre} · ${item.admin_phone}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={()=>setPendingModal(item)} className="px-3 py-2 rounded-xl text-xs font-medium transition" style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)'}}>👁 Детали</button>
                        <button onClick={()=>approve(item._type,item)} className="px-3 py-2 rounded-xl text-xs font-bold transition" style={{background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.25)',color:'#6ee7b7'}}>✓ Одобрить</button>
                        <button onClick={()=>reject(item._type,item)} className="px-3 py-2 rounded-xl text-xs font-bold transition" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>✕ Отклонить</button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* ── RESTAURANTS ── */}
              {tab==='restaurants'&&(
                <EntityGrid items={restaurants} type="restaurant"
                  onEdit={(item)=>{ setEditModal(item); setEditType('restaurant'); }}
                  onDelete={(id)=>deleteItem('restaurant',id)}/>
              )}

              {/* ── ARTISTS ── */}
              {tab==='artists'&&(
                <EntityGrid items={artists} type="artist"
                  onEdit={(item)=>{ setEditModal(item); setEditType('artist'); }}
                  onDelete={(id)=>deleteItem('artist',id)}/>
              )}

              {/* ── USERS ── */}
              {tab==='users'&&(
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.filter(u=>u.role!=='admin').map(u=>(
                    <Card key={u.id} className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
                        style={{background:'linear-gradient(135deg,#C9A84C,#7A5C1E)'}}>
                        {(u.name||u.email||'?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-semibold text-sm truncate">{u.name||'—'}</div>
                        <div className="text-white/35 text-xs truncate">{u.phone||u.email||'—'}</div>
                        <div className="text-white/20 text-[10px]">#{u.id}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* ── ANALYTICS ── */}
              {tab==='analytics'&&<AnalyticsTab orders={orders} restaurants={restaurants} artists={artists} payments={payments}/>}

              {/* ── SETTINGS ── */}
              {tab==='settings'&&<SettingsTab user={user} onLogout={()=>{ logout(); navigate('/'); }}/>}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Modals ── */}
      <AnimatePresence>
        {pendingModal&&<PendingModal item={pendingModal} onClose={()=>setPendingModal(null)} onApprove={approve} onReject={reject}/>}
        {orderModal&&<OrderModal order={orderModal} onClose={()=>setOrderModal(null)}/>}
        {paymentModal&&<PaymentModal payment={paymentModal} onClose={()=>setPaymentModal(null)}/>}
        {editModal&&<EditModal item={editModal} type={editType} onClose={()=>setEditModal(null)} onSave={saveEdit}/>}
      </AnimatePresence>
    </div>
  );
}