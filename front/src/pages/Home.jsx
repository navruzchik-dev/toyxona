import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import AILoader from '../components/AILoader';
import WeddingMap from '../components/WeddingMap';
import CongratulationsModal from '../components/CongratulationsModal';

const API = 'http://localhost:5000';
const TODAY = new Date().toISOString().split('T')[0];
const USD_RATE = 12700;

const fmtMln = uzs => `~${Math.round(uzs / 1_000_000)} млн`;

const FALLBACK = {
  hall:   'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&q=80',
  artist: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  car:    'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80',
  decor:  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&q=80',
};
const imgSrc = (url, type) =>
  (!url || url === '' || url === 'null') ? (FALLBACK[type] || FALLBACK.hall) : url;

const priceUSD = item => {
  if (!item) return 0;
  if (item.price_per_day_uzs)  return item.price_per_day_uzs / USD_RATE;
  if (item.price_per_hour_usd) return item.price_per_hour_usd;
  if (item.price_per_day_usd)  return item.price_per_day_usd;
  if (item.price_uzs)          return item.price_uzs / USD_RATE;
  return 0;
};

// Capacity from hall
const hallCapacity = hall => hall?.max_capacity_people || hall?.seating_capacity || 0;

const AI_RESPONSES = {
  default: [
    'Для проведения тоя в Ташкенте в среднем требуется $8,000–$20,000 в зависимости от количества гостей и уровня заведения. 💍',
    'Рекомендую бронировать зал минимум за 3–6 месяцев до свадьбы — лучшие рестораны расписаны надолго вперёд. 🏛️',
    'При выборе артиста обратите внимание на его опыт выступлений на узбекских торжествах. Цены начинаются от $200/час. 🎤',
    'Традиционный никох обычно проводится отдельно от банкета. Для никоха важно пригласить имама. 🌙',
    'Оптимальный бюджет на кортеж — $300–$600 за день. В него входят 3–5 машин представительского класса. 🚗',
    'Лучший сезон для свадьбы в Узбекистане — апрель–май и сентябрь–октябрь. 🌸',
    'Для 200 гостей рекомендую закладывать минимум $15,000 с учётом зала, артистов, кортежа и декора. 💰',
    'Декор зала в среднем стоит 5–15 млн сум. Включает живые цветы, подсветку и оформление столов. ✨',
  ],
  зал:    ['Залы в нашей базе вмещают от 50 до 700 гостей. Стоимость аренды — от 20 до 150 млн сум за день. 🏛️'],
  артист: ['У нас более 24 артистов разных жанров. Цены от $150 до $800 в час. 🎤'],
  бюджет: ['Средний бюджет тоя на 200 человек: зал ~40 млн, артисты ~$600, кортеж ~$400, декор ~10 млн. Итого ~$8,000–12,000. 💸'],
  традиц: ['Узбекская свадьба обычно длится 2–3 дня. Первый день — никох, второй — той для родственников. 🎊'],
  кортеж: ['Классический кортеж: 1 главная машина + 3–4 сопроводительных авто. Средняя стоимость $400–700 за день. 🚗'],
  цена:   ['Стоимость зависит от сезона и дня недели. Пятница и суббота — дороже на 20–30%. 📅'],
  декор:  ['Популярные виды декора: живые цветы, LED-подсветка, фотозона, фейерверк. 🌸'],
  никох:  ['Никох — священный обряд бракосочетания. Проводится имамом в присутствии свидетелей. 🕌'],
};
const getMockReply = text => {
  const t = text.toLowerCase();
  for (const [key, replies] of Object.entries(AI_RESPONSES)) {
    if (key !== 'default' && t.includes(key)) return replies[Math.floor(Math.random() * replies.length)];
  }
  const d = AI_RESPONSES.default;
  return d[Math.floor(Math.random() * d.length)];
};

