import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Ключ Яндекс.Карт — замените на свой
const YANDEX_API_KEY = 'ВАШ_КЛЮЧ_СЮДА';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&q=80';

const DISTRICT_COORDS = {
  'Шайхантахур':   [41.3111, 69.2797],
  'Яккасарай':     [41.2950, 69.2700],
  'Юнусабад':      [41.3600, 69.3000],
  'Мирабад':       [41.3050, 69.3050],
  'Чиланзар':      [41.2850, 69.2200],
  'Сергели':       [41.2300, 69.2800],
  'Учтепа':        [41.3150, 69.2300],
  'Алмазар':       [41.3500, 69.2400],
  'Бектемир':      [41.2600, 69.3700],
  'Яшнабод':       [41.3250, 69.3500],
  'Яшнобод':       [41.3250, 69.3500],
  'Мирзо-Улугбек': [41.3300, 69.3600],
};

const LANDMARKS = [
  // ── Площади и скверы ──
  { name: 'Площадь Независимости', coords: [41.311151, 69.279737], icon: '🏛️', type: 'square' },
  { name: 'Площадь Амира Тимура', coords: [41.3114, 69.2796], icon: '🗿', type: 'square' },
  { name: 'Сквер Амира Тимура', coords: [41.3118, 69.2799], icon: '🌳', type: 'park' },
  { name: 'Сквер Бабура', coords: [41.2975, 69.2480], icon: '🌳', type: 'park' },
  { name: 'Сквер «Аллея поэтов»', coords: [41.3200, 69.2550], icon: '📜', type: 'park' },
  { name: 'Национальный парк Узбекистана', coords: [41.3400, 69.2900], icon: '🌲', type: 'park' },
  { name: 'Ботанический сад', coords: [41.3450, 69.3150], icon: '🌺', type: 'park' },
  { name: 'Парк «Анхор»', coords: [41.3180, 69.2600], icon: '🌊', type: 'park' },
  { name: 'Парк Юнусабад', coords: [41.3650, 69.2900], icon: '🌲', type: 'park' },
  { name: 'Парк «Дружба народов»', coords: [41.3050, 69.2650], icon: '🌳', type: 'park' },
  // ── Моллы и ТЦ ──
  { name: 'Tashkent City Mall', coords: [41.3165, 69.2485], icon: '🏙️', type: 'mall' },
  { name: 'Next Mall', coords: [41.2856, 69.2034], icon: '🛍️', type: 'mall' },
  { name: 'Mega Planet', coords: [41.3270, 69.2870], icon: '🛒', type: 'mall' },
  { name: 'Samarqand Darvoza', coords: [41.2990, 69.2150], icon: '🛍️', type: 'mall' },
  { name: 'Magic City', coords: [41.3110, 69.2480], icon: '🎢', type: 'mall' },
  { name: 'Compass Mall', coords: [41.2950, 69.2750], icon: '🧭', type: 'mall' },
  { name: 'Beruniy Mall', coords: [41.3450, 69.2400], icon: '🛍️', type: 'mall' },
  { name: 'Asia Park', coords: [41.2800, 69.2500], icon: '🏬', type: 'mall' },
  // ── Гостиницы ──
  { name: 'Гостиница «Узбекистан»', coords: [41.3112, 69.2820], icon: '🏨', type: 'hotel' },
  { name: 'Hyatt Regency Tashkent', coords: [41.3145, 69.2810], icon: '🏨', type: 'hotel' },
  { name: 'Hilton Tashkent City', coords: [41.3170, 69.2500], icon: '🏨', type: 'hotel' },
  { name: 'International Hotel Tashkent', coords: [41.3180, 69.2850], icon: '🏨', type: 'hotel' },
  { name: 'Wyndham Tashkent', coords: [41.3100, 69.2750], icon: '🏨', type: 'hotel' },
  { name: 'City Palace Hotel', coords: [41.3120, 69.2780], icon: '🏨', type: 'hotel' },
  // ── Метро (основные станции) ──
  { name: 'Метро «Амир Темур хиёбони»', coords: [41.3115, 69.2797], icon: '🚇', type: 'metro' },
  { name: 'Метро «Минор»', coords: [41.3250, 69.2850], icon: '🚇', type: 'metro' },
  { name: 'Метро «Бодомзор»', coords: [41.3350, 69.2900], icon: '🚇', type: 'metro' },
  { name: 'Метро «Шахристан»', coords: [41.3500, 69.2950], icon: '🚇', type: 'metro' },
  { name: 'Метро «Юнусабад»', coords: [41.3600, 69.3000], icon: '🚇', type: 'metro' },
  { name: 'Метро «Чорсу»', coords: [41.3265, 69.2350], icon: '🚇', type: 'metro' },
  { name: 'Метро «Гафура Гуляма»', coords: [41.3200, 69.2500], icon: '🚇', type: 'metro' },
  { name: 'Метро «Пахтакор»', coords: [41.3050, 69.2500], icon: '🚇', type: 'metro' },
  { name: 'Метро «Алишер Навои»', coords: [41.3100, 69.2550], icon: '🚇', type: 'metro' },
  { name: 'Метро «Узбекистан»', coords: [41.3000, 69.2600], icon: '🚇', type: 'metro' },
  { name: 'Метро «Космонавтов»', coords: [41.2950, 69.2650], icon: '🚇', type: 'metro' },
  { name: 'Метро «Ойбек»', coords: [41.2980, 69.2750], icon: '🚇', type: 'metro' },
  { name: 'Метро «Дустлик»', coords: [41.2900, 69.2300], icon: '🚇', type: 'metro' },
  { name: 'Метро «Чиланзар»', coords: [41.2850, 69.2200], icon: '🚇', type: 'metro' },
  { name: 'Метро «Мирзо Улугбек»', coords: [41.3300, 69.3400], icon: '🚇', type: 'metro' },
  // ── Прочее известное ──
  { name: 'Базар Чорсу', coords: [41.3265, 69.2350], icon: '🕌', type: 'market' },
  { name: 'Аэропорт Ташкент (TAS)', coords: [41.2579, 69.2812], icon: '✈️', type: 'transport' },
  { name: 'Ж/д вокзал Ташкент', coords: [41.2924, 69.2714], icon: '🚂', type: 'transport' },
  { name: 'Телевышка Ташкента', coords: [41.3405, 69.2850], icon: '📡', type: 'sight' },
  { name: 'Мечеть Хаст-Имам', coords: [41.3380, 69.2370], icon: '🕌', type: 'sight' },
  { name: 'Музей искусств', coords: [41.3050, 69.2780], icon: '🖼️', type: 'sight' },
];

