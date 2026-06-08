import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Импортируем хук авторизации
import { IoLayersOutline, IoCheckmarkDoneOutline, IoCloseCircleOutline, IoTrendingUpOutline } from 'react-icons/io5';

const Dashboard = () => {
  const { user } = useAuth(); // Получаем текущего залогиненного юзера (артиста)
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, activeCount: 0 });

  const fetchOrders = () => {
    if (!user || user.role !== 'artist') return;

    fetch('http://localhost:5000/wedding_orders')
      .then(res => res.json())
      .then(data => {
        // Фильтруем заказы, чтобы артист видел ТОЛЬКО СВОИ бронирования
        const myOrders = (data || []).filter(order => String(order.artist?.id) === String(user.id));
        
        setOrders(myOrders);
        
        // Считаем метрики строго по отфильтрованным заказам артиста
        const revenue = myOrders.reduce((acc, curr) => curr.status === 'approved' ? acc + curr.total_price_usd : acc, 0);
        const approvedCount = myOrders.filter(o => o.status === 'approved').length;
        
        setAnalytics({ totalRevenue: revenue, activeCount: approvedCount });
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchOrders();
  }, [user]); // Перезапускаем при изменении юзера

  const handleUpdateStatus = async (orderId, newStatus) => {
    // Находим изменяемый заказ среди отфильтрованных
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    const updatedOrder = { ...orderToUpdate, status: newStatus };

    try {
      await fetch(`http://localhost:5000/wedding_orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });
      fetchOrders(); // Синхронно обновляем списки и пересчитываем аналитику
    } catch (err) {
      console.error(err);
    }
  };

  if (!user || user.role !== 'artist') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-xl font-bold text-white">Доступ ограничен</h2>
        <p className="text-sm text-base-content/50 mt-1 max-w-xs">Пожалуйста, войдите в систему под аккаунтом Артиста, чтобы просматривать панель управления.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-2">
          <IoLayersOutline className="text-primary" /> Кабинет Исполнителя BAYRAMLY
        </h1>
        <p className="text-xs text-base-content/60 mt-1">
          Добро пожаловать, <span className="text-white font-semibold">{user.name}</span>! Панель управления вашими входящими бронированиями
        </p>
      </div>

      {/* Панель аналитики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-base-100 p-5 border border-base-200 flex flex-row items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold opacity-60 uppercase">Подтвержденный доход</span>
            <h3 className="text-2xl font-black text-[#C9A84C] mt-1">${analytics.totalRevenue}</h3>
          </div>
          <IoTrendingUpOutline className="text-3xl text-success" />
        </div>

        <div className="card bg-base-100 p-5 border border-base-200 flex flex-row items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold opacity-60 uppercase">Утверждено выступлений</span>
            <h3 className="text-2xl font-black text-white mt-1">{analytics.activeCount} тоев</h3>
          </div>
          <IoCheckmarkDoneOutline className="text-3xl text-primary" />
        </div>

        <div className="card bg-base-100 p-5 border border-base-200 flex flex-row items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold opacity-60 uppercase">Мои заявки в системе</span>
            <h3 className="text-2xl font-black text-white mt-1">{orders.length} шт.</h3>
          </div>
          <IoLayersOutline className="text-3xl text-secondary" />
        </div>
      </div>

      {/* Таблица заказов */}
      <div className="card bg-base-100 border border-base-200 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-base-200">
          <h3 className="font-bold text-lg text-white">Входящий поток Ваших ИИ-заказов</h3>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="table w-full text-left text-sm">
            <thead>
              <tr className="bg-base-200 text-white">
                <th>ID Заказа</th>
                <th>Дата / Детали тоя</th>
                <th>Клиент</th>
                <th>Ресторан</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th className="text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 opacity-50">Новых заявок на ваше имя пока не поступало</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-base-200/40 border-b border-base-200/60">
                    <td className="font-mono text-xs text-primary font-bold">{order.id}</td>
                    <td>
                      <div className="text-white font-semibold">{order.date}</div>
                      <div className="text-xs opacity-60">{order.guests || 0} гостей</div>
                    </td>
                    <td>
                      {order.client?.name ? (
                        <div>
                          <div className="text-white font-medium">{order.client.name}</div>
                          <div className="text-xs opacity-50">{order.client.phone}</div>
                        </div>
                      ) : (
                        <span className="opacity-40">—</span>
                      )}
                    </td>
                    <td className="text-white font-medium">
                      {order.restaurant?.name || <span className="opacity-40">Только артист</span>}
                    </td>
                    <td className="text-[#C9A84C] font-bold">${order.total_price_usd}</td>
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