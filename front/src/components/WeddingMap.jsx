import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const YANDEX_API_KEY = 'ВАШ_КЛЮЧ_СЮДА'; // ← вставь свой ключ Яндекс.Карт

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&q=80';

const DISTRICT_COORDS = {
  'Шайхантахур': [41.3111, 69.2797],
  'Яккасарай':   [41.2950, 69.2700],
  'Юнусабад':    [41.3600, 69.3000],
  'Мирабад':     [41.3050, 69.3050],
  'Чиланзар':    [41.2850, 69.2200],
  'Сергели':     [41.2300, 69.2800],
  'Учтепа':      [41.3150, 69.2300],
  'Алмазар':     [41.3500, 69.2400],
  'Бектемир':    [41.2600, 69.3700],
  'Яшнабод':     [41.3250, 69.3500],
  'Яшнобод':     [41.3250, 69.3500],
  'Мирзо-Улугбек': [41.3300, 69.3600],
};

const fmtMln = (uzs) => `~${Math.round((uzs || 0) / 1_000_000)} млн`;

export default function WeddingMap({ restaurants = [] }) {
  const mapRef   = useRef(null);
  const ymapRef  = useRef(null);
  const [selected, setSelected]   = useState(null);
  const [loaded, setLoaded]       = useState(false);
  const [search, setSearch]       = useState('');
  const [district, setDistrict]   = useState('all');
  const [minCap, setMinCap]       = useState(0);
  const [maxPrice, setMaxPrice]   = useState(150);
  const [sortBy, setSortBy]       = useState('capacity'); // capacity | price | name
  const [viewMode, setViewMode]   = useState('map'); // map | list
  const [showTop, setShowTop]     = useState(true);

  // Unique districts from data
  const districts = useMemo(() => {
    const set = new Set(restaurants.map(r => r.district).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [restaurants]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = restaurants.filter(r => {
      if (r.pending) return false;
      if (search && !r.name?.toLowerCase().includes(search.toLowerCase()) &&
          !r.district?.toLowerCase().includes(search.toLowerCase())) return false;
      if (district !== 'all' && r.district !== district) return false;
      const cap = r.max_capacity_people || r.seating_capacity || 0;
      if (minCap > 0 && cap < minCap) return false;
      const priceMln = (r.price_per_day_uzs || 0) / 1_000_000;
      if (priceMln > maxPrice) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'capacity') return (b.max_capacity_people || 0) - (a.max_capacity_people || 0);
      if (sortBy === 'price')    return (a.price_per_day_uzs || 0) - (b.price_per_day_uzs || 0);
      return (a.name || '').localeCompare(b.name || '', 'ru');
    });
    return list;
  }, [restaurants, search, district, minCap, maxPrice, sortBy]);

  // Top 10 by capacity
  const top10 = useMemo(() => {
    return [...restaurants]
      .filter(r => !r.pending && (r.max_capacity_people || 0) > 0)
      .sort((a, b) => (b.max_capacity_people || 0) - (a.max_capacity_people || 0))
      .slice(0, 10);
  }, [restaurants]);

  // Load Yandex Maps
  useEffect(() => {
    if (window.ymaps) { initMap(); return; }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_API_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => window.ymaps.ready(initMap);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (loaded && filtered.length >= 0) addMarkers();
  }, [loaded, filtered]);

  const initMap = () => {
    if (!mapRef.current) return;
    ymapRef.current = new window.ymaps.Map(mapRef.current, {
      center: [41.3111, 69.2797],
      zoom: 11,
      controls: ['zoomControl', 'fullscreenControl', 'geolocationControl'],
    });
    setLoaded(true);
  };

  const getCoords = (r) => {
    if (r.lat && r.lng) return [r.lat, r.lng];
    if (DISTRICT_COORDS[r.district]) {
      const [lat, lng] = DISTRICT_COORDS[r.district];
      // small deterministic offset by id so markers don't stack
      const seed = (r.id || r.name || '').toString().split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      return [lat + ((seed % 20) - 10) * 0.002, lng + ((seed % 17) - 8) * 0.002];
    }
    return [41.3111 + Math.random() * 0.04, 69.27 + Math.random() * 0.04];
  };

  const addMarkers = () => {
    if (!ymapRef.current) return;
    ymapRef.current.geoObjects.removeAll();

    filtered.forEach((r) => {
      const coords = getCoords(r);
      const isTop = top10.some(t => t.id === r.id);

      const placemark = new window.ymaps.Placemark(
        coords,
        {
          balloonContentHeader: r.name,
          balloonContentBody: `
            <div style="font-size:13px;line-height:1.4">
              <b>${r.district || ''}</b><br/>
              👥 до ${r.max_capacity_people || '—'} чел.<br/>
              💰 ${fmtMln(r.price_per_day_uzs)}
            </div>
          `,
          hintContent: r.name,
        },
        {
          preset: isTop ? 'islands#redIcon' : 'islands#goldIcon',
          iconColor: isTop ? '#ef4444' : '#C9A84C',
        }
      );

      placemark.events.add('click', () => {
        setSelected(r);
        ymapRef.current.setCenter(coords, 14, { duration: 300 });
      });
      ymapRef.current.geoObjects.add(placemark);
    });

    // Fit bounds if there are markers
    if (filtered.length > 0) {
      try {
        ymapRef.current.setBounds(ymapRef.current.geoObjects.getBounds(), {
          checkZoomRange: true,
          zoomMargin: 40,
        });
      } catch {}
    }
  };

  const flyTo = (r) => {
    setSelected(r);
    if (!ymapRef.current) return;
    const coords = getCoords(r);
    ymapRef.current.setCenter(coords, 14, { duration: 400 });
  };

  return (
    <div className="space-y-5">
      {/* Header + controls */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
        <div className="flex-1">
          <h2 className="font-display text-xl font-black mb-1" style={{ color: 'var(--text)' }}>
            Карта <span style={{ color: 'var(--gold)' }}>залов</span>
          </h2>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            {filtered.length} из {restaurants.filter(r => !r.pending).length} залов · реальные координаты
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('map')}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={viewMode === 'map'
              ? { background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, black))', color: '#fff' }
              : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            🗺️ Карта
          </button>
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={viewMode === 'list'
              ? { background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, black))', color: '#fff' }
              : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            📋 Список
          </button>
          <button
            onClick={() => setShowTop(s => !s)}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={showTop
              ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }
              : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            🏆 Топ-10
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-2xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div>
          <label className="block text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text2)' }}>Поиск</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Название или район..."
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text2)' }}>Район</label>
          <select
            value={district}
            onChange={e => setDistrict(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {districts.map(d => (
              <option key={d} value={d}>{d === 'all' ? 'Все районы' : d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text2)' }}>
            Мин. гостей: {minCap || 'любое'}
          </label>
          <input type="range" min={0} max={700} step={50} value={minCap}
            onChange={e => setMinCap(+e.target.value)}
            className="w-full" style={{ accentColor: 'var(--gold)' }} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text2)' }}>
            Макс. цена: {maxPrice} млн
          </label>
          <input type="range" min={20} max={150} step={5} value={maxPrice}
            onChange={e => setMaxPrice(+e.target.value)}
            className="w-full" style={{ accentColor: 'var(--gold)' }} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text2)' }}>Сортировка</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <option value="capacity">По вместимости</option>
            <option value="price">По цене (дешевле)</option>
            <option value="name">По названию</option>
          </select>
        </div>
      </div>

      {/* Top-10 strip */}
      <AnimatePresence>
        {showTop && top10.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#f87171' }}>🏆 Топ-10 залов</span>
              <span className="text-[10px]" style={{ color: 'var(--text2)' }}>по вместимости</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {top10.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => flyTo(r)}
                  className="flex-shrink-0 w-44 rounded-2xl overflow-hidden border text-left transition-all hover:scale-[1.02]"
                  style={{
                    background: 'var(--card)',
                    borderColor: selected?.id === r.id ? 'var(--gold)' : 'var(--border)',
                    boxShadow: selected?.id === r.id ? '0 0 0 1px var(--gold)' : 'none',
                  }}>
                  <div className="relative h-24">
                    <img
                      src={r.image_url || FALLBACK_IMG}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => { e.target.src = FALLBACK_IMG; }}
                    />
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: i < 3 ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'rgba(0,0,0,0.6)' }}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{r.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text2)' }}>
                      👥 {r.max_capacity_people} · {fmtMln(r.price_per_day_uzs)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map / List */}
      {viewMode === 'map' ? (
        <div className="relative rounded-3xl overflow-hidden border"
          style={{ height: '62vh', minHeight: 420, borderColor: 'var(--border)' }}>
          <div ref={mapRef} className="w-full h-full" />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
              <div className="text-center">
                <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: 'rgba(var(--gold-rgb),0.25)', borderTopColor: 'var(--gold)' }} />
                <p className="text-sm" style={{ color: 'var(--text2)' }}>Загрузка карты...</p>
              </div>
            </div>
          )}
          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#C9A84C' }}>● Обычный</span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#f87171' }}>● Топ-10</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16" style={{ color: 'var(--text2)' }}>
              Нет залов по выбран фильтрам
            </div>
          ) : filtered.map(r => (
            <button
              key={r.id}
              onClick={() => flyTo(r)}
              className="rounded-2xl overflow-hidden border text-left transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--card)',
                borderColor: selected?.id === r.id ? 'var(--gold)' : 'var(--border)',
              }}>
              <div className="relative h-36">
                <img
                  src={r.image_url || FALLBACK_IMG}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { e.target.src = FALLBACK_IMG; }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                <div className="absolute bottom-2 left-3 right-3 flex justify-between items-end">
                  <span className="text-white font-bold text-sm truncate">{r.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(var(--gold-rgb),0.9)', color: '#111' }}>
                    {fmtMln(r.price_per_day_uzs)}
                  </span>
                </div>
              </div>
              <div className="p-3 flex flex-wrap gap-2 text-[11px]" style={{ color: 'var(--text2)' }}>
                <span>📍 {r.district}</span>
                <span>👥 {r.max_capacity_people}</span>
                {r.has_led_screen && <span>💡 LED</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-xs" style={{ color: 'var(--text2)' }}>
        Нажмите на маркер или карточку — откроется подробная информация
      </p>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
            onClick={() => setSelected(null)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl overflow-hidden border"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="relative h-52">
                <img
                  src={selected.image_url || FALLBACK_IMG}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { e.target.src = FALLBACK_IMG; }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--bg2), transparent 60%)' }} />
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white text-lg"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>×</button>
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--gold)' }}>
                    {selected.district}
                  </div>
                  <h3 className="text-xl font-black text-white leading-tight">{selected.name}</h3>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm" style={{ color: 'var(--text2)' }}>📍 {selected.address || selected.district}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { label: 'Вместимость', val: `${selected.max_capacity_people || '—'} чел.` },
                    { label: 'Мест за столами', val: `${selected.seating_capacity || '—'} чел.` },
                    { label: 'Официанты', val: `${selected.waiters_count || '—'} чел.` },
                    { label: 'Парковка', val: `${selected.parking_spaces || '—'} мест` },
                    { label: 'Сцена', val: selected.stage_size || '—' },
                    { label: 'Кухня', val: selected.kitchen_type || '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                      <div className="text-[10px] mb-1" style={{ color: 'var(--text2)' }}>{label}</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Цена за день</div>
                    <div className="text-2xl font-black" style={{ color: 'var(--gold)' }}>
                      {fmtMln(selected.price_per_day_uzs)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selected.has_led_screen && (
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                        💡 LED
                      </span>
                    )}
                    {selected.phone && (
                      <a href={`tel:${selected.phone}`}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, black))' }}>
                        📞 Позвонить
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
