import React, { useEffect, useState } from 'react';
import { IoLayersOutline, IoCheckmarkDoneOutline, IoCloseCircleOutline, IoTrendingUpOutline } from 'react-icons/io5';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, activeCount: 0 });

  const fetchOrders = () => {
    fetch('http://localhost:5000/wedding_orders')
      .then(res => res.json())
      .then(data => {
        setOrders(data || []);
        
        // Считаем выручку только подтвержденных заказов
        const revenue = data.reduce((acc, curr) => curr.status === 'approved' ? acc + curr.total_price_usd : acc, 0);
        const approvedCount = data.filter(o => o.status === 'approved').length;
        
        setAnalytics({ totalRevenue: revenue, activeCount: approvedCount });
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    const updatedOrder = { ...orderToUpdate, status: newStatus };

    try {
      await fetch(`http://localhost:5000/wedding_orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });
      fetchOrders(); // Обновляем списки и аналитику
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-2">
          <IoLayersOutline className="text-primary" /> Кабинет Исполнителя BAYRAMLY
        </h1>
        <p className="text-xs text-base-content/60 mt-1">Панель управления входящими бронированиями и контрактами</p>
      </div>

      {/* Панель аналитики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-base-100 p-5 border border-base-200 flex flex-row items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold opacity-60 uppercase">Подтвержденный доход</span>
            <h3 className="text-2xl font-black gold-text-color mt-1">${analytics.totalRevenue}</h3>
          </div>
          <IoTrendingUpOutline className="text-3xl text-success" />
        </div>

        <div className="card bg-base-100 p-5 border border-base-200 flex flex-row items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold opacity-60 uppercase">Утверждено тоев</span>
            <h3 className="text-2xl font-black text-white mt-1">{analytics.activeCount} заказов</h3>
          </div>
          <IoCheckmarkDoneOutline className="text-3xl text-primary" />
        </div>

        <div className="card bg-base-100 p-5 border border-base-200 flex flex-row items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold opacity-60 uppercase">Всего заявок в системе</span>
            <h3 className="text-2xl font-black text-white mt-1">{orders.length} шт.</h3>
          </div>
          <IoLayersOutline className="text-3xl text-secondary" />
        </div>
      </div>

      {/* Таблица заказов */}
      <div className="card bg-base-100 border border-base-200 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-base-200">
          <h3 className="font-bold text-lg text-white">Входящий поток ИИ-заказов</h3>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="table w-full text-left text-sm">
            <thead>
              <tr className="bg-base-200 text-white">
                <th>ID Заказа</th>
                <th>Дата / Гости</th>
                <th>Ресторан</th>
                <th>Артист</th>
                <th>Кортеж</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th className="text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 opacity-50">Заказов пока нет</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-base-200/40 border-b border-base-200/60">
                    <td className="font-mono text-xs text-primary font-bold">{order.id}</td>
                    <td>
                      <div className="text-white font-semibold">{order.date}</div>
                      <div className="text-xs opacity-60">{order.guests} гостей</div>
                    </td>
                    <td className="text-white font-medium">{order.restaurant?.name}</td>
                    <td>{order.artist?.name}</td>
                    <td>{order.car?.model} <span className="badge badge-sm badge-ghost">×{order.car_count}</span></td>
                    <td className="gold-text-color font-bold">${order.total_price_usd}</td>
                    <td>
                      <span className={`badge badge-sm ${order.status === 'pending' ? 'badge-warning' : order.status === 'approved' ? 'badge-success' : 'badge-error'} text-xs font-medium`}>
                        {order.status === 'pending' ? 'Новый' : order.status === 'approved' ? 'Принят' : 'Отклонен'}
                      </span>
                    </td>
                    <td className="flex gap-2 justify-center items-center h-full pt-4">
                      {order.status === 'pending' && (
                        <>
                          <button onClick={() => handleUpdateStatus(order.id, 'approved')} className="btn btn-success btn-xs text-white px-3 gap-1">
                            <IoCheckmarkDoneOutline /> Принять
                          </button>
                          <button onClick={() => handleUpdateStatus(order.id, 'rejected')} className="btn btn-error btn-xs btn-outline px-3 gap-1">
                            <IoCloseCircleOutline /> Отклонить
                          </button>
                        </>
                      )}
                      {order.status !== 'pending' && (
                        <span className="text-xs opacity-40">Обработано</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;