const fmtMln = (uzs) => `~${Math.round((uzs || 0) / 1_000_000)} млн`;

export default function WeddingMap({ restaurants = [] }) {
  const mapRef  = useRef(null);
  const ymapRef = useRef(null);

  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded]     = useState(false);
  const [search, setSearch]     = useState('');
  const [district, setDistrict] = useState('all');
  const [minCap, setMinCap]     = useState(0);
  const [maxPrice, setMaxPrice] = useState(200);
  const [sortBy, setSortBy]     = useState('capacity');
  const [viewMode, setViewMode] = useState('map');
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showTop, setShowTop]   = useState(true);

  const districts = useMemo(() => {
    const set = new Set(restaurants.map(r => r.district).filter(Boolean));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))];
  }, [restaurants]);

  const filtered = useMemo(() => {
    let list = restaurants.filter(r => {
      if (r.pending) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.name?.toLowerCase().includes(q) && !r.district?.toLowerCase().includes(q) && !r.address?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (district !== 'all' && r.district !== district) return false;
      const cap = r.max_capacity_people || r.seating_capacity || 0;
      if (minCap > 0 && cap < minCap) return false;
      const priceMln = (r.price_per_day_uzs || 0) / 1_000_000;
      if (priceMln > maxPrice) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'capacity') return (b.max_capacity_people || 0) - (a.max_capacity_people || 0);
      if (sortBy === 'price') return (a.price_per_day_uzs || 0) - (b.price_per_day_uzs || 0);
      return (a.name || '').localeCompare(b.name || '', 'ru');
    });
    return list;
  }, [restaurants, search, district, minCap, maxPrice, sortBy]);

  const top10 = useMemo(() => {
    return [...restaurants]
      .filter(r => !r.pending && (r.max_capacity_people || 0) > 0)
      .sort((a, b) => (b.max_capacity_people || 0) - (a.max_capacity_people || 0))
      .slice(0, 10);
  }, [restaurants]);

  useEffect(() => {
    if (window.ymaps) {
      window.ymaps.ready(initMap);
      return;
    }
    const existing = document.querySelector('script[data-yandex-maps]');
    if (existing) {
      existing.addEventListener('load', () => window.ymaps?.ready(initMap));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_API_KEY}&lang=ru_RU`;
    script.async = true;
    script.dataset.yandexMaps = '1';
    script.onload = () => window.ymaps.ready(initMap);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (loaded) addMarkers();
  }, [loaded, filtered, showLandmarks, showTop]);

  const initMap = () => {
    if (!mapRef.current || ymapRef.current) return;
    ymapRef.current = new window.ymaps.Map(mapRef.current, {
      center: [41.3111, 69.2797],
      zoom: 12,
      controls: ['zoomControl', 'geolocationControl'],
      type: 'yandex#map',
    }, { suppressMapOpenBlock: true });

    try {
      ymapRef.current.container.getElement().style.filter = 'saturate(0.8) brightness(0.82) contrast(1.05)';
      ymapRef.current.container.getElement().style.background = '#0a1628';
    } catch (_) {}

    setLoaded(true);
  };

  const getCoords = (r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      return [lat, lng];
    }
    if (r.district && DISTRICT_COORDS[r.district]) {
      const [dLat, dLng] = DISTRICT_COORDS[r.district];
      const seed = String(r.id || r.name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      return [dLat + ((seed % 20) - 10) * 0.0018, dLng + ((seed % 17) - 8) * 0.0018];
    }
    const seed = String(r.id || r.name || 'x').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return [41.3111 + ((seed % 30) - 15) * 0.003, 69.2797 + ((seed % 25) - 12) * 0.003];
  };

  const addMarkers = () => {
    if (!ymapRef.current || !window.ymaps) return;
    ymapRef.current.geoObjects.removeAll();

    filtered.forEach((r) => {
      const coords = getCoords(r);
      const isTop = top10.some(t => t.id === r.id);

      const placemark = new window.ymaps.Placemark(
        coords,
        {
          balloonContentHeader: `<strong>${r.name || 'Зал'}</strong>`,
          balloonContentBody: `
            <div style="font-size:13px;line-height:1.4">
              <div>${r.district || ''} ${r.address ? '· ' + r.address : ''}</div>
              <div>Гостей: ${r.max_capacity_people || r.seating_capacity || '—'}</div>
              <div style="color:#c9a84c;font-weight:700">${fmtMln(r.price_per_day_uzs)} сум/день</div>
            </div>
          `,
          hintContent: r.name,
        },
        {
          preset: isTop && showTop ? 'islands#goldCircleDotIcon' : 'islands#darkBlueCircleDotIcon',
          iconColor: isTop && showTop ? '#c9a84c' : '#1e3a5f',
        }
      );

      placemark.events.add('click', () => setSelected(r));
      ymapRef.current.geoObjects.add(placemark);
    });

    if (showLandmarks) {
      const typeColor = {
        square: '#94a3b8', park: '#4ade80', mall: '#60a5fa', hotel: '#f472b6',
        metro: '#a78bfa', market: '#fb923c', transport: '#38bdf8', sight: '#fbbf24',
      };
      LANDMARKS.forEach((lm) => {
        const color = typeColor[lm.type] || '#94a3b8';
        const pm = new window.ymaps.Placemark(
          lm.coords,
          {
            balloonContent: `<div style="padding:4px 2px"><strong style="font-size:14px">${lm.icon} ${lm.name}</strong></div>`,
            hintContent: `${lm.icon} ${lm.name}`,
            iconCaption: lm.name,
          },
          {
            preset: 'islands#circleIcon',
            iconColor: color,
            iconCaptionMaxWidth: 120,
          }
        );
        ymapRef.current.geoObjects.add(pm);
      });
    }

    try {
      if (filtered.length > 0) {
        const bounds = ymapRef.current.geoObjects.getBounds();
        if (bounds) ymapRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 });
      }
    } catch (_) {}
  };

  const focusOn = (r) => {
    setSelected(r);
    if (!ymapRef.current) return;
    const coords = getCoords(r);
    ymapRef.current.setCenter(coords, 15, { duration: 300 });
  };

  return (
    <div className="rounded-3xl overflow-hidden border"
      style={{ background: 'linear-gradient(180deg,#0a1020 0%,#0f1a2e 100%)', borderColor: 'rgba(232,213,163,0.15)' }}>

      <div className="p-4 sm:p-5 space-y-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black" style={{ color: '#f3ebe0' }}>Карта залов Ташкента</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(243,235,224,0.5)' }}>
              {filtered.length} из {restaurants.filter(r => !r.pending).length} площадок · координаты из профиля зала
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setViewMode(v => v === 'map' ? 'list' : 'map')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#e8d5a3', border: '1px solid rgba(232,213,163,0.2)' }}>
              {viewMode === 'map' ? 'Список' : 'Карта'}
            </button>
            <button type="button" onClick={() => setShowLandmarks(v => !v)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: showLandmarks ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)',
                color: showLandmarks ? '#e8d5a3' : 'rgba(243,235,224,0.5)',
                border: '1px solid rgba(232,213,163,0.2)',
              }}>
              Достопримечательности
            </button>
            <button type="button" onClick={() => setShowTop(v => !v)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: showTop ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)',
                color: showTop ? '#e8d5a3' : 'rgba(243,235,224,0.5)',
                border: '1px solid rgba(232,213,163,0.2)',
              }}>
              Топ-10
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск зала, района, адреса…"
            className="flex-1 min-w-[160px] px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3ebe0' }}
          />
          <select value={district} onChange={e => setDistrict(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3ebe0' }}>
            {districts.map(d => (
              <option key={d} value={d} style={{ background: '#0f1a2e' }}>
                {d === 'all' ? 'Все районы' : d}
              </option>
            ))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3ebe0' }}>
            <option value="capacity" style={{ background: '#0f1a2e' }}>По вместимости</option>
            <option value="price" style={{ background: '#0f1a2e' }}>По цене</option>
            <option value="name" style={{ background: '#0f1a2e' }}>По имени</option>
          </select>
          <input type="number" min={0} value={minCap || ''} onChange={e => setMinCap(Number(e.target.value) || 0)}
            placeholder="Мин. гостей"
            className="w-28 px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3ebe0' }}
          />
        </div>
      </div>

      <div className={`grid ${viewMode === 'map' ? 'grid-cols-1 lg:grid-cols-[1fr_280px]' : 'grid-cols-1'}`}>
        {viewMode === 'map' && (
          <div className="relative">
            <div ref={mapRef} className="w-full h-[420px] sm:h-[520px]" style={{ background: '#0a1628' }} />
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a1628' }}>
                <div className="text-sm" style={{ color: 'rgba(243,235,224,0.6)' }}>Загрузка карты Яндекс…</div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs text-[10px] px-3 py-2 rounded-xl"
              style={{ background: 'rgba(10,16,32,0.85)', color: 'rgba(243,235,224,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Синие метки — залы. Золотые — топ по вместимости. Серые — достопримечательности.
              Координаты из профиля зала (широта / долгота).
            </div>
          </div>
        )}

        <div className={`${viewMode === 'map' ? 'max-h-[520px]' : 'max-h-[480px]'} overflow-y-auto p-3 space-y-2`}
          style={{ borderLeft: viewMode === 'map' ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'rgba(243,235,224,0.45)' }}>Ничего не найдено</div>
          ) : (
            filtered.map(r => {
              const isTop = top10.some(t => t.id === r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => focusOn(r)}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  style={{
                    background: selected?.id === r.id ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected?.id === r.id ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="flex gap-3">
                    <img
                      src={r.image_url || FALLBACK_IMG}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      onError={e => { e.target.src = FALLBACK_IMG; }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate" style={{ color: '#f3ebe0' }}>
                        {isTop && showTop ? '★ ' : ''}{r.name}
                      </div>
                      <div className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(243,235,224,0.5)' }}>
                        {r.district || '—'}{r.address ? ` · ${r.address}` : ''}
                      </div>
                      <div className="flex justify-between mt-1 text-xs">
                        <span style={{ color: 'rgba(243,235,224,0.55)' }}>
                          Гостей: {r.max_capacity_people || r.seating_capacity || '—'}
                        </span>
                        <span className="font-bold" style={{ color: '#e8d5a3' }}>
                          {fmtMln(r.price_per_day_uzs)}
                        </span>
                      </div>
                      {!(r.lat && r.lng) && (
                        <div className="text-[10px] mt-1" style={{ color: 'rgba(251,191,36,0.7)' }}>
                          Нет точных координат — показан район
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(8,12,24,0.7)', backdropFilter: 'blur(10px)' }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl overflow-hidden border"
              style={{ background: 'linear-gradient(165deg,#0f172a,#1a2438)', borderColor: 'rgba(232,213,163,0.25)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="relative h-44">
                <img
                  src={selected.image_url || FALLBACK_IMG}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { e.target.src = FALLBACK_IMG; }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0f172a, transparent 60%)' }} />
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white"
                  style={{ background: 'rgba(0,0,0,0.45)' }}
                >×</button>
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-xl font-black" style={{ color: '#f3ebe0' }}>{selected.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(243,235,224,0.6)' }}>
                    {selected.district}{selected.address ? ` · ${selected.address}` : ''}
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Вместимость', val: `${selected.max_capacity_people || selected.seating_capacity || '—'} чел.` },
                    { label: 'Мест за столами', val: `${selected.seating_capacity || '—'} чел.` },
                    { label: 'Официанты', val: `${selected.waiters_count || '—'} чел.` },
                    { label: 'Парковка', val: `${selected.parking_spaces || '—'} мест` },
                    { label: 'Сцена', val: selected.stage_size || '—' },
                    { label: 'Кухня', val: selected.kitchen_type || '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="text-[10px] mb-1" style={{ color: 'rgba(243,235,224,0.45)' }}>{label}</div>
                      <div className="text-sm font-semibold" style={{ color: '#f3ebe0' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(243,235,224,0.45)' }}>Цена за день</div>
                    <div className="text-2xl font-black" style={{ color: '#e8d5a3' }}>{fmtMln(selected.price_per_day_uzs)}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {selected.has_led_screen && (
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                        LED-экран
                      </span>
                    )}
                    <span className="px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'rgba(201,168,76,0.15)', color: '#e8d5a3', border: '1px solid rgba(201,168,76,0.3)' }}>
                      Бронь через платформу
                    </span>
                  </div>
                </div>
                {(selected.lat && selected.lng) && (
                  <p className="text-[10px]" style={{ color: 'rgba(243,235,224,0.4)' }}>
                    Координаты: {Number(selected.lat).toFixed(5)}, {Number(selected.lng).toFixed(5)}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
