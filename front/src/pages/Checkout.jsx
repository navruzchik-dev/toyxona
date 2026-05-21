import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IoCheckmarkCircle, IoTimeOutline, IoReceiptOutline } from 'react-icons/io5';

const Checkout = () => {
  const [latestOrder, setLatestOrder] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/wedding_orders')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          // Берем самый последний созданный заказ
          setLatestOrder(data[data.length - 1]);
        }
      })
      .catch(err => console.error(err));
  }, []);

  if (!latestOrder) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-xl text-white font-serif mb-2">Активных бронирований не найдено</h2>
        <p className="text-xs text-base-content/50 max-w-sm">Перейдите в ИИ Конструктор на Главной, чтобы составить и зафиксировать смету торжества.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] max-w-4xl mx-auto px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="card bg-base-100 border border-base-200 shadow-2xl p-6 md:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-success/10 border border-success/30 rounded-full flex items-center justify-center mx-auto text-success text-3xl">
            <IoCheckmarkCircle />
          </div>
          <h1 className="text-3xl font-serif text-white font-bold">Проверка бронирования заказа</h1>
          <p className="text-xs text-base-content/60">Данные успешно подтянуты из единого реестра BAYRAMLY DB</p>
        </div>

        <div className="border border-base-200 rounded-2xl p-4 bg-base-200/50 space-y-4">
          <div className="flex justify-between items-center border-b border-base-200 pb-3">
            <span className="font-semibold text-sm flex items-center gap-2 text-white">
              <IoReceiptOutline className="text-primary" /> Договор: {latestOrder.id}
            </span>
            <span className={`badge ${latestOrder.status === 'pending' ? 'badge-warning' : 'badge-success'} p-2 text-xs font-medium`}>
              {latestOrder.status === 'pending' ? 'Ожидает подтверждения' : 'Утвержден'}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="opacity-70">Дата торжества:</span>
              <span className="text-white font-semibold">{latestOrder.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Количество приглашенных:</span>
              <span className="text-white font-semibold">{latestOrder.guests} гостей</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Зал торжеств ({latestOrder.restaurant?.name}):</span>
              <span className="gold-text-color font-bold">~{Math.round((latestOrder.restaurant?.price_per_day_uzs || 0)/1000000)} млн сум</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Ведущий / Артист ({latestOrder.artist?.name}):</span>
              <span className="gold-text-color font-bold">${latestOrder.artist?.price_per_hour_usd}/ч</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Премиум Кортеж ({latestOrder.car?.model} × {latestOrder.car_count} шт.):</span>
              <span className="gold-text-color font-bold">${latestOrder.car?.price_per_day_usd * latestOrder.car_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Оформление ({latestOrder.decor?.service_name}):</span>
              <span className="gold-text-color font-bold">~{Math.round((latestOrder.decor?.price_uzs || 0)/1000000)} млн сум</span>
            </div>
          </div>

          <div className="border-t border-base-200 pt-3 flex justify-between items-center">
            <span className="font-bold text-white">Итоговая расчетная сумма (ИИ):</span>
            <span className="text-xl font-black gold-text-color">${latestOrder.total_price_usd}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button className="btn btn-outline border-base-300 text-white btn-md rounded-xl">Скачать смету PDF</button>
          <button onClick={() => alert("Перенаправление на платежный шлюз Uzum Pay...")} className="btn btn-primary text-white btn-md rounded-xl shadow-lg">Оплатить заказ</button>
        </div>
      </motion.div>
    </div>
  );
};

export default Checkout;