import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ADMIN = { phone: 'admin', password: 'bayramly2024' };

const roles = [
  { key: 'client', emoji: '👰', label: 'Клиент', desc: 'Планирую свадьбу', grad: '#7C3AED, #4F46E5' },
  { key: 'artist', emoji: '🎤', label: 'Артист', desc: 'Выступаю на мероприятиях', grad: '#D97706, #B45309' },
  { key: 'hall',   emoji: '🏛️', label: 'Ресторан', desc: 'Предоставляю площадку', grad: '#059669, #047857' },
  { key: 'admin',  emoji: '⚙️', label: 'Администратор', desc: 'Управление платформой', grad: '#DC2626, #B91C1C' },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [role, setRole] = useState(null);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', password: '', groomName: '', brideName: '' });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin')  navigate('/admin');
      else if (user.role === 'client') navigate('/home');
      else if (user.role === 'artist') navigate(`/artistProfile/${user.id}`);
      else if (user.role === 'hall')   navigate(`/hallProfile/${user.id}`);
    }
  }, [user]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Admin
      if (role === 'admin') {
        if (form.phone === ADMIN.phone && form.password === ADMIN.password) {
          login({ id: 'admin', name: 'Администратор', role: 'admin' });
          navigate('/admin');
        } else setError('Неверный логин или пароль');
        return;
      }

      // Client register
      if (role === 'client' && mode === 'register') {
        if (!form.name || !form.phone || !form.password) { setError('Заполните все поля'); return; }
        if (!agreed) { setError('Примите условия использования'); return; }
        const existing = localStorage.getItem('client_' + form.phone);
        if (existing) { setError('Этот номер уже зарегистрирован'); return; }
        const data = { ...form, id: 'c_' + Date.now(), role: 'client' };
        localStorage.setItem('client_' + form.phone, JSON.stringify(data));
        login(data);
        navigate('/home');
        return;
      }

      // Client login
      if (role === 'client' && mode === 'login') {
        const raw = localStorage.getItem('client_' + form.phone);
        if (!raw) { setError('Пользователь не найден'); return; }
        const data = JSON.parse(raw);
        if (data.password !== form.password) { setError('Неверный пароль'); return; }
        login(data);
        navigate('/home');
        return;
      }

      // Artist / Hall login from db.json
      const endpoint = role === 'artist' ? 'artists' : 'restaurants';
      const res = await fetch(`http://localhost:5000/${endpoint}`);
      const list = await res.json();
      const found = list.find(x => x.admin_phone === form.phone && x.password === form.password);
      if (found) {
        login({ id: found.id, name: found.name, role });
        role === 'artist' ? navigate(`/artistProfile/${found.id}`) : navigate(`/hallProfile/${found.id}`);
      } else {
        setError('Неверный телефон или пароль');
      }
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => { setRole(null); setError(''); setForm({ name: '', phone: '', password: '', groomName: '', brideName: '' }); };

  const selectedRole = roles.find(r => r.key === role);

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* BG glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] bg-[#C9A84C]/6 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#7A5C1E] flex items-center justify-center shadow-2xl shadow-[#C9A84C]/25">
              <span className="text-white font-black text-xl">B</span>
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-widest leading-none">BAYRAMLY<span className="text-[#C9A84C]">.ai</span></h1>
              <p className="text-white/35 text-xs mt-0.5">Умный планировщик торжеств</p>
            </div>
          </div>
        </div>

        {/* Role selector */}
        {!role && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-white text-xl font-bold">Добро пожаловать</h2>
              <p className="text-white/35 text-sm mt-1">Выберите вашу роль</p>
            </div>
            <div className="space-y-3">
              {roles.map(({ key, emoji, label, desc, grad }, i) => (
                <button key={key} onClick={() => setRole(key)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/4 border border-white/8 hover:border-white/18 hover:bg-white/7 transition-all duration-200 group text-left">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg transition-transform group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${grad})` }}>
                    {emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm">{label}</div>
                    <div className="text-white/35 text-xs mt-0.5">{desc}</div>
                  </div>
                  <span className="ml-auto text-white/20 group-hover:text-white/55 text-lg transition-colors">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Auth form */}
        {role && (
          <div className="bg-white/4 backdrop-blur border border-white/10 rounded-3xl p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={goBack}
                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/55 hover:text-white transition text-sm">
                ←
              </button>
              <div>
                <h2 className="text-white font-bold">{selectedRole?.emoji} {selectedRole?.label}</h2>
                {role !== 'admin' && (
                  <div className="flex gap-3 mt-1">
                    {['login', 'register'].map(m => (
                      <button key={m} onClick={() => { setMode(m); setError(''); }}
                        className={`text-xs font-medium transition-colors pb-0.5 border-b ${
                          mode === m ? 'text-[#C9A84C] border-[#C9A84C]' : 'text-white/35 border-transparent hover:text-white/60'
                        }`}>
                        {m === 'login' ? 'Войти' : 'Регистрация'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Artist / Hall register → redirect */}
            {(role === 'artist' || role === 'hall') && mode === 'register' ? (
              <div className="text-center py-6 space-y-4">
                <div className="text-5xl">{selectedRole?.emoji}</div>
                <p className="text-white/55 text-sm">Для регистрации заполните полную анкету</p>
                <button onClick={() => navigate(role === 'artist' ? '/artistLogin' : '/hallLogin')}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-85 active:scale-[0.97]"
                  style={{ background: `linear-gradient(135deg, ${selectedRole?.grad})` }}>
                  Перейти к регистрации →
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {/* Client register extra */}
                {role === 'client' && mode === 'register' && (
                  <>
                    <Input label="Ваше имя" value={form.name} onChange={v => set('name', v)} placeholder="Имя" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Жених" value={form.groomName} onChange={v => set('groomName', v)} placeholder="Имя жениха" />
                      <Input label="Невеста" value={form.brideName} onChange={v => set('brideName', v)} placeholder="Имя невесты" />
                    </div>
                  </>
                )}

                <Input
                  label={role === 'admin' ? 'Логин' : 'Телефон'}
                  value={form.phone}
                  onChange={v => set('phone', v)}
                  placeholder={role === 'admin' ? 'admin' : '+998 90 000 00 00'}
                />
                <Input
                  label="Пароль"
                  type="password"
                  value={form.password}
                  onChange={v => set('password', v)}
                  placeholder="••••••••"
                />

                {/* Terms for client register */}
                {role === 'client' && mode === 'register' && (
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <button type="button" onClick={() => setAgreed(!agreed)}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        agreed ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-white/25 group-hover:border-white/45'
                      }`}>
                      {agreed && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <span className="text-white/45 text-sm leading-relaxed">
                      Я принимаю{' '}
                      <a href="/terms" target="_blank" className="text-[#C9A84C] hover:underline">условия использования</a>
                    </span>
                  </label>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-45 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)', boxShadow: '0 8px 25px rgba(201,168,76,0.2)' }}>
                  {loading
                    ? <span className="inline-flex items-center gap-2 justify-center">
                        <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                        Загрузка...
                      </span>
                    : mode === 'login' ? 'Войти' : 'Зарегистрироваться'
                  }
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const Input = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="block text-white/45 text-xs font-medium mb-1.5 uppercase tracking-wider">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#C9A84C]/50 focus:bg-white/7 transition-all"
    />
  </div>
);