import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['Хонанда', 'Примадонна', 'Диджей', 'Бошловчи', 'Оркестр', 'ВИА', 'Классика', 'Легенда'];

const PHONE_PREFIX = '998';
const MIN_PASSWORD_LEN = 8;
const onlyPhoneDigits = (raw) => {
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith(PHONE_PREFIX)) digits = digits.slice(PHONE_PREFIX.length);
  return digits.slice(0, 9);
};
const formatPhoneDisplay = (rawDigits) => {
  const digits = onlyPhoneDigits(rawDigits);
  const p1 = digits.slice(0, 2), p2 = digits.slice(2, 5), p3 = digits.slice(5, 9);
  let out = `+${PHONE_PREFIX}`;
  if (p1) out += ` ${p1}`;
  if (p2) out += ` ${p2}`;
  if (p3) out += ` ${p3}`;
  return out;
};
const toCleanPhone = (rawDigits) => `+${PHONE_PREFIX}${onlyPhoneDigits(rawDigits)}`;
const isPhoneComplete = (rawDigits) => onlyPhoneDigits(rawDigits).length === 9;

export default function ArtistLogin() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isLoginTab, setIsLoginTab] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Хонанда',
    genre: '',
    price: '',
    phone: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = toCleanPhone(formData.phone);

    if (isLoginTab) {
      if (!formData.phone || !formData.password) return setError('Заполните все поля');
      setLoading(true);
      const res = await login(cleanPhone, formData.password, 'artist');
      if (res.success) {
        navigate(`/artist/${res.id}`);
      } else {
        setError(res.error || 'Неверный телефон или пароль');
        setLoading(false);
      }
    } else {
      if (!formData.name || !isPhoneComplete(formData.phone) || !formData.password || !formData.price) {
        return setError('Заполните обязательные поля (номер телефона должен быть полным)');
      }
      if (formData.password.length < MIN_PASSWORD_LEN) {
        return setError(`Пароль должен содержать минимум ${MIN_PASSWORD_LEN} символов`);
      }
      if (!agreed) return setError('Примите условия использования');

      setLoading(true);
      const newArtistObj = {
        name: formData.name,
        category: formData.category,
        genre: formData.genre || 'Эстрада',
        price_per_hour_usd: Number(formData.price),
        admin_phone: cleanPhone,
        phone: cleanPhone,
        password: formData.password,
        rating: 0,
        image_url: '',
        booked_dates: [],
        pending: true,
      };
      const res = await register(newArtistObj, 'artist');
      if (res.success) {
        setShowPendingModal(true);
        setLoading(false);
      } else {
        setError(res.error);
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.92) translateY(6px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .anim-card { animation: fadeSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-fade { animation: fadeIn 0.35s ease both; }
        .anim-pop { animation: popIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] bg-[#C9A84C]/6 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 anim-fade">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#7A5C1E] flex items-center justify-center shadow-2xl shadow-[#C9A84C]/25">
              <span className="text-white font-black text-xl">B</span>
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-widest leading-none">
                BAYRAMLY<span className="text-[#C9A84C]">.ai</span>
              </h1>
              <p className="text-white/35 text-xs mt-0.5">Панель артиста</p>
            </div>
          </div>
        </div>

        <div className="bg-white/4 backdrop-blur border border-white/10 rounded-3xl p-6 sm:p-8 anim-card">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/55 hover:text-white transition text-sm">
              ←
            </button>
            <div>
              <h2 className="text-white font-bold">🎤 Артист</h2>
              <div className="flex gap-3 mt-1">
                {[
                  { key: true, label: 'Войти' },
                  { key: false, label: 'Регистрация' },
                ].map(({ key, label }) => (
                  <button key={label} onClick={() => { setIsLoginTab(key); setError(''); }}
                    className={`text-xs font-medium transition-colors pb-0.5 border-b ${isLoginTab === key
                      ? 'text-[#C9A84C] border-[#C9A84C]'
                      : 'text-white/35 border-transparent hover:text-white/60'
                      }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 anim-fade">
            {!isLoginTab && (
              <>
                <Input label="Псевдоним / название" value={formData.name} onChange={v => set('name', v)} placeholder="Например: DJ Macarella" />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Категория" value={formData.category} onChange={v => set('category', v)} options={CATEGORIES} />
                  <Input label="Цена за час ($)" type="number" value={formData.price} onChange={v => set('price', v)} placeholder="1500" />
                </div>
                <Input label="Жанр / стиль" value={formData.genre} onChange={v => set('genre', v)} placeholder="Поп, Миллий, Клубный mix..." />
              </>
            )}

            <PhoneInput label="Номер телефона" value={formData.phone} onChange={v => set('phone', v)} />
            <div>
              <Input label="Пароль" type="password" value={formData.password} onChange={v => set('password', v)} placeholder="••••••••" />
              {!isLoginTab && (
                <p className={`text-xs mt-1.5 ${formData.password && formData.password.length < MIN_PASSWORD_LEN ? 'text-red-400' : 'text-white/30'}`}>
                  Минимум {MIN_PASSWORD_LEN} символов
                </p>
              )}
            </div>

            {!isLoginTab && (
              <Checkbox checked={agreed} onChange={setAgreed}>
                Я принимаю{' '}
                <a href="/terms" target="_blank" className="text-[#C9A84C] hover:underline">условия использования</a>
              </Checkbox>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center anim-pop">
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
                : isLoginTab ? 'Войти в панель' : 'Отправить заявку'
              }
            </button>
          </form>
        </div>
      </div>

      {showPendingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-fade">
          <div className="bg-[#0d0d16] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl anim-pop">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-white font-bold text-lg mb-2">Заявка отправлена!</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              Ваша карточка артиста находится на проверке у администратора. После одобрения вы получите доступ к личному кабинету.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6">
              <p className="text-amber-400 text-xs font-medium">Обычно проверка занимает до 24 часов</p>
            </div>
            <button onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)' }}>
              На главную
            </button>
          </div>
        </div>
      )}
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

const PhoneInput = ({ label, value, onChange }) => (
  <div>
    <label className="block text-white/45 text-xs font-medium mb-1.5 uppercase tracking-wider">{label}</label>
    <input
      type="text"
      inputMode="numeric"
      autoComplete="tel"
      value={formatPhoneDisplay(value)}
      onChange={e => onChange(onlyPhoneDigits(e.target.value))}
      placeholder="+998 90 123 45 67"
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#C9A84C]/50 focus:bg-white/7 transition-all tabular-nums"
    />
  </div>
);

const Select = ({ label, value, onChange, options, placeholder = 'Выберите' }) => (
  <div>
    <label className="block text-white/45 text-xs font-medium mb-1.5 uppercase tracking-wider">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C]/50 focus:bg-white/7 transition-all"
    >
      <option value="" className="bg-[#0d0d16] text-white">{placeholder}</option>
      {options.map(o => (
        <option key={o} value={o} className="bg-[#0d0d16] text-white">{o}</option>
      ))}
    </select>
  </div>
);

const Checkbox = ({ checked, onChange, children }) => (
  <label className="flex items-start gap-3 cursor-pointer group">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
        checked ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-white/25 group-hover:border-white/45'
      }`}
    >
      {checked && <span className="text-white text-xs font-bold">✓</span>}
    </button>
    <span className="text-white/45 text-sm leading-relaxed">{children}</span>
  </label>
);