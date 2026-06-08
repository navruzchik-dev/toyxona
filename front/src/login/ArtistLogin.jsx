import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ArtistLogin() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isLoginTab, setIsLoginTab] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Хонанда',
    genre: '',
    price: '',
    phone: '',    // используется как логин
    password: ''
  });

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLoginTab) {
      if (!formData.phone || !formData.password) return setError('Заполните все поля');
      setLoading(true);
      const res = await login(formData.phone, formData.password, 'artist');
      if (res.success) {
        navigate(`/artist/${res.id}`);
      } else {
        setError(res.error || 'Неверный телефон или пароль');
        setLoading(false);
      }
    } else {
      if (!formData.name || !formData.phone || !formData.password || !formData.price) {
        return setError('Заполните обязательные поля (Имя, Цена, Телефон, Пароль)');
      }
      setLoading(true);
      const newArtistObj = {
        name:               formData.name,
        category:           formData.category,
        genre:              formData.genre || 'Эстрада',
        price_per_hour_usd: Number(formData.price),
        admin_phone:        formData.phone,
        phone:              formData.phone,   // ← сохраняем и в phone тоже
        password:           formData.password,
        rating:             0,
        image_url:          '',
        booked_dates:       [],
      };
      const res = await register(newArtistObj, 'artist');
      if (res.success) {
        navigate(`/artist/${res.id}`);
      } else {
        setError(res.error);
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#100F14] flex flex-col items-center justify-center p-4 font-sans antialiased">

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[#C5A462] flex items-center justify-center text-white text-lg font-bold">B</div>
        <div>
          <div className="text-white font-black text-lg tracking-wider">BAYRAMLY<span className="text-[#C5A462]">.ai</span></div>
          <div className="text-white/30 text-[10px] uppercase tracking-wider">Панель Исполнителя</div>
        </div>
      </div>

      <div className="w-full max-w-[420px] bg-[#16151A] border border-white/5 rounded-[24px] p-6 shadow-2xl relative">
        <button onClick={() => navigate(-1)} className="absolute top-6 left-6 text-white/40 text-xs hover:text-white transition">← Назад</button>

        <div className="flex flex-col items-center mb-6">
          <div className="text-2xl mb-1">🎤</div>
          <h2 className="text-white font-medium text-sm">Личный кабинет Артиста</h2>

          <div className="flex gap-4 mt-3 text-[11px] font-bold uppercase tracking-wider">
            <button type="button"
              onClick={() => { setIsLoginTab(true); setError(''); }}
              className={`pb-1 border-b-2 ${isLoginTab ? 'text-[#C5A462] border-[#C5A462]' : 'text-white/20 border-transparent'}`}>
              Войти
            </button>
            <button type="button"
              onClick={() => { setIsLoginTab(false); setError(''); }}
              className={`pb-1 border-b-2 ${!isLoginTab ? 'text-[#C5A462] border-[#C5A462]' : 'text-white/20 border-transparent'}`}>
              Регистрация
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLoginTab && (
            <>
              <div className="space-y-1">
                <label className="text-white/40 text-[10px] font-bold uppercase pl-1">Псевдоним / Название</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange}
                  placeholder="Например: DJ Macarella"
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C5A462]/40 transition" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white/40 text-[10px] font-bold uppercase pl-1">Категория</label>
                  <select name="category" value={formData.category} onChange={handleChange}
                    className="w-full bg-[#16151A] border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C5A462]/40 transition">
                    <option value="Хонанда">Хонанда</option>
                    <option value="Примадонна">Примадонна</option>
                    <option value="Диджей">Диджей</option>
                    <option value="Бошловчи">Бошловчи</option>
                    <option value="Оркестр">Оркестр</option>
                    <option value="ВИА">ВИА</option>
                    <option value="Классика">Классика</option>
                    <option value="Легенда">Легенда</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-white/40 text-[10px] font-bold uppercase pl-1">Цена за час ($)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleChange}
                    placeholder="1500"
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C5A462]/40 transition" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/40 text-[10px] font-bold uppercase pl-1">Жанр / Стиль</label>
                <input type="text" name="genre" value={formData.genre} onChange={handleChange}
                  placeholder="Поп, Миллий, Клубный mix..."
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C5A462]/40 transition" />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-white/40 text-[10px] font-bold uppercase pl-1">
              {isLoginTab ? 'Номер телефона' : 'Номер телефона (для входа и связи)'}
            </label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange}
              placeholder="+998901234567"
              className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C5A462]/40 transition" />
          </div>

          <div className="space-y-1">
            <label className="text-white/40 text-[10px] font-bold uppercase pl-1">Пароль</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange}
              placeholder="••••••••"
              className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C5A462]/40 transition" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full mt-4 bg-gradient-to-r from-[#A38343] to-[#80632D] hover:from-[#B59554] hover:to-[#917237] text-white font-semibold text-sm py-3 rounded-xl shadow-xl transition disabled:opacity-50">
            {loading ? 'Загрузка...' : isLoginTab ? 'Войти в панель' : 'Создать карточку артиста'}
          </button>
        </form>
      </div>
    </div>
  );
}