export default function Home() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useAuth();
  const chatEndRef = useRef(null);

  const [activeTab, setActiveTab] = useState(location.state?.tab || 'planner');
  useEffect(() => { if (location.state?.tab) setActiveTab(location.state.tab); }, [location.state]);

  const [db, setDb] = useState({ artists: [], restaurants: [], cortege_stations: [], extra_services: [] });

  const [budget,  setBudget]  = useState(15000);
  const [guests,  setGuests]  = useState(250);
  const [date,    setDate]    = useState('');
  const [loading, setLoading] = useState(false);
  const [pkg,     setPkg]     = useState(null);

  const [selArtists, setSelArtists] = useState([]);
  const [selCars,    setSelCars]    = useState([]);
  const [selDecors,  setSelDecors]  = useState([]);
  const [selHall,    setSelHall]    = useState(null);

  const [replaceModal, setReplaceModal] = useState({ open: false, cat: null });
  const [showCongrats, setShowCongrats] = useState(false);

  // Budget toast
  const [budgetToast, setBudgetToast] = useState(null);
  const toastTimer = useRef(null);
  const showBudgetToast = (over) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setBudgetToast({ over });
    toastTimer.current = setTimeout(() => setBudgetToast(null), 4000);
  };

  const [messages,    setMessages]    = useState([{ role: 'assistant', text: 'Салом! 👋 Я ваш свадебный консультант. Спрашивайте всё о торжестве — залы, артисты, бюджет, традиции!' }]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem('bay_favs')) || []; } catch { return []; } });
  const [compareList, setCompareList] = useState([]);
  const [ratings,     setRatings]     = useState(() => { try { return JSON.parse(localStorage.getItem('bay_ratings')) || {}; } catch { return {}; } });
  const [ratingModal, setRatingModal] = useState(null);

  // Active (pending/approved) orders for the current client
  const [myOrders, setMyOrders] = useState([]);

  // Rejection modal — shown when an order was rejected since last visit
  const [rejectionModal, setRejectionModal] = useState(null); // { orderId, itemName, itemType, reason }

  // Already-booked items (approved or pending)
  const bookedHallId    = myOrders.find(o => o.restaurant && ['pending','approved'].includes(o.status))?.restaurant?.id || null;
  const bookedArtistIds = myOrders.filter(o => ['pending','approved'].includes(o.status)).flatMap(o => (o.artists || []).map(a => a.id));

  // "Already booked" block modal
  const [alreadyBookedModal, setAlreadyBookedModal] = useState(null); // { type: 'hall'|'artist' }

  const [countdown, setCountdown] = useState(null);
  useEffect(() => {
    if (!date) { setCountdown(null); return; }
    const calc = () => {
      const diff = new Date(date) - new Date();
      if (diff <= 0) { setCountdown(null); return; }
      setCountdown({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000) });
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [date]);

  // Fetch DB
  useEffect(() => {
    ['artists','restaurants','cortege_stations','extra_services'].forEach(ep =>
      fetch(`${API}/${ep}`).then(r => r.json()).then(d => setDb(p => ({ ...p, [ep]: d }))).catch(() => {})
    );
  }, []);

  // Fetch my orders + poll for rejection notifications
  const fetchMyOrders = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/wedding_orders`);
      const all = await res.json();
      const mine = all.filter(o => o.clientId === user.id || o.clientName === user.name);
      setMyOrders(mine);

      // Check for newly rejected orders not yet shown
      const seenRejections = JSON.parse(localStorage.getItem('bay_seen_rejections') || '[]');
      const newRejection = mine.find(o =>
        o.status === 'rejected' &&
        !seenRejections.includes(o.id)
      );
      if (newRejection) {
        setRejectionModal({
          orderId:  newRejection.id,
          itemName: newRejection.restaurant?.name || newRejection.artists?.[0]?.name || 'Исполнитель',
          itemType: newRejection.restaurant ? 'hall' : 'artist',
          reason:   newRejection.rejection_reason || 'Причина не указана',
        });
        localStorage.setItem('bay_seen_rejections', JSON.stringify([...seenRejections, newRejection.id]));
      }
    } catch {}
  };

  useEffect(() => {
    fetchMyOrders();
    const interval = setInterval(fetchMyOrders, 8000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const saveFavs   = arr => { setFavorites(arr); localStorage.setItem('bay_favs', JSON.stringify(arr)); };
  const toggleFav  = (item, type) => {
    const key = `${type}_${item.id || item.car_id}`;
    saveFavs(favorites.find(f => f.key === key) ? favorites.filter(f => f.key !== key) : [...favorites, { key, type, item }]);
  };
  const isFav      = (item, type) => !!favorites.find(f => f.key === `${type}_${item.id || item.car_id}`);
  const saveRating = (key, val)   => { const n = { ...ratings, [key]: val }; setRatings(n); localStorage.setItem('bay_ratings', JSON.stringify(n)); };
  const getRating  = (item, type) => ratings[`${type}_${item?.id || item?.car_id}`] || 0;

  const calcTotal = (hall, artists, cars, decors) => {
    return Math.round(
      priceUSD(hall) +
      artists.reduce((s, x) => s + priceUSD(x), 0) +
      cars.reduce((s, x) => s + priceUSD(x), 0) +
      decors.reduce((s, x) => s + priceUSD(x), 0)
    );
  };
  const total = () => calcTotal(selHall, selArtists, selCars, selDecors);

  // ─── Filter helpers ───────────────────────────────────────────
  // Filter halls: price within budget AND capacity >= guests
  const filteredHalls = db.restaurants.filter(r => {
    if (r.pending) return false;
    const price = priceUSD(r);
    const cap   = hallCapacity(r);
    const budgetOk   = price <= budget * 0.75;
    const capacityOk = cap === 0 || cap >= guests; // if no capacity data, show it
    return budgetOk && capacityOk;
  });

  // Filter artists: price within remaining budget portion
  const filteredArtists = db.artists.filter(a => {
    if (a.pending) return false;
    return priceUSD(a) <= budget * 0.20;
  });

  // Filter cars
  const allCarsArr    = db.cortege_stations[0]?.cars || [];
  const filteredCars  = allCarsArr.filter(c => priceUSD(c) <= budget * 0.15);

  // Filter decors
  const filteredDecors = db.extra_services.filter(d => priceUSD(d) <= budget * 0.15);

  const toggleArtist = (a) => {
    // Check if already has an active booking for this artist
    if (bookedArtistIds.includes(a.id)) {
      setAlreadyBookedModal({ type: 'artist', name: a.name });
      return;
    }
    const already = selArtists.find(x => x.id === a.id);
    if (already) { setSelArtists(p => p.filter(x => x.id !== a.id)); return; }
    const newTotal = calcTotal(selHall, [...selArtists, a], selCars, selDecors);
    if (newTotal > budget) showBudgetToast(newTotal - budget);
    setSelArtists(p => [...p, a]);
  };
  const toggleCar = (c) => {
    const already = selCars.find(x => x.car_id === c.car_id);
    if (already) { setSelCars(p => p.filter(x => x.car_id !== c.car_id)); return; }
    const newTotal = calcTotal(selHall, selArtists, [...selCars, c], selDecors);
    if (newTotal > budget) showBudgetToast(newTotal - budget);
    setSelCars(p => [...p, c]);
  };
  const toggleDecor = (d) => {
    const already = selDecors.find(x => x.id === d.id);
    if (already) { setSelDecors(p => p.filter(x => x.id !== d.id)); return; }
    const newTotal = calcTotal(selHall, selArtists, selCars, [...selDecors, d]);
    if (newTotal > budget) showBudgetToast(newTotal - budget);
    setSelDecors(p => [...p, d]);
  };
  const setHallWithCheck = (hall) => {
    if (!hall) { setSelHall(null); return; }
    // Check active booking
    if (bookedHallId && bookedHallId !== hall.id) {
      setAlreadyBookedModal({ type: 'hall', name: hall.name });
      return;
    }
    const newTotal = calcTotal(hall, selArtists, selCars, selDecors);
    if (newTotal > budget) showBudgetToast(newTotal - budget);
    setSelHall(hall);
  };

  // Generate — strict budget + guest filter
  const generate = () => {
    if (!date) return;
    setLoading(true); setPkg(null);
    setTimeout(() => {
      const hallBudget   = budget * 0.70;
      const artistBudget = budget * 0.15;

      const validHalls = filteredHalls;
      const rest = validHalls.length > 0
        ? validHalls.reduce((best, r) => priceUSD(r) > priceUSD(best) ? r : best, validHalls[0])
        : null;

      const validArtists = filteredArtists;
      const art = validArtists.length > 0
        ? validArtists[Math.floor(Math.random() * validArtists.length)]
        : null;

      const spentSoFar = priceUSD(rest) + priceUSD(art);
      const remaining  = budget - spentSoFar;

      const validCars  = filteredCars.filter(c => priceUSD(c) <= remaining * 0.6);
      const car = validCars.length > 0
        ? validCars[Math.floor(Math.random() * Math.min(validCars.length, 6))]
        : null;

      const leftForDecor = budget - spentSoFar - priceUSD(car);
      const validDecors  = db.extra_services.filter(d => priceUSD(d) <= leftForDecor);
      const dec = validDecors.length > 0
        ? validDecors[Math.floor(Math.random() * validDecors.length)]
        : null;

      setSelHall(rest);
      setSelArtists(art ? [art] : []);
      setSelCars(car ? [car] : []);
      setSelDecors(dec ? [dec] : []);
      setPkg({ restaurant: rest, artist: art, car, decor: dec });
      setLoading(false);
    }, 3200);
  };

  const book = async () => {
    if (!selHall && selArtists.length === 0) return;
    const order = {
      id: 'ORDER-' + Date.now(),
      date, guests, total_price_usd: total(),
      restaurant: selHall,
      artist: selArtists[0], artists: selArtists,
      car: selCars[0], cars: selCars,
      decor: selDecors[0], decors: selDecors,
      status: 'pending',
      clientId: user?.id,
      clientName: user?.name,
    };
    try {
      await fetch(`${API}/wedding_orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      setShowCongrats(true);
      fetchMyOrders();
      setTimeout(() => { setShowCongrats(false); navigate('/checkout'); }, 5500);
    } catch {}
  };

  // Cancel booking
  const cancelOrder = async (orderId, reason) => {
    try {
      await fetch(`${API}/wedding_orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancellation_reason: reason }),
      });
      fetchMyOrders();
    } catch {}
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setMessages(p => [...p, { role: 'user', text }]);
    setChatLoading(true);
    setTimeout(() => {
      setMessages(p => [...p, { role: 'assistant', text: getMockReply(text) }]);
      setChatLoading(false);
    }, 900 + Math.random() * 600);
  };

  const addCompare = item => {
    if (compareList.length >= 4) return;
    if (!compareList.find(x => (x.id || x.car_id) === (item.id || item.car_id))) setCompareList(p => [...p, item]);
    setActiveTab('compare');
  };

  const overBudget = total() > budget;
  const overAmount = total() - budget;

  const tabs = [
    { key: 'planner',   label: 'ИИ Конструктор',  icon: '◈' },
    { key: 'manual',    label: 'Подобрать сам',    icon: '⊞' },
    { key: 'map',       label: 'Карта',            icon: '◎' },
    { key: 'chat',      label: 'AI Помощник',      icon: '◉' },
    { key: 'favorites', label: `Избранное${favorites.length ? ` · ${favorites.length}` : ''}`, icon: '◇' },
    { key: 'compare',   label: 'Сравнить',         icon: '⊟' },
  ];

  return (
    <div className="min-h-screen pt-20" style={{ background: 'var(--bg)' }}>
      {showCongrats && <CongratulationsModal groomName={user?.groomName} brideName={user?.brideName} />}

      {/* ── Rejection Modal ── */}
      <AnimatePresence>
        {rejectionModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="w-full max-w-md rounded-3xl p-8 text-center border"
              style={{ background: 'linear-gradient(135deg, #1a0808, #0d0d1a)', borderColor: 'rgba(239,68,68,0.4)' }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl"
                style={{ background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.3)' }}>
                😔
              </div>
              <h2 className="text-2xl font-black mb-2" style={{ color: '#fca5a5' }}>
                К сожалению, заявка отклонена
              </h2>
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ color: '#f87171', fontWeight: 700 }}>{rejectionModal.itemName}</span>
                {' '}отклонил(а) ваш заказ
              </p>
              <div className="my-4 p-4 rounded-2xl text-sm text-left"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(255,255,255,0.75)' }}>
                <div className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'rgba(239,68,68,0.7)' }}>Причина:</div>
                {rejectionModal.reason}
              </div>
              <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Пожалуйста, выберите другой{' '}
                {rejectionModal.itemType === 'hall' ? 'зал' : 'артиста'}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setRejectionModal(null);
                    setActiveTab('manual');
                  }}
                  className="w-full py-3.5 rounded-xl font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, var(--gold, #C9A84C), #7A5C1E)' }}>
                  Выбрать другой {rejectionModal.itemType === 'hall' ? 'зал' : 'артиста'}
                </button>
                <button
                  onClick={() => setRejectionModal(null)}
                  className="w-full py-3 rounded-xl text-sm font-medium"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Already Booked Modal ── */}
      <AnimatePresence>
        {alreadyBookedModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-7 text-center border"
              style={{ background: 'linear-gradient(135deg, #0d0d1a, #1a1a0d)', borderColor: 'rgba(201,168,76,0.35)' }}>
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-lg font-black mb-2" style={{ color: 'var(--gold, #C9A84C)' }}>
                Уже есть активная бронь
              </h3>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Вы не можете забронировать{' '}
                <strong style={{ color: 'white' }}>{alreadyBookedModal.name}</strong>,{' '}
                пока не отмените предыдущую бронь.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setAlreadyBookedModal(null); navigate('/checkout'); }}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, var(--gold, #C9A84C), #7A5C1E)' }}>
                  Перейти к моим броням
                </button>
                <button
                  onClick={() => setAlreadyBookedModal(null)}
                  className="w-full py-3 rounded-xl text-sm"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget Toast */}
      <AnimatePresence>
        {budgetToast && (
          <motion.div
            initial={{ opacity: 0, y: -60, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -60, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl"
            style={{ background: '#1a0a0a', borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 8px 32px rgba(239,68,68,0.2)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>!</div>
            <div>
              <div className="text-sm font-bold" style={{ color: '#fca5a5' }}>Превышение бюджета</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(252,165,165,0.7)' }}>
                Вы вышли за бюджет на <span className="font-black text-red-400">${budgetToast.over.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => setBudgetToast(null)} className="ml-2 text-red-400/50 hover:text-red-400 transition text-xl leading-none">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO */}
      <div className="text-center pt-10 pb-8 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] rounded-full blur-3xl opacity-60"
            style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          {user?.groomName && user?.brideName ? (
            <div className="mb-6">
              <p className="text-sm font-medium mb-4" style={{ color: 'var(--text2)' }}>
                Добро пожаловать, <span style={{ color: 'var(--gold)' }}>{user.name}</span>
              </p>
              <div className="inline-flex items-center gap-4">
                <div className="px-6 py-3 rounded-2xl border" style={{ background: 'rgba(201,168,76,0.06)', borderColor: 'rgba(201,168,76,0.2)' }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text2)' }}>Жених</div>
                  <div className="font-black text-lg" style={{ color: 'var(--gold)' }}>{user.groomName}</div>
                </div>
                <div className="text-xl select-none" style={{ color: 'var(--gold)' }}>×</div>
                <div className="px-6 py-3 rounded-2xl border" style={{ background: 'rgba(201,168,76,0.06)', borderColor: 'rgba(201,168,76,0.2)' }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text2)' }}>Невеста</div>
                  <div className="font-black text-lg" style={{ color: 'var(--gold)' }}>{user.brideName}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-5">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium"
                style={{ borderColor: 'rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.08)', color: 'var(--gold)' }}>
                Умный планировщик торжеств
              </span>
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 leading-[1.1] tracking-tight" style={{ color: 'var(--text)' }}>
            Идеальный{' '}
            <span style={{ background: 'linear-gradient(90deg, var(--gold), #e8c96a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              той
            </span>
            <br className="hidden sm:block" /> за 10 секунд
          </h1>
          {countdown && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-4 sm:gap-6 px-7 py-3.5 rounded-2xl border mb-5"
              style={{ background: 'var(--card)', borderColor: 'rgba(201,168,76,0.25)' }}>
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text2)' }}>До тоя</span>
              {[{ v: countdown.d, l: 'дн' }, { v: countdown.h, l: 'ч' }, { v: countdown.m, l: 'мин' }].map(({ v, l }) => (
                <div key={l} className="text-center">
                  <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--gold)' }}>{v}</div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text2)' }}>{l}</div>
                </div>
              ))}
            </motion.div>
          )}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mt-5">
            {[
              { val: filteredHalls.length,   label: `залов (до $${budget.toLocaleString()})` },
              { val: filteredArtists.length, label: 'артистов в бюджете' },
              { val: filteredCars.length,    label: 'авто для кортежа' },
            ].map(({ val, label }) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-black" style={{ color: 'var(--gold)' }}>{val}</div>
                <div className="text-xs mt-0.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* TABS */}
      <div className="px-4 mb-8 overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl border w-fit mx-auto" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {tabs.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5"
              style={activeTab === key
                ? { background: 'linear-gradient(135deg, var(--gold), #7A5C1E)', color: '#fff', boxShadow: '0 2px 12px rgba(201,168,76,0.3)' }
                : { color: 'var(--text2)' }}>
              <span className="text-xs opacity-70">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 pb-24">
        <AnimatePresence mode="wait">

          {/* ── AI PLANNER ── */}
          {activeTab === 'planner' && (
            <motion.div key="planner" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Параметры тоя</h2>
                  </div>
                  <div className="p-5 space-y-6">
                    {/* Budget */}
                    <div>
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text2)' }}>Бюджет</span>
                        <span className="text-xl font-black" style={{ color: 'var(--gold)' }}>${budget.toLocaleString()}</span>
                      </div>
                      <input type="range" min={5000} max={50000} step={1000} value={budget}
                        onChange={e => setBudget(+e.target.value)}
                        className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
                        style={{ accentColor: 'var(--gold)', background: `linear-gradient(to right, var(--gold) ${((budget-5000)/45000)*100}%, rgba(255,255,255,0.1) 0%)` }} />
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px]" style={{ color: 'var(--text2)' }}>$5,000</span>
                        <span className="text-[10px]" style={{ color: 'var(--text2)' }}>$50,000</span>
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {[8000, 15000, 25000, 40000].map(v => (
                          <button key={v} onClick={() => setBudget(v)}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                            style={budget === v
                              ? { background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.4)' }
                              : { background: 'rgba(255,255,255,0.04)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                            ${(v/1000).toFixed(0)}k
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Guests */}
                    <div>
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text2)' }}>Гостей</span>
                        <span className="text-xl font-black" style={{ color: '#a78bfa' }}>{guests}</span>
                      </div>
                      <input type="range" min={50} max={700} step={20} value={guests}
                        onChange={e => setGuests(+e.target.value)}
                        className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
                        style={{ accentColor: '#8B5CF6', background: `linear-gradient(to right, #8B5CF6 ${((guests-50)/650)*100}%, rgba(255,255,255,0.1) 0%)` }} />
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px]" style={{ color: 'var(--text2)' }}>50</span>
                        <span className="text-[10px]" style={{ color: 'var(--text2)' }}>700 чел.</span>
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {[100, 200, 350, 500].map(v => (
                          <button key={v} onClick={() => setGuests(v)}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                            style={guests === v
                              ? { background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.4)' }
                              : { background: 'rgba(255,255,255,0.04)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Date */}
                    <div>
                      <span className="block text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: 'var(--text2)' }}>Дата торжества</span>
                      <input type="date" min={TODAY} value={date} onChange={e => setDate(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${date ? 'rgba(201,168,76,0.5)' : 'var(--border)'}`, color: date ? 'var(--text)' : 'var(--text2)' }} />
                    </div>
                    {/* Budget-matching info */}
                    <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', color: 'var(--text2)' }}>
                      Доступно: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{filteredHalls.length} залов</span>,{' '}
                      <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{filteredArtists.length} артистов</span>{' '}
                      в рамках вашего бюджета и {guests} гостей
                    </div>
                    <button onClick={generate} disabled={loading || !date}
                      className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-30"
                      style={{ background: date ? 'linear-gradient(135deg, var(--gold), #7A5C1E)' : 'rgba(255,255,255,0.08)', boxShadow: date ? '0 4px 20px rgba(201,168,76,0.25)' : 'none' }}>
                      {loading ? 'Генерируем...' : 'Сгенерировать пакет'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <AnimatePresence mode="wait">
                  {loading && <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><AILoader /></motion.div>}
                  {!loading && !pkg && (
                    <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="min-h-[380px] flex flex-col items-center justify-center text-center border-2 border-dashed rounded-2xl p-12"
                      style={{ borderColor: 'var(--border)' }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-2xl"
                        style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}>◈</div>
                      <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Готов к планированию</p>
                      <p className="text-sm" style={{ color: 'var(--text2)' }}>Настройте параметры и нажмите кнопку генерации</p>
                    </motion.div>
                  )}
                  {!loading && pkg && (
                    <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {/* Total banner */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border gap-3"
                        style={{
                          background: overBudget ? 'rgba(239,68,68,0.06)' : 'rgba(201,168,76,0.05)',
                          borderColor: overBudget ? 'rgba(239,68,68,0.3)' : 'rgba(201,168,76,0.2)',
                        }}>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text2)' }}>
                            {overBudget ? 'Превышение бюджета' : 'Смета готова'}
                          </div>
                          <div className="font-semibold" style={{ color: 'var(--text)' }}>
                            {overBudget ? `Бюджет превышен на $${overAmount.toLocaleString()}` : 'Оптимальный пакет под ваш бюджет'}
                          </div>
                        </div>
                        <div className="sm:text-right">
                          <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Итого</div>
                          <div className="text-3xl font-black" style={{ color: overBudget ? '#f87171' : 'var(--gold)' }}>
                            ${total().toLocaleString()}
                          </div>
                          {overBudget && <div className="text-xs mt-0.5" style={{ color: '#f87171' }}>Бюджет: ${budget.toLocaleString()}</div>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <PkgCard label="Зал" name={selHall?.name} sub={selHall?.district}
                          price={fmtMln(selHall?.price_per_day_uzs)} img={imgSrc(selHall?.image_url, 'hall')}
                          isFav={isFav(selHall || {}, 'hall')} onFav={() => toggleFav(selHall, 'hall')}
                          rating={getRating(selHall || {}, 'hall')} onRate={() => setRatingModal({ type: 'hall', item: selHall })}
                          onReplace={() => setReplaceModal({ open: true, cat: 'restaurant' })} />
                        <MultiCard label="Артисты" count={selArtists.length} onAdd={() => setReplaceModal({ open: true, cat: 'artist' })}>
                          {selArtists.map(a => (
                            <ItemRow key={a.id} name={a.name} price={`$${a.price_per_hour_usd}/ч`}
                              isFav={isFav(a, 'artist')} onFav={() => toggleFav(a, 'artist')}
                              onRate={() => setRatingModal({ type: 'artist', item: a })}
                              onRemove={() => setSelArtists(p => p.filter(x => x.id !== a.id))} />
                          ))}
                        </MultiCard>
                        <MultiCard label="Кортеж" count={selCars.length} suffix="авто" onAdd={() => setReplaceModal({ open: true, cat: 'car' })}>
                          {selCars.map((c, i) => (
                            <ItemRow key={i} name={c.model} price={`$${c.price_per_day_usd}/д`}
                              isFav={isFav(c, 'car')} onFav={() => toggleFav(c, 'car')}
                              onRate={() => setRatingModal({ type: 'car', item: c })}
                              onRemove={() => setSelCars(p => p.filter((_, j) => j !== i))} />
                          ))}
                        </MultiCard>
                        <MultiCard label="Декор" count={selDecors.length} onAdd={() => setReplaceModal({ open: true, cat: 'decor' })}>
                          {selDecors.map(d => (
                            <ItemRow key={d.id} name={d.service_name} price={fmtMln(d.price_uzs)}
                              onRate={() => setRatingModal({ type: 'decor', item: d })}
                              onRemove={() => setSelDecors(p => p.filter(x => x.id !== d.id))} />
                          ))}
                        </MultiCard>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button onClick={book} disabled={!selHall && selArtists.length === 0}
                          className="px-8 py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-30"
                          style={{ background: 'linear-gradient(135deg, var(--gold), #7A5C1E)', boxShadow: '0 4px 20px rgba(201,168,76,0.25)' }}>
                          Забронировать
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── MANUAL ── */}
          {activeTab === 'manual' && (
            <motion.div key="manual" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div>
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--text2)' }}>Дата</label>
                  <input type="date" min={TODAY} value={date} onChange={e => setDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text2)' }}>Бюджет</span>
                    <span className="text-sm font-black" style={{ color: 'var(--gold)' }}>${budget.toLocaleString()}</span>
                  </div>
                  <input type="range" min={5000} max={50000} step={1000} value={budget} onChange={e => setBudget(+e.target.value)} style={{ accentColor: 'var(--gold)', width: '100%' }} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text2)' }}>Гостей</span>
                    <span className="text-sm font-black" style={{ color: '#a78bfa' }}>{guests}</span>
                  </div>
                  <input type="range" min={50} max={700} step={20} value={guests} onChange={e => setGuests(+e.target.value)} style={{ accentColor: '#8B5CF6', width: '100%' }} />
                </div>
              </div>

              {/* Filter info banner */}
              <div className="flex flex-wrap gap-3 text-xs px-1">
                <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.2)' }}>
                  💰 Бюджет: ${budget.toLocaleString()}
                </span>
                <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                  👥 Гостей: {guests}
                </span>
                <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                  Показаны только подходящие варианты
                </span>
              </div>

              {(selHall || selArtists.length > 0 || selCars.length > 0 || selDecors.length > 0) && (
                <div className="p-5 rounded-2xl border"
                  style={{ background: overBudget ? 'rgba(239,68,68,0.05)' : 'rgba(201,168,76,0.05)', borderColor: overBudget ? 'rgba(239,68,68,0.25)' : 'rgba(201,168,76,0.2)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                      {overBudget ? `Превышение на $${overAmount.toLocaleString()}` : 'Ваш выбор'}
                    </h3>
                    <div className="text-xl font-black" style={{ color: overBudget ? '#f87171' : 'var(--gold)' }}>
                      ${total().toLocaleString()}
                      {overBudget && <span className="text-xs font-normal ml-2 opacity-60">/ ${budget.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selHall && <Tag label={selHall.name} onRemove={() => setSelHall(null)} />}
                    {selArtists.map(a => <Tag key={a.id} label={a.name} onRemove={() => setSelArtists(p => p.filter(x => x.id !== a.id))} />)}
                    {selCars.map((c, i) => <Tag key={i} label={c.model} onRemove={() => setSelCars(p => p.filter((_, j) => j !== i))} />)}
                    {selDecors.map(d => <Tag key={d.id} label={d.service_name} onRemove={() => setSelDecors(p => p.filter(x => x.id !== d.id))} />)}
                  </div>
                  {date && (selHall || selArtists.length > 0) && (
                    <button onClick={book} className="mt-4 px-6 py-2.5 rounded-xl font-bold text-white text-sm"
                      style={{ background: 'linear-gradient(135deg, var(--gold), #7A5C1E)' }}>Забронировать</button>
                  )}
                </div>
              )}

              {/* HALLS */}
              <Section title={`Залы · ${filteredHalls.length} доступно`}>
                {filteredHalls.length === 0 ? (
                  <EmptyFilter label="залов" budget={budget} guests={guests} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHalls.map(r => {
                      const isBooked = bookedHallId && bookedHallId !== r.id;
                      return (
                        <SelectCard key={r.id} item={r} selected={selHall?.id === r.id}
                          name={r.name} sub={r.district}
                          price={fmtMln(r.price_per_day_uzs)}
                          capacity={r.max_capacity_people}
                          img={imgSrc(r.image_url, 'hall')}
                          isFav={isFav(r, 'hall')} onFav={() => toggleFav(r, 'hall')}
                          onCompare={() => addCompare({ ...r, _type: 'hall' })}
                          rating={getRating(r, 'hall')} onRate={() => setRatingModal({ type: 'hall', item: r })}
                          locked={isBooked}
                          onLockedClick={() => setAlreadyBookedModal({ type: 'hall', name: r.name })}
                          onClick={() => setHallWithCheck(selHall?.id === r.id ? null : r)} single />
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* ARTISTS */}
              <Section title={`Артисты · ${filteredArtists.length} доступно`}>
                {filteredArtists.length === 0 ? (
                  <EmptyFilter label="артистов" budget={budget} guests={guests} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredArtists.map(a => {
                      const isBooked = bookedArtistIds.includes(a.id);
                      return (
                        <SelectCard key={a.id} item={a} selected={!!selArtists.find(x => x.id === a.id)}
                          name={a.name} sub={a.genre} price={`$${a.price_per_hour_usd}/ч`}
                          img={imgSrc(a.image_url, 'artist')}
                          isFav={isFav(a, 'artist')} onFav={() => toggleFav(a, 'artist')}
                          onCompare={() => addCompare({ ...a, _type: 'artist' })}
                          rating={getRating(a, 'artist')} onRate={() => setRatingModal({ type: 'artist', item: a })}
                          locked={isBooked}
                          onLockedClick={() => setAlreadyBookedModal({ type: 'artist', name: a.name })}
                          onClick={() => toggleArtist(a)} />
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* CARS */}
              <Section title={`Кортеж · ${filteredCars.length} доступно`}>
                {filteredCars.length === 0 ? (
                  <EmptyFilter label="машин кортежа" budget={budget} guests={guests} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCars.map((c, i) => (
                      <SelectCard key={i} item={c} selected={!!selCars.find(x => x.car_id === c.car_id)}
                        name={c.model} sub={`${c.color} · ${c.year}`} price={`$${c.price_per_day_usd}/д`}
                        img={imgSrc(c.image_url, 'car')}
                        isFav={isFav(c, 'car')} onFav={() => toggleFav(c, 'car')}
                        onCompare={() => addCompare({ ...c, _type: 'car' })}
                        rating={getRating(c, 'car')} onRate={() => setRatingModal({ type: 'car', item: c })}
                        onClick={() => toggleCar(c)} />
                    ))}
                  </div>
                )}
              </Section>

              {/* DECORS */}
              <Section title="Декор и эффекты">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {db.extra_services.map(d => (
                    <SelectCard key={d.id} item={d} selected={!!selDecors.find(x => x.id === d.id)}
                      name={d.service_name} sub={d.type} price={fmtMln(d.price_uzs)}
                      img={imgSrc(d.image_url, 'decor')}
                      isFav={isFav(d, 'decor')} onFav={() => toggleFav(d, 'decor')}
                      onCompare={() => addCompare({ ...d, _type: 'decor' })}
                      rating={getRating(d, 'decor')} onRate={() => setRatingModal({ type: 'decor', item: d })}
                      onClick={() => toggleDecor(d)} />
                  ))}
                </div>
              </Section>
            </motion.div>
          )}

          {/* MAP */}
          {activeTab === 'map' && (
            <motion.div key="map" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <WeddingMap restaurants={db.restaurants.filter(r => !r.pending)} />
            </motion.div>
          )}

          {/* CHAT */}
          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto">
              <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white"
                    style={{ background: 'linear-gradient(135deg, var(--gold), #7A5C1E)' }}>AI</div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>Свадебный консультант</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs" style={{ color: 'var(--text2)' }}>Онлайн</span>
                    </div>
                  </div>
                </div>
                <div className="h-[380px] overflow-y-auto p-5 space-y-3">
                  {messages.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        style={m.role === 'user'
                          ? { background: 'linear-gradient(135deg, var(--gold), #7A5C1E)', color: '#fff' }
                          : { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="px-4 py-3 rounded-2xl rounded-bl-sm border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--border)' }}>
                        <div className="flex gap-1 items-center h-4">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }}
                              animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="px-5 pb-2 flex flex-wrap gap-1.5">
                  {['Сколько стоит той?', 'Лучший сезон?', 'Традиции никох', 'Выбор артиста'].map(q => (
                    <button key={q} onClick={() => setChatInput(q)}
                      className="px-3 py-1.5 rounded-lg text-xs transition-all"
                      style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', color: 'var(--text2)' }}>
                      {q}
                    </button>
                  ))}
                </div>
                <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex gap-2">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder="Спросите о свадьбе..."
                      className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                    <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold disabled:opacity-30 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--gold), #7A5C1E)' }}>→</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* FAVORITES */}
          {activeTab === 'favorites' && (
            <motion.div key="favs" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {favorites.length === 0 ? (
                <div className="text-center py-24">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>◇</div>
                  <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Избранное пусто</p>
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Нажмите ◇ на карточке чтобы сохранить</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.map(({ key, type, item }) => (
                    <SelectCard key={key} item={item} selected={false}
                      name={item.name || item.model || item.service_name}
                      sub={item.district || item.genre || item.type || item.color}
                      price={item.price_per_hour_usd ? `$${item.price_per_hour_usd}/ч` : item.price_per_day_usd ? `$${item.price_per_day_usd}/д` : fmtMln(item.price_per_day_uzs || item.price_uzs || 0)}
                      img={imgSrc(item.image_url, type)}
                      isFav={true} onFav={() => toggleFav(item, type)}
                      rating={getRating(item, type)} onRate={() => setRatingModal({ type, item })}
                      onClick={() => {}} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* COMPARE */}
          {activeTab === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-sm mb-5" style={{ color: 'var(--text2)' }}>Добавьте элементы через ⊟ на карточках в разделе «Подобрать сам»</p>
              {compareList.length === 0 ? (
                <div className="text-center py-24">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>⊟</div>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>Нет элементов для сравнения</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-4 min-w-max">
                    {compareList.map((item, i) => (
                      <div key={i} className="w-64 rounded-2xl overflow-hidden border flex-shrink-0" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                        <div className="relative h-36">
                          <img src={imgSrc(item.image_url, item._type)} alt="" className="w-full h-full object-cover"
                            onError={e => { e.target.src = FALLBACK[item._type] || FALLBACK.hall; }} />
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                          <button onClick={() => setCompareList(p => p.filter((_, j) => j !== i))}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">×</button>
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{item.name || item.model || item.service_name}</div>
                          {item.district            && <CompRow label="Район"       val={item.district} />}
                          {item.max_capacity_people && <CompRow label="Вместимость" val={`${item.max_capacity_people} чел.`} />}
                          {item.price_per_day_uzs   && <CompRow label="Цена/день"   val={fmtMln(item.price_per_day_uzs)} />}
                          {item.price_per_hour_usd  && <CompRow label="Цена/час"    val={`$${item.price_per_hour_usd}`} />}
                          {item.price_per_day_usd   && <CompRow label="Цена/день"   val={`$${item.price_per_day_usd}`} />}
                          {item.price_uzs            && <CompRow label="Цена"        val={fmtMln(item.price_uzs)} />}
                          {item.genre                && <CompRow label="Жанр"        val={item.genre} />}
                          {item.year                 && <CompRow label="Год"         val={item.year} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Replace Modal */}
      <AnimatePresence>
        {replaceModal.open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
            onClick={() => setReplaceModal({ open: false, cat: null })}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-2xl max-h-[75vh] flex flex-col rounded-2xl overflow-hidden border"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                  {replaceModal.cat === 'artist' ? 'Добавить артиста' : replaceModal.cat === 'car' ? 'Добавить машину' : replaceModal.cat === 'decor' ? 'Добавить декор' : 'Выбрать зал'}
                </h3>
                <button onClick={() => setReplaceModal({ open: false, cat: null })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text2)' }}>×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getModalItems(replaceModal.cat, db, budget, guests).map((item, idx) => {
                  const catType = replaceModal.cat === 'restaurant' ? 'hall' : replaceModal.cat;
                  return (
                    <button key={item.id || item.car_id || idx}
                      onClick={() => {
                        if (replaceModal.cat === 'restaurant') { setHallWithCheck(item); setReplaceModal({ open: false, cat: null }); }
                        else if (replaceModal.cat === 'artist') toggleArtist(item);
                        else if (replaceModal.cat === 'car')    toggleCar(item);
                        else if (replaceModal.cat === 'decor')  toggleDecor(item);
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <img src={imgSrc(item.image_url, catType)} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        onError={e => { e.target.src = FALLBACK[catType] || FALLBACK.hall; }} />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{item.name || item.model || item.service_name}</div>
                        <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--gold)' }}>
                          {item.price_per_hour_usd ? `$${item.price_per_hour_usd}/ч` : item.price_per_day_usd ? `$${item.price_per_day_usd}/д` : fmtMln(item.price_per_day_uzs || item.price_uzs || 0)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {replaceModal.cat !== 'restaurant' && (
                <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button onClick={() => setReplaceModal({ open: false, cat: null })}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, var(--gold), #7A5C1E)' }}>Готово</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
            onClick={() => setRatingModal(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-2xl p-8 w-full max-w-sm border text-center"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 text-lg font-black text-white"
                style={{ background: 'linear-gradient(135deg, var(--gold), #7A5C1E)' }}>★</div>
              <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>Ваша оценка</h3>
              <p className="text-sm mb-5 truncate" style={{ color: 'var(--text2)' }}>
                {ratingModal.item?.name || ratingModal.item?.model || ratingModal.item?.service_name}
              </p>
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map(star => {
                  const key = `${ratingModal.type}_${ratingModal.item?.id || ratingModal.item?.car_id}`;
                  const cur = ratings[key] || 0;
                  return (
                    <button key={star} onClick={() => saveRating(key, star)}
                      className="text-3xl transition-transform hover:scale-125 active:scale-110"
                      style={{ color: star <= cur ? '#f59e0b' : 'var(--text2)' }}>
                      {star <= cur ? '★' : '☆'}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setRatingModal(null)}
                className="w-full py-3 rounded-xl font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, var(--gold), #7A5C1E)' }}>Готово</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sub-components ─── */

const PkgCard = ({ label, name, sub, price, img, isFav, onFav, rating, onRate, onReplace }) => (
  <motion.div whileHover={{ y: -2 }} className="rounded-2xl overflow-hidden border group" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
    <div className="relative h-36 overflow-hidden">
      <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={e => { e.target.src = FALLBACK.hall; }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
      <span className="absolute top-2.5 left-3 text-[10px] uppercase tracking-wider text-white/60 bg-black/40 px-2 py-0.5 rounded-full">{label}</span>
      <button onClick={onFav} className="absolute top-2.5 right-3 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-sm">
        {isFav ? '♥' : '♡'}
      </button>
    </div>
    <div className="p-3.5">
      <div className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{name}</div>
      <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>{sub}</div>
      <div className="flex items-center justify-between mt-3">
        <span className="font-bold text-sm" style={{ color: 'var(--gold)' }}>{price}</span>
        <div className="flex items-center gap-2">
          <button onClick={onRate} className="text-xs" style={{ color: rating > 0 ? '#f59e0b' : 'var(--text2)' }}>
            {rating > 0 ? '★'.repeat(rating) : '☆ Оценить'}
          </button>
          <button onClick={onReplace} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text2)' }}>
            Заменить
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

const MultiCard = ({ label, count, suffix = '', onAdd, children }) => (
  <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
    <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text2)' }}>
        {label} {count > 0 && <span style={{ color: 'var(--gold)' }}>· {count}{suffix && ` ${suffix}`}</span>}
      </span>
    </div>
    <div className="px-4 pb-2 space-y-2 max-h-36 overflow-y-auto">{children}</div>
    <div className="px-4 pb-3.5">
      <button onClick={onAdd} className="text-xs px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.15)', color: 'var(--gold)' }}>
        + Добавить
      </button>
    </div>
  </div>
);

const ItemRow = ({ name, price, isFav, onFav, onRate, onRemove }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{name}</span>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{price}</span>
      {onRate && <button onClick={onRate} className="text-xs opacity-40 hover:opacity-100 transition">★</button>}
      {onFav  && <button onClick={onFav}  className="text-xs opacity-60 hover:opacity-100 transition">{isFav ? '♥' : '♡'}</button>}
      <button onClick={onRemove} className="text-xs opacity-40 hover:opacity-100 transition text-red-400">×</button>
    </div>
  </div>
);

const SelectCard = ({ item, selected, name, sub, price, capacity, img, isFav, onFav, rating, onRate, onCompare, onClick, locked, onLockedClick }) => (
  <motion.div
    whileHover={{ y: locked ? 0 : -2 }}
    onClick={locked ? onLockedClick : onClick}
    className="rounded-2xl overflow-hidden border cursor-pointer transition-all relative"
    style={{
      background: 'var(--card)',
      borderColor: locked ? 'rgba(239,68,68,0.25)' : selected ? 'var(--gold)' : 'var(--border)',
      boxShadow: selected ? '0 0 0 1px var(--gold)' : 'none',
      opacity: locked ? 0.75 : 1,
    }}>
    {locked && (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
        <div className="text-center px-4">
          <div className="text-3xl mb-1">🔒</div>
          <div className="text-xs font-bold text-white">Уже есть бронь</div>
          <div className="text-[10px] text-white/60 mt-0.5">Нажмите для деталей</div>
        </div>
      </div>
    )}
    {selected && !locked && (
      <div className="absolute top-2.5 left-3 z-10 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black"
        style={{ background: 'var(--gold)' }}>✓</div>
    )}
    <div className="relative h-32 overflow-hidden">
      <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        onError={e => { e.target.src = FALLBACK.hall; }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
      <div className="absolute top-2 right-2 flex gap-1" onClick={e => e.stopPropagation()}>
        {!locked && <button onClick={onFav} className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-xs">{isFav ? '♥' : '♡'}</button>}
        {!locked && onCompare && <button onClick={onCompare} className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-xs">⊟</button>}
      </div>
    </div>
    <div className="p-3">
      <div className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{name}</div>
      <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>
        {sub}{capacity ? ` · до ${capacity} чел.` : ''}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="font-bold text-sm" style={{ color: 'var(--gold)' }}>{price}</span>
        {!locked && (
          <button onClick={e => { e.stopPropagation(); onRate && onRate(); }} className="text-xs" style={{ color: rating > 0 ? '#f59e0b' : 'var(--text2)' }}>
            {rating > 0 ? '★'.repeat(Math.min(rating, 5)) : '☆'}
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

const EmptyFilter = ({ label, budget, guests }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border-2 border-dashed"
    style={{ borderColor: 'var(--border)' }}>
    <div className="text-3xl mb-3">🔍</div>
    <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Нет подходящих {label}</p>
    <p className="text-xs" style={{ color: 'var(--text2)' }}>
      Увеличьте бюджет (сейчас ${budget.toLocaleString()}) или уменьшите число гостей ({guests})
    </p>
  </div>
);

const Section = ({ title, children }) => (
  <div>
    <h2 className="font-black text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--text2)' }}>{title}</h2>
    {children}
  </div>
);

const Tag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
    style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.2)' }}>
    {label}
    <button onClick={onRemove} className="hover:opacity-60 transition">×</button>
  </span>
);

const CompRow = ({ label, val }) => (
  <div className="flex justify-between items-center text-xs">
    <span style={{ color: 'var(--text2)' }}>{label}</span>
    <span className="font-semibold" style={{ color: 'var(--text)' }}>{val}</span>
  </div>
);

// Modal items — also filtered by budget & guests
function getModalItems(cat, db, budget, guests) {
  const USD_RATE = 12700;
  if (cat === 'restaurant') {
    return db.restaurants.filter(r => {
      if (r.pending) return false;
      const price = r.price_per_day_uzs ? r.price_per_day_uzs / USD_RATE : 0;
      const cap   = r.max_capacity_people || r.seating_capacity || 0;
      return price <= budget * 0.75 && (cap === 0 || cap >= guests);
    });
  }
  if (cat === 'artist') return db.artists.filter(a => !a.pending && a.price_per_hour_usd <= budget * 0.20);
  if (cat === 'car')    return (db.cortege_stations[0]?.cars || []).filter(c => (c.price_per_day_usd || 0) <= budget * 0.15);
  if (cat === 'decor')  return db.extra_services;
  return [];
}