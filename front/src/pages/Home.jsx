import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IoSparkles, IoCalendarOutline, IoGitCompareOutline, IoReloadOutline, IoArrowForwardOutline } from 'react-icons/io5';
import AILoader from '../components/AILoader';

const Home = () => {
  const navigate = useNavigate();
  const [budget, setBudget] = useState(15000);
  const [guests, setGuests] = useState(250);
  const [date, setDate] = useState('');
  const [carCount, setCarCount] = useState(1); // До 20 машин
  const [loading, setLoading] = useState(false);
  const [generatedPackage, setGeneratedPackage] = useState(null);
  const [replaceModal, setReplaceModal] = useState({ isOpen: false, category: null });
  const [dbData, setDbData] = useState({ artists: [], restaurants: [], cortege_stations: [], extra_services: [] });

  useEffect(() => {
    fetch('http://localhost:5000/artists').then(res => res.json()).then(data => setDbData(prev => ({ ...prev, artists: data })));
    fetch('http://localhost:5000/restaurants').then(res => res.json()).then(data => setDbData(prev => ({ ...prev, restaurants: data })));
    fetch('http://localhost:5000/cortege_stations').then(res => res.json()).then(data => setDbData(prev => ({ ...prev, cortege_stations: data })));
    fetch('http://localhost:5000/extra_services').then(res => res.json()).then(data => setDbData(prev => ({ ...prev, extra_services: data })));
  }, []);

  const generateWedding = () => {
    setLoading(true);
    setGeneratedPackage(null);

    setTimeout(() => {
      const rest = dbData.restaurants.find(r => r.max_capacity_people >= guests) || dbData.restaurants[0];
      const art = dbData.artists[0];
      const carGroup = dbData.cortege_stations[0]?.cars || [];
      const vehicle = carGroup[0];
      const ext = dbData.extra_services[0];

      setGeneratedPackage({ restaurant: rest, artist: art, car: vehicle, decor: ext });
      setLoading(false);
    }, 4000);
  };

  const calculateTotal = () => {
    if (!generatedPackage) return 0;
    const restUSD = (generatedPackage.restaurant?.price_per_day_uzs || 0) / 12700;
    const decorUSD = (generatedPackage.decor?.price_uzs || 0) / 12700;
    const artistUSD = generatedPackage.artist?.price_per_hour_usd || 0;
    const carUSD = (generatedPackage.car?.price_per_day_usd || 0) * carCount; // Умножаем на количество машин
    return Math.round(restUSD + artistUSD + carUSD + decorUSD);
  };

  const handlePushToCheckout = async () => {
    if (!generatedPackage) return;
    
    const newOrder = {
      id: "ORDER-" + Date.now(),
      date: date,
      guests: guests,
      total_price_usd: calculateTotal(),
      car_count: carCount,
      restaurant: generatedPackage.restaurant,
      artist: generatedPackage.artist,
      car: generatedPackage.car,
      decor: generatedPackage.decor,
      status: "pending"
    };

    try {
      await fetch('http://localhost:5000/wedding_orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
      // Переходим на страницу Проверки брони
      navigate('/checkout');
    } catch (error) {
      console.error("Ошибка сохранения брони:", error);
    }
  };

  const getModalItems = () => {
    if (replaceModal.category === 'restaurant') return dbData.restaurants;
    if (replaceModal.category === 'artist') return dbData.artists;
    if (replaceModal.category === 'car') return dbData.cortege_stations[0]?.cars || [];
    if (replaceModal.category === 'decor') return dbData.extra_services;
    return [];
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-serif tracking-wide mb-6 text-white">
          Собери свой идеальный той вместе с <span className="gold-text-color font-bold">BAYRAMLY</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Панель настроек */}
        <div className="card bg-base-100 p-6 shadow-xl border border-base-200 space-y-6">
          <h2 className="card-title text-xl font-bold text-white flex items-center gap-2">
            <IoGitCompareOutline className="text-primary" /> Параметры тоя
          </h2>
          <div className="form-control">
            <label className="label font-medium">Бюджет: <span className="gold-text-color font-bold">${budget}</span></label>
            <input type="range" min="5000" max="50000" step="1000" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="range range-primary range-sm" />
          </div>
          <div className="form-control">
            <label className="label font-medium">Количество гостей: <span className="text-secondary font-bold">{guests} чел.</span></label>
            <input type="range" min="50" max="700" step="20" value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="range range-secondary range-sm" />
          </div>
          <div className="form-control">
            <label className="label font-medium"><IoCalendarOutline /> Выберите дату:</label>
            <input type="date" className="input input-bordered input-primary w-full text-white mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          
          {/* Счётчик машин (от 1 до 20) */}
          <div className="form-control">
            <label className="label font-medium">Количество машин в кортеже (до 20):</label>
            <select className="select select-bordered select-primary w-full text-white" value={carCount} onChange={(e) => setCarCount(Number(e.target.value))}>
              {[...Array(20).keys()].map(x => (
                <option key={x + 1} value={x + 1}>{x + 1} авто</option>
              ))}
            </select>
          </div>

          <button onClick={generateWedding} disabled={loading || !date} className="btn btn-primary btn-block text-white font-bold shadow-lg">
            <IoSparkles className="text-amber-300 mr-2" /> Сгенерировать пакет
          </button>
        </div>

        {/* Результаты ИИ */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AILoader />
              </motion.div>
            )}

            {!loading && generatedPackage && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="alert bg-gradient-to-r from-slate-900 to-indigo-950 border border-primary/20 shadow-md text-white flex justify-between items-center">
                  <div>
                    <span className="text-sm font-semibold flex items-center gap-1"><IoSparkles className="text-amber-400" /> ИИ Смета построена успешно!</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-70">Итоговая стоимость:</div>
                    <div className="text-2xl font-black gold-text-color">${calculateTotal()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ресторан */}
                  <div className="card bg-base-100 border border-base-200 p-5 shadow-sm">
                    <span className="text-xs uppercase opacity-60">Зал торжеств</span>
                    <h3 className="text-lg font-bold text-white mt-1">{generatedPackage.restaurant?.name}</h3>
                    <div className="card-actions justify-between items-center mt-4 pt-2 border-t border-base-200">
                      <span className="text-md font-bold gold-text-color">~{Math.round((generatedPackage.restaurant?.price_per_day_uzs || 0) / 1000000)} млн сум</span>
                      <button onClick={() => setReplaceModal({ isOpen: true, category: 'restaurant' })} className="btn btn-xs btn-outline btn-primary"><IoReloadOutline /> Заменить</button>
                    </div>
                  </div>

                  {/* Артист */}
                  <div className="card bg-base-100 border border-base-200 p-5 shadow-sm">
                    <span className="text-xs uppercase opacity-60">Главный артист</span>
                    <h3 className="text-lg font-bold text-white mt-1">{generatedPackage.artist?.name}</h3>
                    <div className="card-actions justify-between items-center mt-4 pt-2 border-t border-base-200">
                      <span className="text-md font-bold gold-text-color">${generatedPackage.artist?.price_per_hour_usd} / ч</span>
                      <button onClick={() => setReplaceModal({ isOpen: true, category: 'artist' })} className="btn btn-xs btn-outline btn-primary"><IoReloadOutline /> Заменить</button>
                    </div>
                  </div>

                  {/* Кортеж с множителем */}
                  <div className="card bg-base-100 border border-base-200 p-5 shadow-sm">
                    <span className="text-xs uppercase opacity-60">Кортеж ({carCount} шт.)</span>
                    <h3 className="text-lg font-bold text-white mt-1">{generatedPackage.car?.model}</h3>
                    <div className="card-actions justify-between items-center mt-4 pt-2 border-t border-base-200">
                      <span className="text-md font-bold gold-text-color">${generatedPackage.car?.price_per_day_usd * carCount} (${generatedPackage.car?.price_per_day_usd} × {carCount})</span>
                      <button onClick={() => setReplaceModal({ isOpen: true, category: 'car' })} className="btn btn-xs btn-outline btn-primary"><IoReloadOutline /> Заменить</button>
                    </div>
                  </div>

                  {/* Декор */}
                  <div className="card bg-base-100 border border-base-200 p-5 shadow-sm">
                    <span className="text-xs uppercase opacity-60">Оформление и Опции</span>
                    <h3 className="text-lg font-bold text-white mt-1">{generatedPackage.decor?.service_name}</h3>
                    <div className="card-actions justify-between items-center mt-4 pt-2 border-t border-base-200">
                      <span className="text-md font-bold gold-text-color">~{Math.round((generatedPackage.decor?.price_uzs || 0) / 1000000)} млн сум</span>
                      <button onClick={() => setReplaceModal({ isOpen: true, category: 'decor' })} className="btn btn-xs btn-outline btn-primary"><IoReloadOutline /> Заменить</button>
                    </div>
                  </div>
                </div>

                {/* КНОПКА ПЕРЕХОДА К СЛЕДУЮЩЕЙ СТРАНИЦЕ БРОНИРОВАНИЯ */}
                <div className="flex justify-end pt-4">
                  <button onClick={handlePushToCheckout} className="btn btn-accent text-white font-bold px-8 rounded-xl shadow-lg flex items-center gap-2">
                    Далее к брони <IoArrowForwardOutline />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Модалка Замены с фото */}
      {replaceModal.isOpen && (
        <div className="modal modal-open backdrop-blur-md bg-black/70 z-50">
          <div className="modal-box bg-base-100 max-w-2xl w-full h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-base-200">
              <h3 className="font-serif text-xl font-bold text-white">Доступные альтернативы</h3>
              <button onClick={() => setReplaceModal({ isOpen: false, category: null })} className="btn btn-sm btn-circle btn-ghost">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {getModalItems().map((item, idx) => (
                <div key={item.id || idx} className="card bg-base-200 border border-base-300 shadow-sm overflow-hidden flex flex-row h-28 items-center">
                  <img src={item.image_url || "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=150"} alt="" className="w-24 h-full object-cover" />
                  <div className="p-3 flex-1 flex flex-col justify-between h-full">
                    <div>
                      <h4 className="font-bold text-white text-xs line-clamp-1">{item.name || item.model || item.service_name}</h4>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold gold-text-color">
                        {item.price_per_hour_usd ? `$${item.price_per_hour_usd}/ч` : item.price_per_day_usd ? `$${item.price_per_day_usd}/д` : `~${Math.round((item.price_per_day_uzs || item.price_uzs) / 1000000)} млн`}
                      </span>
                      <button onClick={() => {
                        setGeneratedPackage(prev => ({ ...prev, [replaceModal.category]: item }));
                        setReplaceModal({ isOpen: false, category: null });
                      }} className="btn btn-primary btn-xs text-white">Выбрать</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;