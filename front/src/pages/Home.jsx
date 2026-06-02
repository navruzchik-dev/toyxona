import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import AILoader from '../components/AILoader';
import WeddingMap from '../components/WeddingMap';
import CongratulationsModal from '../components/CongratulationsModal';

const API = 'http://localhost:5000';
const TODAY = new Date().toISOString().split('T')[0];

/* ─ tiny helpers ─ */
const fmtMln  = uzs => `~${Math.round(uzs / 1_000_000)} млн`;
const fmtUSD  = usd => `$${usd?.toLocaleString()}`;

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const chatEndRef = useRef(null);

  /* ── tabs: read from navbar state ── */
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'planner');
  useEffect(() => { if (location.state?.tab) setActiveTab(location.state.tab); }, [location.state]);

  /* ── DB ── */
  const [db, setDb] = useState({ artists: [], restaurants: [], cortege_stations: [], extra_services: [] });

  /* ── Planner ── */
  const [budget,   setBudget]   = useState(15000);
  const [guests,   setGuests]   = useState(250);
  const [date,     setDate]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [pkg,      setPkg]      = useState(null);

  /* multi-select */
  const [selArtists, setSelArtists] = useState([]);   // array
  const [selCars,    setSelCars]    = useState([]);    // array
  const [selDecors,  setSelDecors]  = useState([]);    // array
  const [selHall,    setSelHall]    = useState(null);

  /* manual builder */
  const [manualMode, setManualMode] = useState(false);

  /* replace modal */
  const [replaceModal, setReplaceModal] = useState({ open: false, cat: null });

  /* congrats */
  const [showCongrats, setShowCongrats] = useState(false);

  /* ── Chat ── */
  const [messages,    setMessages]    = useState([{ role: 'assistant', text: 'Салом! 👋 Спрашивайте всё о свадьбе — рестораны, артисты, традиции, бюджет!' }]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  /* ── Favorites ── */
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem('bay_favs')) || []; } catch { return []; } });

  /* ── Compare ── */
  const [compareList, setCompareList] = useState([]);

  /* ── Rating ── */
  const [ratings, setRatings] = useState(() => { try { return JSON.parse(localStorage.getItem('bay_ratings')) || {}; } catch { return {}; } });
  const [ratingModal, setRatingModal] = useState(null); // { type, item }

  /* ── Countdown ── */
  const [countdown, setCountdown] = useState(null);
  useEffect(() => {
    if (!date) { setCountdown(null); return; }
    const calc = () => {
      const diff = new Date(date) - new Date();
      if (diff <= 0) { setCountdown(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      setCountdown({ d, h, m });
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [date]);

  /* ── Load DB ── */
  useEffect(() => {
    ['artists','restaurants','cortege_stations','extra_services'].forEach(ep =>
      fetch(`${API}/${ep}`).then(r=>r.json()).then(d => setDb(p=>({...p,[ep]:d}))).catch(()=>{})
    );
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  /* ── Favorites helpers ── */
  const saveFavs = (arr) => { setFavorites(arr); localStorage.setItem('bay_favs', JSON.stringify(arr)); };
  const toggleFav = (item, type) => {
    const key = `${type}_${item.id || item.car_id}`;
    const exists = favorites.find(f => f.key === key);
    saveFavs(exists ? favorites.filter(f => f.key !== key) : [...favorites, { key, type, item }]);
  };
  const isFav = (item, type) => !!favorites.find(f => f.key === `${type}_${item.id || item.car_id}`);

  /* ── Rating helpers ── */
  const saveRating = (key, val) => {
    const next = { ...ratings, [key]: val };
    setRatings(next);
    localStorage.setItem('bay_ratings', JSON.stringify(next));
  };
  const getRating = (item, type) => ratings[`${type}_${item?.id || item?.car_id}`] || 0;

  /* ── AI generate ── */
  const generate = () => {
    if (!date) return;
    setLoading(true); setPkg(null); setManualMode(false);
    setTimeout(() => {
      const rest = db.restaurants.find(r => r.max_capacity_people >= guests) || db.restaurants[0];
      const art  = db.artists[Math.floor(Math.random() * Math.min(db.artists.length, 10))];
      const cars = db.cortege_stations[0]?.cars || [];
      const car  = cars[Math.floor(Math.random() * Math.min(cars.length, 6))];
      const dec  = db.extra_services[Math.floor(Math.random() * db.extra_services.length)];
      setSelHall(rest); setSelArtists([art]); setSelCars([car]); setSelDecors([dec]);
      setPkg({ restaurant: rest, artist: art, car, decor: dec });
      setLoading(false);
    }, 3200);
  };

  /* ── Total ── */
  const total = () => {
    const restUSD  = (selHall?.price_per_day_uzs || 0) / 12700;
    const artUSD   = selArtists.reduce((s,a) => s + (a?.price_per_hour_usd||0), 0);
    const carUSD   = selCars.reduce((s,c) => s + (c?.price_per_day_usd||0), 0);
    const decUSD   = selDecors.reduce((s,d) => s + (d?.price_uzs||0)/12700, 0);
    return Math.round(restUSD + artUSD + carUSD + decUSD);
  };

  /* ── Book ── */
  const book = async () => {
    if (!selHall && selArtists.length === 0) return;
    const order = {
      id: 'ORDER-' + Date.now(), date, guests,
      total_price_usd: total(),
      car_count: selCars.length,
      restaurant: selHall,
      artist: selArtists[0],
      artists: selArtists,
      car: selCars[0],
      cars: selCars,
      decor: selDecors[0],
      decors: selDecors,
      status: 'pending',
      clientName: user?.name,
    };
    try {
      await fetch(`${API}/wedding_orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(order) });
      setShowCongrats(true);
      setTimeout(() => { setShowCongrats(false); navigate('/checkout'); }, 5500);
    } catch {}
  };

  /* ── Chat ── */
  const sendChat = async () => {
    const text = chatInput.trim(); if (!text || chatLoading) return;
    setChatInput(''); setMessages(p => [...p, { role:'user', text }]); setChatLoading(true);

    const weddingWords = ['свадьб','той','жених','невест','рестор','артист','бюджет','гост','кортеж','декор','никох','зал','банкет','мероприят','торжест','брон','цена','стоит','машин','оформлен'];
    const isWedding = weddingWords.some(w => text.toLowerCase().includes(w));

    if (!isWedding && text.split(' ').length > 2) {
      setTimeout(() => {
        setMessages(p => [...p, { role:'assistant', text:'Прошу прощения! 🙏 Я специализируюсь только на вопросах о свадьбах и торжествах. Спросите о планировании тоя! 💍' }]);
        setChatLoading(false);
      }, 600);
      return;
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          system: 'Ты AI-помощник по свадьбам в Узбекистане, платформа BAYRAMLY.ai. Отвечай ТОЛЬКО на вопросы о свадьбах, никох, выборе зала, артистов, бюджета, традиций. Если не про свадьбу — вежливо откажи. Кратко, с эмодзи, на русском.',
          messages: [
            ...messages.slice(-8).map(m => ({ role: m.role==='assistant'?'assistant':'user', content: m.text })),
            { role: 'user', content: text }
          ]
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text;
      setMessages(p => [...p, { role:'assistant', text: reply || 'Ошибка ответа.' }]);
    } catch {
      setMessages(p => [...p, { role:'assistant', text:'Ошибка соединения. Проверьте интернет и попробуйте снова.' }]);
    } finally { setChatLoading(false); }
  };

  /* ── Toggle multi-select helpers ── */
  const toggleArtist = (a) => setSelArtists(p => p.find(x=>x.id===a.id) ? p.filter(x=>x.id!==a.id) : [...p, a]);
  const toggleCar    = (c) => setSelCars(p => p.find(x=>x.car_id===c.car_id) ? p.filter(x=>x.car_id!==c.car_id) : [...p, c]);
  const toggleDecor  = (d) => setSelDecors(p => p.find(x=>x.id===d.id) ? p.filter(x=>x.id!==d.id) : [...p, d]);

  const tabs = [
    { key:'planner',   label:'✨ ИИ Конструктор' },
    { key:'manual',    label:'🛠️ Подобрать сам' },
    { key:'map',       label:'🗺️ Карта' },
    { key:'chat',      label:'💬 AI Помощник' },
    { key:'favorites', label:`❤️ Избранное${favorites.length ? ` (${favorites.length})` : ''}` },
    { key:'compare',   label:'⚖️ Сравнить' },
  ];

  /* ── Stats for hero ── */
  const allCars = db.cortege_stations[0]?.cars || [];

  return (
    <div className="min-h-screen pt-20" style={{ background:'var(--bg)' }}>
      {showCongrats && <CongratulationsModal groomName={user?.groomName} brideName={user?.brideName} />}

      {/* ─ Hero ─ */}
      <div className="text-center pt-10 pb-6 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full blur-3xl" style={{ background:'rgba(201,168,76,0.08)' }} />
        </div>
        <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs sm:text-sm font-medium mb-5"
            style={{ borderColor:'rgba(201,168,76,0.35)', background:'rgba(201,168,76,0.10)', color:'var(--gold)' }}>
            ✨ Умный планировщик свадеб
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mb-4 leading-tight" style={{ color:'var(--text)' }}>
            Идеальный <span style={{ background:'linear-gradient(90deg,var(--gold),var(--gold2))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>той</span><br className="hidden sm:block"/> за 10 секунд
          </h1>

          {/* Countdown */}
          {countdown && (
            <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
              className="inline-flex items-center gap-3 sm:gap-5 px-6 py-3 rounded-2xl border mb-4"
              style={{ background:'var(--card)', borderColor:'var(--border)' }}>
              <span className="text-xs font-medium" style={{ color:'var(--text2)' }}>До вашего тоя:</span>
              {[{ v: countdown.d, l:'дн' }, { v: countdown.h, l:'ч' }, { v: countdown.m, l:'мин' }].map(({ v, l }) => (
                <div key={l} className="text-center">
                  <div className="text-xl sm:text-2xl font-black" style={{ color:'var(--gold)' }}>{v}</div>
                  <div className="text-[10px]" style={{ color:'var(--text2)' }}>{l}</div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mt-4">
            {[
              { val: db.restaurants.length, label:'залов в базе' },
              { val: db.artists.length,     label:'артистов' },
              { val: allCars.length,        label:'машин для кортежа' },
            ].map(({ val, label }) => (
              <div key={label} className="text-center">
                <div className="text-lg sm:text-2xl font-black" style={{ color:'var(--gold)' }}>
                  У нас есть <span className="text-2xl sm:text-3xl">{val}</span>
                </div>
                <div className="text-xs" style={{ color:'var(--text2)' }}>{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─ Tabs ─ */}
      <div className="px-4 mb-6 overflow-x-auto">
        <div className="flex gap-1.5 p-1.5 rounded-2xl border w-fit mx-auto" style={{ background:'var(--card)', borderColor:'var(--border)' }}>
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="flex-shrink-0 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200"
              style={activeTab===key
                ? { background:'linear-gradient(135deg,var(--gold),#7A5C1E)', color:'#fff', boxShadow:'0 4px 15px var(--shadow)' }
                : { color:'var(--text2)' }
              }>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─ Content ─ */}
      <div className="max-w-7xl mx-auto px-4 pb-24">
        <AnimatePresence mode="wait">

          {/* ══ AI PLANNER ══ */}
          {activeTab === 'planner' && (
            <motion.div key="planner" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Settings */}
              <div className="space-y-4">
                <div className="rounded-3xl p-5 sm:p-6 space-y-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                  <h2 className="font-bold text-base" style={{ color:'var(--text)' }}>⚙️ Параметры тоя</h2>

                  <Slider label="Бюджет" value={`$${budget.toLocaleString()}`} min={5000} max={50000} step={1000} cur={budget} onChange={setBudget} color="var(--gold)" />
                  <Slider label="Гостей"  value={`${guests} чел.`}             min={50}   max={700}   step={20}   cur={guests} onChange={setGuests} color="#8B5CF6" />

                  <div>
                    <label className="block text-sm mb-2" style={{ color:'var(--text2)' }}>📅 Дата торжества</label>
                    <input type="date" min={TODAY} value={date} onChange={e => setDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition"
                      style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }} />
                  </div>

                  <button onClick={generate} disabled={loading || !date}
                    className="w-full py-4 rounded-2xl font-black text-white text-sm transition-all btn-gold disabled:opacity-35">
                    {loading ? '⏳ Генерируем...' : '✨ Сгенерировать пакет'}
                  </button>
                </div>
              </div>

              {/* Result */}
              <div className="lg:col-span-2">
                <AnimatePresence mode="wait">
                  {loading && <motion.div key="l" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}><AILoader /></motion.div>}
                  {!loading && !pkg && (
                    <motion.div key="e" initial={{ opacity:0 }} animate={{ opacity:1 }}
                      className="h-full min-h-[320px] flex flex-col items-center justify-center text-center border-2 border-dashed rounded-3xl p-10"
                      style={{ borderColor:'var(--border)' }}>
                      <div className="text-6xl mb-4 animate-bounce3">💍</div>
                      <p className="font-medium" style={{ color:'var(--text2)' }}>Настройте параметры и нажмите кнопку</p>
                    </motion.div>
                  )}
                  {!loading && pkg && (
                    <motion.div key="r" initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-4">
                      {/* Total banner */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border gap-3"
                        style={{ background:'rgba(201,168,76,0.07)', borderColor:'rgba(201,168,76,0.22)' }}>
                        <div>
                          <div className="text-xs uppercase tracking-widest" style={{ color:'var(--text2)' }}>ИИ-смета готова ✅</div>
                          <div className="font-semibold mt-0.5" style={{ color:'var(--text)' }}>Идеальный пакет под ваш бюджет</div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs" style={{ color:'var(--text2)' }}>Итого ~</div>
                          <div className="text-2xl sm:text-3xl font-black" style={{ color:'var(--gold)' }}>${total().toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <PkgCard label="🏛️ Зал" name={selHall?.name} sub={selHall?.district}
                          price={fmtMln(selHall?.price_per_day_uzs)} img={selHall?.image_url}
                          isFav={isFav(selHall||{}, 'hall')} onFav={() => toggleFav(selHall, 'hall')}
                          rating={getRating(selHall||{}, 'hall')} onRate={() => setRatingModal({ type:'hall', item: selHall })}
                          onReplace={() => setReplaceModal({ open:true, cat:'restaurant' })} />

                        {/* Multi artists */}
                        <div className="rounded-2xl overflow-hidden border" style={{ background:'var(--card)', borderColor:'var(--border)' }}>
                          <div className="px-4 pt-3 pb-1 text-xs" style={{ color:'var(--text2)' }}>🎤 Артисты ({selArtists.length})</div>
                          <div className="px-4 pb-3 space-y-2 max-h-36 overflow-y-auto">
                            {selArtists.map(a => (
                              <div key={a.id} className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate" style={{ color:'var(--text)' }}>{a.name}</span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs font-bold" style={{ color:'var(--gold)' }}>${a.price_per_hour_usd}/ч</span>
                                  <button onClick={() => setRatingModal({ type:'artist', item:a })} className="text-xs opacity-50 hover:opacity-100">⭐</button>
                                  <button onClick={() => toggleFav(a,'artist')} className="text-xs">{isFav(a,'artist') ? '❤️' : '🤍'}</button>
                                  <button onClick={() => setSelArtists(p => p.filter(x=>x.id!==a.id))} className="text-red-400 text-xs">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-4 pb-3">
                            <button onClick={() => setReplaceModal({ open:true, cat:'artist' })}
                              className="text-xs px-3 py-1.5 rounded-lg transition" style={{ color:'var(--gold)', background:'rgba(201,168,76,0.08)' }}>
                              + Добавить артиста
                            </button>
                          </div>
                        </div>

                        {/* Multi cars */}
                        <div className="rounded-2xl overflow-hidden border" style={{ background:'var(--card)', borderColor:'var(--border)' }}>
                          <div className="px-4 pt-3 pb-1 text-xs" style={{ color:'var(--text2)' }}>🚗 Кортеж ({selCars.length} авто)</div>
                          <div className="px-4 pb-3 space-y-2 max-h-36 overflow-y-auto">
                            {selCars.map((c,i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate" style={{ color:'var(--text)' }}>{c.model}</span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs font-bold" style={{ color:'var(--gold)' }}>${c.price_per_day_usd}/д</span>
                                  <button onClick={() => setRatingModal({ type:'car', item:c })} className="text-xs opacity-50 hover:opacity-100">⭐</button>
                                  <button onClick={() => toggleFav(c,'car')} className="text-xs">{isFav(c,'car') ? '❤️' : '🤍'}</button>
                                  <button onClick={() => setSelCars(p => p.filter((_,j)=>j!==i))} className="text-red-400 text-xs">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-4 pb-3">
                            <button onClick={() => setReplaceModal({ open:true, cat:'car' })}
                              className="text-xs px-3 py-1.5 rounded-lg transition" style={{ color:'var(--gold)', background:'rgba(201,168,76,0.08)' }}>
                              + Добавить машину
                            </button>
                          </div>
                        </div>

                        {/* Multi decors */}
                        <div className="rounded-2xl overflow-hidden border" style={{ background:'var(--card)', borderColor:'var(--border)' }}>
                          <div className="px-4 pt-3 pb-1 text-xs" style={{ color:'var(--text2)' }}>✨ Декор и эффекты ({selDecors.length})</div>
                          <div className="px-4 pb-3 space-y-2 max-h-36 overflow-y-auto">
                            {selDecors.map(d => (
                              <div key={d.id} className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate" style={{ color:'var(--text)' }}>{d.service_name}</span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs font-bold" style={{ color:'var(--gold)' }}>{fmtMln(d.price_uzs)}</span>
                                  <button onClick={() => setRatingModal({ type:'decor', item:d })} className="text-xs opacity-50 hover:opacity-100">⭐</button>
                                  <button onClick={() => setSelDecors(p => p.filter(x=>x.id!==d.id))} className="text-red-400 text-xs">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-4 pb-3">
                            <button onClick={() => setReplaceModal({ open:true, cat:'decor' })}
                              className="text-xs px-3 py-1.5 rounded-lg transition" style={{ color:'var(--gold)', background:'rgba(201,168,76,0.08)' }}>
                              + Добавить декор
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button onClick={book} disabled={!selHall && selArtists.length===0}
                          className="px-6 sm:px-8 py-3.5 rounded-2xl font-bold text-white text-sm btn-gold disabled:opacity-35">
                          Забронировать →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ══ MANUAL BUILDER ══ */}
          {activeTab === 'manual' && (
            <motion.div key="manual" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="space-y-8">

              {/* Date & budget */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-3xl border"
                style={{ background:'var(--card)', borderColor:'var(--border)' }}>
                <div>
                  <label className="block text-sm mb-2" style={{ color:'var(--text2)' }}>📅 Дата</label>
                  <input type="date" min={TODAY} value={date} onChange={e => setDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)' }} />
                </div>
                <div>
                  <Slider label="Бюджет" value={`$${budget.toLocaleString()}`} min={5000} max={50000} step={1000} cur={budget} onChange={setBudget} color="var(--gold)" />
                </div>
                <div>
                  <Slider label="Гостей" value={`${guests} чел.`} min={50} max={700} step={20} cur={guests} onChange={setGuests} color="#8B5CF6" />
                </div>
              </div>

              {/* Selected summary */}
              {(selHall || selArtists.length > 0 || selCars.length > 0 || selDecors.length > 0) && (
                <div className="p-5 rounded-3xl border" style={{ background:'rgba(201,168,76,0.06)', borderColor:'rgba(201,168,76,0.25)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <h3 className="font-bold" style={{ color:'var(--text)' }}>🛒 Ваш выбор</h3>
                    <div className="text-xl font-black" style={{ color:'var(--gold)' }}>${total().toLocaleString()}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selHall && <Tag label={selHall.name} onRemove={() => setSelHall(null)} />}
                    {selArtists.map(a => <Tag key={a.id} label={a.name} onRemove={() => setSelArtists(p=>p.filter(x=>x.id!==a.id))} />)}
                    {selCars.map((c,i) => <Tag key={i} label={c.model} onRemove={() => setSelCars(p=>p.filter((_,j)=>j!==i))} />)}
                    {selDecors.map(d => <Tag key={d.id} label={d.service_name} onRemove={() => setSelDecors(p=>p.filter(x=>x.id!==d.id))} />)}
                  </div>
                  {date && (selHall || selArtists.length > 0) && (
                    <button onClick={book} className="mt-4 px-6 py-3 rounded-xl font-bold text-white text-sm btn-gold">
                      Забронировать →
                    </button>
                  )}
                </div>
              )}

              {/* Halls */}
              <Section title="🏛️ Выберите зал">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {db.restaurants.filter(r => !r.pending).map(r => (
                    <SelectCard key={r.id} item={r} selected={selHall?.id === r.id}
                      name={r.name} sub={r.district} price={fmtMln(r.price_per_day_uzs)} img={r.image_url}
                      isFav={isFav(r,'hall')} onFav={() => toggleFav(r,'hall')}
                      onCompare={() => addCompare({ ...r, _type:'hall' })}
                      rating={getRating(r,'hall')} onRate={() => setRatingModal({ type:'hall', item:r })}
                      onClick={() => setSelHall(selHall?.id===r.id ? null : r)} single />
                  ))}
                </div>
              </Section>

              {/* Artists */}
              <Section title="🎤 Выберите артистов (можно несколько)">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {db.artists.filter(a => !a.pending).map(a => (
                    <SelectCard key={a.id} item={a} selected={!!selArtists.find(x=>x.id===a.id)}
                      name={a.name} sub={a.genre} price={`$${a.price_per_hour_usd}/ч`} img={a.image_url}
                      isFav={isFav(a,'artist')} onFav={() => toggleFav(a,'artist')}
                      onCompare={() => addCompare({ ...a, _type:'artist' })}
                      rating={getRating(a,'artist')} onRate={() => setRatingModal({ type:'artist', item:a })}
                      onClick={() => toggleArtist(a)} />
                  ))}
                </div>
              </Section>

              {/* Cars */}
              <Section title="🚗 Выберите машины (можно несколько)">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(db.cortege_stations[0]?.cars || []).map((c,i) => (
                    <SelectCard key={i} item={c} selected={!!selCars.find(x=>x.car_id===c.car_id)}
                      name={c.model} sub={`${c.color} · ${c.year}`} price={`$${c.price_per_day_usd}/д`} img={c.image_url}
                      isFav={isFav(c,'car')} onFav={() => toggleFav(c,'car')}
                      onCompare={() => addCompare({ ...c, _type:'car' })}
                      rating={getRating(c,'car')} onRate={() => setRatingModal({ type:'car', item:c })}
                      onClick={() => toggleCar(c)} />
                  ))}
                </div>
              </Section>

              {/* Decors */}
              <Section title="✨ Выберите декор и эффекты (можно несколько)">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {db.extra_services.map(d => (
                    <SelectCard key={d.id} item={d} selected={!!selDecors.find(x=>x.id===d.id)}
                      name={d.service_name} sub={d.type} price={fmtMln(d.price_uzs)} img={d.image_url}
                      isFav={isFav(d,'decor')} onFav={() => toggleFav(d,'decor')}
                      onCompare={() => addCompare({ ...d, _type:'decor' })}
                      rating={getRating(d,'decor')} onRate={() => setRatingModal({ type:'decor', item:d })}
                      onClick={() => toggleDecor(d)} />
                  ))}
                </div>
              </Section>
            </motion.div>
          )}

          {/* ══ MAP ══ */}
          {activeTab === 'map' && (
            <motion.div key="map" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <WeddingMap restaurants={db.restaurants.filter(r => !r.pending)} />
            </motion.div>
          )}

          {/* ══ CHAT ══ */}
          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="max-w-2xl mx-auto">
              <div className="rounded-3xl overflow-hidden border" style={{ background:'var(--card)', borderColor:'var(--border)' }}>
                <div className="flex items-center gap-3 p-5 border-b" style={{ borderColor:'var(--border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background:'linear-gradient(135deg,var(--gold),#7A5C1E)' }}>✨</div>
                  <div>
                    <div className="font-bold text-sm" style={{ color:'var(--text)' }}>AI Свадебный Консультант</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs" style={{ color:'var(--text2)' }}>Онлайн</span>
                    </div>
                  </div>
                </div>

                <div className="h-[360px] sm:h-[420px] overflow-y-auto p-4 sm:p-5 space-y-3">
                  {messages.map((m, i) => (
                    <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                      className={`flex ${m.role==='user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        m.role==='user' ? 'text-white rounded-br-sm' : 'rounded-bl-sm'
                      }`}
                        style={m.role==='user'
                          ? { background:'linear-gradient(135deg,var(--gold),#7A5C1E)' }
                          : { background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }
                        }>
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="px-4 py-3 rounded-2xl rounded-bl-sm border" style={{ background:'var(--card)', borderColor:'var(--border)' }}>
                        <div className="flex gap-1">
                          {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />)}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="px-4 pb-2 flex flex-wrap gap-2">
                  {['Сколько стоит той?','Лучший сезон?','Традиции никох','Как выбрать артиста?'].map(q => (
                    <button key={q} onClick={() => setChatInput(q)}
                      className="px-3 py-1.5 rounded-xl text-xs transition"
                      style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text2)' }}>
                      {q}
                    </button>
                  ))}
                </div>

                <div className="p-4 sm:p-5 pt-2 border-t" style={{ borderColor:'var(--border)' }}>
                  <div className="flex gap-2">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && sendChat()}
                      placeholder="Спросите о свадьбе..."
                      className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition"
                      style={{ background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)' }} />
                    <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-35 btn-gold flex-shrink-0">
                      ➤
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ FAVORITES ══ */}
          {activeTab === 'favorites' && (
            <motion.div key="favs" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              {favorites.length === 0 ? (
                <div className="text-center py-20" style={{ color:'var(--text2)' }}>
                  <div className="text-6xl mb-4">🤍</div>
                  <p className="font-medium">Избранное пусто</p>
                  <p className="text-sm mt-1">Нажмите 🤍 на любой карточке чтобы сохранить</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.map(({ key, type, item }) => (
                    <SelectCard key={key} item={item} selected={false}
                      name={item.name || item.model || item.service_name}
                      sub={item.district || item.genre || item.type || item.color}
                      price={item.price_per_hour_usd ? `$${item.price_per_hour_usd}/ч`
                        : item.price_per_day_usd ? `$${item.price_per_day_usd}/д`
                        : fmtMln(item.price_per_day_uzs || item.price_uzs || 0)}
                      img={item.image_url}
                      isFav={true} onFav={() => toggleFav(item, type)}
                      rating={getRating(item, type)} onRate={() => setRatingModal({ type, item })}
                      onClick={() => {}} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ══ COMPARE ══ */}
          {activeTab === 'compare' && (
            <motion.div key="compare" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <p className="text-sm mb-4" style={{ color:'var(--text2)' }}>
                Добавьте элементы для сравнения через кнопку ⚖️ на карточках в разделе "Подобрать сам"
              </p>
              {compareList.length === 0 ? (
                <div className="text-center py-20" style={{ color:'var(--text2)' }}>
                  <div className="text-6xl mb-4">⚖️</div>
                  <p className="font-medium">Нет элементов для сравнения</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-4 min-w-max">
                    {compareList.map((item, i) => (
                      <div key={i} className="w-64 rounded-2xl overflow-hidden border flex-shrink-0"
                        style={{ background:'var(--card)', borderColor:'var(--border)' }}>
                        <div className="relative h-36 overflow-hidden">
                          <img src={item.image_url||'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=300'} alt=""
                            className="w-full h-full object-cover" />
                          <div className="absolute inset-0" style={{ background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                          <button onClick={() => setCompareList(p=>p.filter((_,j)=>j!==i))}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-sm flex items-center justify-center">
                            ×
                          </button>
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="font-bold text-sm" style={{ color:'var(--text)' }}>{item.name||item.model||item.service_name}</div>
                          {item.district && <Row label="Район" val={item.district} />}
                          {item.max_capacity_people && <Row label="Вместимость" val={`${item.max_capacity_people} чел.`} />}
                          {item.price_per_day_uzs && <Row label="Цена/день" val={fmtMln(item.price_per_day_uzs)} />}
                          {item.price_per_hour_usd && <Row label="Цена/час" val={`$${item.price_per_hour_usd}`} />}
                          {item.price_per_day_usd && <Row label="Цена/день" val={`$${item.price_per_day_usd}`} />}
                          {item.price_uzs && <Row label="Цена" val={fmtMln(item.price_uzs)} />}
                          {item.genre && <Row label="Жанр" val={item.genre} />}
                          {item.kitchen_type && <Row label="Кухня" val={item.kitchen_type} />}
                          {item.year && <Row label="Год" val={item.year} />}
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

      {/* ══ Replace / Add modal ══ */}
      <AnimatePresence>
        {replaceModal.open && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)' }}
            onClick={() => setReplaceModal({ open:false, cat:null })}>
            <motion.div initial={{ y:50, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:50, opacity:0 }}
              className="w-full max-w-2xl max-h-[75vh] flex flex-col rounded-3xl overflow-hidden border"
              style={{ background:'var(--bg2)', borderColor:'var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor:'var(--border)' }}>
                <h3 className="font-bold" style={{ color:'var(--text)' }}>
                  {replaceModal.cat === 'artist' ? '+ Добавить артиста' :
                   replaceModal.cat === 'car'    ? '+ Добавить машину' :
                   replaceModal.cat === 'decor'  ? '+ Добавить декор' : 'Выбрать зал'}
                </h3>
                <button onClick={() => setReplaceModal({ open:false, cat:null })}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-lg transition"
                  style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text2)' }}>×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getModalItems(replaceModal.cat, db).map((item, idx) => (
                  <button key={item.id || item.car_id || idx}
                    onClick={() => {
                      if (replaceModal.cat === 'restaurant') setSelHall(item);
                      else if (replaceModal.cat === 'artist') toggleArtist(item);
                      else if (replaceModal.cat === 'car')    toggleCar(item);
                      else if (replaceModal.cat === 'decor')  toggleDecor(item);
                      // keep modal open for multi-select
                      if (replaceModal.cat === 'restaurant') setReplaceModal({ open:false, cat:null });
                    }}
                    className="flex items-center gap-3 p-3 rounded-2xl border text-left transition group"
                    style={{ background:'var(--card)', borderColor:'var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='rgba(201,168,76,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                    <img src={item.image_url||'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=150'} alt=""
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      onError={e => { e.target.src='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=150'; }} />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color:'var(--text)' }}>{item.name||item.model||item.service_name}</div>
                      <div className="text-xs font-bold mt-0.5" style={{ color:'var(--gold)' }}>
                        {item.price_per_hour_usd ? `$${item.price_per_hour_usd}/ч`
                          : item.price_per_day_usd ? `$${item.price_per_day_usd}/д`
                          : fmtMln(item.price_per_day_uzs||item.price_uzs||0)}
                      </div>
                    </div>
                    <span className="ml-auto text-lg" style={{ color:'var(--gold)' }}>+</span>
                  </button>
                ))}
              </div>
              {replaceModal.cat !== 'restaurant' && (
                <div className="p-4 border-t" style={{ borderColor:'var(--border)' }}>
                  <button onClick={() => setReplaceModal({ open:false, cat:null })}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm btn-gold">
                    Готово
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Rating Modal ══ */}
      <AnimatePresence>
        {ratingModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }}
            onClick={() => setRatingModal(null)}>
            <motion.div initial={{ scale:0.85, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.85, opacity:0 }}
              className="rounded-3xl p-8 w-full max-w-sm border text-center"
              style={{ background:'var(--bg2)', borderColor:'var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="text-4xl mb-3">⭐</div>
              <h3 className="font-bold text-lg mb-1" style={{ color:'var(--text)' }}>Ваша оценка</h3>
              <p className="text-sm mb-5 truncate" style={{ color:'var(--text2)' }}>
                {ratingModal.item?.name || ratingModal.item?.model || ratingModal.item?.service_name}
              </p>
              <div className="flex justify-center gap-2 mb-6">
                {[1,2,3,4,5].map(star => {
                  const key = `${ratingModal.type}_${ratingModal.item?.id || ratingModal.item?.car_id}`;
                  const cur = ratings[key] || 0;
                  return (
                    <button key={star} onClick={() => saveRating(key, star)}
                      className="text-3xl sm:text-4xl transition-transform hover:scale-125 active:scale-110">
                      {star <= cur ? '⭐' : '☆'}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setRatingModal(null)}
                className="w-full py-3 rounded-xl font-bold text-white text-sm btn-gold">
                Готово
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  function addCompare(item) {
    if (compareList.length >= 4) return;
    if (!compareList.find(x => (x.id||x.car_id) === (item.id||item.car_id))) {
      setCompareList(p => [...p, item]);
    }
    setActiveTab('compare');
  }
}

/* ── Sub-components ── */
const Slider = ({ label, value, min, max, step, cur, onChange, color }) => (
  <div>
    <div className="flex justify-between text-sm mb-2">
      <span style={{ color:'var(--text2)' }}>{label}</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={cur}
      onChange={e => onChange(+e.target.value)}
      style={{ accentColor: color }} />
  </div>
);

const PkgCard = ({ label, name, sub, price, img, isFav, onFav, rating, onRate, onReplace }) => (
  <motion.div whileHover={{ scale:1.01, y:-2 }} className="rounded-2xl overflow-hidden border group transition-all"
    style={{ background:'var(--card)', borderColor:'var(--border)' }}>
    <div className="relative h-32 sm:h-36 overflow-hidden">
      <img src={img||'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=500'} alt=""
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={e => { e.target.src='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=500'; }} />
      <div className="absolute inset-0" style={{ background:'linear-gradient(to top,rgba(0,0,0,0.75),transparent)' }} />
      <span className="absolute top-2.5 left-3 text-[10px] text-white/60 bg-black/40 px-2 py-0.5 rounded-full">{label}</span>
      <div className="absolute top-2.5 right-3 flex gap-1.5">
        <button onClick={onFav} className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-sm">{isFav?'❤️':'🤍'}</button>
      </div>
    </div>
    <div className="p-3.5">
      <div className="font-semibold text-sm truncate" style={{ color:'var(--text)' }}>{name}</div>
      <div className="text-xs mt-0.5 truncate" style={{ color:'var(--text2)' }}>{sub}</div>
      <div className="flex items-center justify-between mt-3">
        <span className="font-bold text-sm" style={{ color:'var(--gold)' }}>{price}</span>
        <div className="flex gap-2">
          <button onClick={onRate} className="text-xs transition" style={{ color:'var(--text2)' }}>
            {rating > 0 ? '⭐'.repeat(rating) : '☆ Оценить'}
          </button>
          <button onClick={onReplace} className="text-xs transition" style={{ color:'var(--text2)' }}>🔄</button>
        </div>
      </div>
    </div>
  </motion.div>
);

const SelectCard = ({ item, selected, name, sub, price, img, isFav, onFav, rating, onRate, onCompare, onClick, single }) => (
  <motion.div whileHover={{ scale:1.01, y:-2 }} onClick={onClick}
    className="rounded-2xl overflow-hidden border cursor-pointer transition-all relative"
    style={{ background:'var(--card)', borderColor: selected ? 'var(--gold)' : 'var(--border)',
             boxShadow: selected ? '0 0 0 2px var(--gold)' : 'none' }}>
    {selected && (
      <div className="absolute top-2.5 left-3 z-10 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ background:'var(--gold)' }}>✓</div>
    )}
    <div className="relative h-32 overflow-hidden">
      <img src={img||'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400'} alt=""
        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        onError={e => { e.target.src='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400'; }} />
      <div className="absolute inset-0" style={{ background:'linear-gradient(to top,rgba(0,0,0,0.65),transparent)' }} />
      <div className="absolute top-2 right-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={onFav} className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-xs">{isFav?'❤️':'🤍'}</button>
        <button onClick={onCompare} className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-xs">⚖️</button>
      </div>
    </div>
    <div className="p-3">
      <div className="font-semibold text-sm truncate" style={{ color:'var(--text)' }}>{name}</div>
      <div className="text-xs mt-0.5 truncate" style={{ color:'var(--text2)' }}>{sub}</div>
      <div className="flex items-center justify-between mt-2">
        <span className="font-bold text-sm" style={{ color:'var(--gold)' }}>{price}</span>
        <button onClick={e => { e.stopPropagation(); onRate(); }} className="text-xs" style={{ color:'var(--text2)' }}>
          {rating > 0 ? '⭐'.repeat(Math.min(rating,5)) : '☆'}
        </button>
      </div>
    </div>
  </motion.div>
);

const Section = ({ title, children }) => (
  <div>
    <h2 className="font-black text-lg mb-4" style={{ color:'var(--text)' }}>{title}</h2>
    {children}
  </div>
);

const Tag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
    style={{ background:'rgba(201,168,76,0.15)', color:'var(--gold)', border:'1px solid rgba(201,168,76,0.3)' }}>
    {label}
    <button onClick={onRemove} className="hover:opacity-60 transition">×</button>
  </span>
);

const Row = ({ label, val }) => (
  <div className="flex justify-between items-center text-xs">
    <span style={{ color:'var(--text2)' }}>{label}</span>
    <span className="font-semibold" style={{ color:'var(--text)' }}>{val}</span>
  </div>
);

function getModalItems(cat, db) {
  if (cat === 'restaurant') return db.restaurants.filter(r => !r.pending);
  if (cat === 'artist')     return db.artists.filter(a => !a.pending);
  if (cat === 'car')        return db.cortege_stations[0]?.cars || [];
  if (cat === 'decor')      return db.extra_services;
  return [];
}