import React, { useEffect, useRef, useState } from 'react';

const YANDEX_API_KEY = 'ВАШ_КЛЮЧ_СЮДА'; // ← вставь свой ключ

// Координаты районов Ташкента (примерные)
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
  'Мирзо-Улугбек': [41.3300, 69.3600],
};

export default function WeddingMap({ restaurants }) {
  const mapRef = useRef(null);
  const ymapRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.ymaps) { initMap(); return; }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_API_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => window.ymaps.ready(initMap);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (loaded && restaurants.length > 0) addMarkers();
  }, [loaded, restaurants]);

  const initMap = () => {
    ymapRef.current = new window.ymaps.Map(mapRef.current, {
      center: [41.3111, 69.2797],
      zoom: 12,
      controls: ['zoomControl', 'fullscreenControl'],
    });
    setLoaded(true);
  };

  const addMarkers = () => {
    if (!ymapRef.current) return;
    ymapRef.current.geoObjects.removeAll();

    restaurants.forEach((r) => {
      const coords = DISTRICT_COORDS[r.district] || [41.3111 + Math.random() * 0.05, 69.27 + Math.random() * 0.05];

      const placemark = new window.ymaps.Placemark(
        coords,
        { balloonContent: r.name, hintContent: r.name },
        {
          preset: 'islands#goldIcon',
          iconColor: '#C9A84C',
        }
      );

      placemark.events.add('click', () => setSelected(r));
      ymapRef.current.geoObjects.add(placemark);
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative rounded-3xl overflow-hidden border border-white/10" style={{ height: '65vh', minHeight: 400 }}>
        <div ref={mapRef} className="w-full h-full" />
        {!loaded && (
          <div className="absolute inset-0 bg-[#0d0d1a] flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/40 text-sm">Загрузка карты...</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-white/30 text-xs text-center">
        Нажмите на маркер на карте чтобы увидеть информацию о зале
      </p>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-[#111120] border border-white/12 rounded-3xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Image */}
            <div className="relative h-48 sm:h-56">
              <img src={selected.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'}
                alt={selected.name}
                className="w-full h-full object-cover"
                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111120] via-transparent to-transparent" />
              <button onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white/70 hover:text-white flex items-center justify-center text-lg transition">
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-white text-xl font-bold">{selected.name}</h3>
                <p className="text-white/45 text-sm mt-1">📍 {selected.district} · {selected.address}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Вместимость', val: `${selected.max_capacity_people} чел.` },
                  { label: 'Мест за столами', val: `${selected.seating_capacity} чел.` },
                  { label: 'Официанты', val: `${selected.waiters_count} чел.` },
                  { label: 'Парковка', val: `${selected.parking_spaces} мест` },
                  { label: 'Сцена', val: selected.stage_size },
                  { label: 'Кухня', val: selected.kitchen_type },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/35 text-xs mb-1">{label}</div>
                    <div className="text-white font-semibold text-sm">{val}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/8">
                <div>
                  <div className="text-white/35 text-xs">Цена за день</div>
                  <div className="text-[#C9A84C] font-black text-xl">
                    ~{Math.round((selected.price_per_day_uzs || 0) / 1_000_000)} млн сум
                  </div>
                </div>
                {selected.has_led_screen && (
                  <span className="px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-medium">
                    💡 LED экран
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}