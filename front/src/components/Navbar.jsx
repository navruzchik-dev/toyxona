import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IoLayersOutline, IoCheckmarkCircleOutline, IoPersonOutline, IoLogOutOutline } from 'react-icons/io5';
import logoImg from '../assets/bayramly_logo.png';

const Navbar = ({ user, onLogin, onLogout }) => {
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', tgAccount: '', phone: '' });
  const [smsCode, setSmsCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const isActive = (path) => location.pathname === path;

  const handleSendSMS = (e) => {
    e.preventDefault();
    if (!formData.phone || !formData.firstName) return;
    
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(code);
    alert(`[BAYRAMLY SMS-Gateway] Код подтверждения: ${code}`);
    setStep(2);
  };

  const handleVerifySMS = (e) => {
    e.preventDefault();
    if (smsCode === generatedCode) {
      onLogin(`${formData.firstName} ${formData.lastName}`);
      setIsModalOpen(false);
      setStep(1);
      setSmsCode('');
    } else {
      alert("Неверный код!");
    }
  };

  return (
    <>
      <div className="navbar bg-base-100/90 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 border-b border-base-200">
        <div className="navbar-start">
          <Link to="/" className="flex items-center gap-3 font-black text-xl tracking-wider text-primary">
            <img src={logoImg} alt="BAYRAMLY" className="w-10 h-10 object-contain rounded-xl" onError={(e) => e.target.style.display = 'none'} />
            <span className="font-serif tracking-widest text-white">BAYRAMLY<span className="text-xs font-sans text-primary font-bold">.ai</span></span>
          </Link>
        </div>
        
        <div className="navbar-center hidden md:flex">
          <ul className="menu menu-horizontal px-1 gap-2 font-medium">
            <li>
              <Link to="/" className={`rounded-xl px-4 py-2 transition-all ${isActive('/') ? 'bg-primary text-white' : 'hover:bg-base-200 text-white'}`}>
                ИИ Конструктор
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className={`rounded-xl px-4 py-2 transition-all ${isActive('/dashboard') ? 'bg-primary text-white' : 'hover:bg-base-200 text-white'}`}>
                <IoLayersOutline /> Кабинет Исполнителя
              </Link>
            </li>
            <li>
              <Link to="/checkout" className={`rounded-xl px-4 py-2 transition-all ${isActive('/checkout') ? 'bg-primary text-white' : 'hover:bg-base-200 text-white'}`}>
                <IoCheckmarkCircleOutline /> Проверка Брони
              </Link>
            </li>
          </ul>
        </div>

        <div className="navbar-end gap-2">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-white text-sm font-medium">
                <IoPersonOutline className="text-primary" />
                <span>Привет, <span className="gold-text-color font-bold">{user}</span></span>
              </div>
              <button onClick={onLogout} className="btn btn-error btn-outline btn-sm rounded-xl gap-1" title="Выйти из аккаунта">
                <IoLogOutOutline /> Выйти
              </button>
            </div>
          ) : (
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-md text-white rounded-xl shadow-lg">
              Войти по SMS
            </button>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal modal-open backdrop-blur-md bg-black/60 z-50">
          <div className="modal-box bg-base-100 border border-base-200 max-w-md relative">
            <button onClick={() => setIsModalOpen(false)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            <div className="text-center mb-6">
              <h3 className="font-serif text-2xl font-bold text-white">Авторизация в BAYRAMLY</h3>
            </div>

            {step === 1 ? (
              <form onSubmit={handleSendSMS} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" required placeholder="Имя" className="input input-bordered w-full input-sm" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  <input type="text" required placeholder="Фамилия" className="input input-bordered w-full input-sm" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
                <input type="text" placeholder="Telegram Аккаунт" className="input input-bordered w-full input-sm" value={formData.tgAccount} onChange={e => setFormData({...formData, tgAccount: e.target.value})} />
                <input type="tel" required placeholder="+998 (XX) XXX-XX-XX" className="input input-bordered w-full input-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                <button type="submit" className="btn btn-primary btn-block text-white btn-sm">Получить СМС код</button>
              </form>
            ) : (
              <form onSubmit={handleVerifySMS} className="space-y-4">
                <input type="text" maxLength="4" required placeholder="0000" className="input input-bordered text-center tracking-widest text-lg font-bold w-full" value={smsCode} onChange={e => setSmsCode(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(1)} className="btn btn-ghost flex-1 btn-sm">Назад</button>
                  <button type="submit" className="btn btn-primary flex-1 text-white btn-sm">Подтвердить</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;