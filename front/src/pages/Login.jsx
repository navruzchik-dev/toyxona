import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import { setHall } from '../redux/slices/hallSlice.js';

const API = 'http://localhost:5000';

const roles = [
  { key: 'client', emoji: '👰', label: 'Клиент', desc: 'Планирую свадьбу', grad: '#7C3AED, #4F46E5' },
  { key: 'artist', emoji: '🎤', label: 'Артист', desc: 'Выступаю на мероприятиях', grad: '#D97706, #B45309' },
  { key: 'hall', emoji: '🏛️', label: 'Ресторан', desc: 'Предоставляю площадку', grad: '#059669, #047857' },
  { key: 'admin', emoji: '⚙️', label: 'Администратор', desc: 'Управление платформой', grad: '#DC2626, #B91C1C' },
];

const CATEGORIES = ['Хонанда', 'Примадонна', 'Диджей', 'Бошловчи', 'Оркестр', 'ВИА', 'Классика', 'Легенда'];
const DISTRICTS = ['Мирабад', 'Юнусабад', 'Чиланзар', 'Яккасарай', 'Бектемир', 'Сергели', 'Учтепа', 'Олмазор', 'Шайхонтохур', 'Яшнабод'];
const KITCHEN_TYPES = ['Узбекская', 'Европейская', 'Смешанная', 'Азиатская', 'Миллий', 'Восточная'];

const emptyForm = {
  name: '', phone: '', password: '', groomName: '', brideName: '',
  category: 'Хонанда', genre: '', price: '',
  district: '', address: '', maxCapacity: '', seatingCapacity: '',
  pricePerDay: '', waitersCount: '', hasLed: false, stageSize: '',
  parkingSpaces: '', kitchenType: '', imageUrl: '',
};

const PHONE_PREFIX = '998';
const MIN_PASSWORD_LEN = 8;

// Хранит телефон как "+998XXXXXXXXX" (только цифры после префикса, максимум 9 цифр)
const onlyPhoneDigits = (raw) => {
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith(PHONE_PREFIX)) digits = digits.slice(PHONE_PREFIX.length);
  return digits.slice(0, 9);
};
const formatPhoneDisplay = (rawDigits) => {
  const digits = onlyPhoneDigits(rawDigits);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 9);
  let out = `+${PHONE_PREFIX}`;
  if (p1) out += ` ${p1}`;
  if (p2) out += ` ${p2}`;
  if (p3) out += ` ${p3}`;
  return out;
};
// То, что реально уходит на бэкенд/в БД: чистый "+998901234567"
const toCleanPhone = (rawDigits) => `+${PHONE_PREFIX}${onlyPhoneDigits(rawDigits)}`;
const isPhoneComplete = (rawDigits) => onlyPhoneDigits(rawDigits).length === 9;

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { login, register, user } = useAuth();

  const [role, setRole] = useState('client');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const [showBusinessPanel, setShowBusinessPanel] = useState(false);
  const panelRef = useRef(null);
  const [panelHeight, setPanelHeight] = useState(0);

  const businessRoles = roles.filter(r => r.key === 'artist' || r.key === 'hall');

  useEffect(() => {
    if (showBusinessPanel && panelRef.current) {
      setPanelHeight(panelRef.current.scrollHeight);
    } else {
      setPanelHeight(0);
    }
  }, [showBusinessPanel]);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'client') navigate('/home');
      else if (user.role === 'artist') navigate(`/artistProfile/${user.id}`);
      else if (user.role === 'hall') navigate(`/hallProfile/${user.id}`);
    }
  }, [user]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const resetForm = () => {
    setError('');
    setForm(emptyForm);
    setAgreed(false);
  };

  const goBackToClient = () => {
    setRole('client');
    setMode('login');
    setShowBusinessPanel(false);
    setShowPendingModal(false);
    resetForm();
  };

  const chooseBusinessRole = (key) => {
    setRole(key);
    setMode('login');
    setShowBusinessPanel(false);
    resetForm();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ───────── АДМИН ─────────
      if (role === 'admin') {
        const result = await login(form.phone, form.password, 'admin');
        if (result.success) navigate('/admin');
        else setError(result.error);
        return;
      }

      // ───────── КЛИЕНТ ─────────
      if (role === 'client') {
        const cleanPhone = toCleanPhone(form.phone);
        if (mode === 'register') {
          if (!form.name || !isPhoneComplete(form.phone) || !form.password) {
            setError('Заполните все поля (номер телефона должен быть полным)');
            return;
          }
          if (form.password.length < MIN_PASSWORD_LEN) {
            setError(`Пароль должен содержать минимум ${MIN_PASSWORD_LEN} символов`);
            return;
          }
          if (!agreed) {
            setError('Примите условия использования');
            return;
          }

          const checkRes = await fetch(`${API}/users?phone=${encodeURIComponent(cleanPhone)}`);
          const existing = await checkRes.json();
          if (existing.length > 0) {
            setError('Этот номер уже зарегистрирован');
            return;
          }

          const newUser = {
            name: form.name,
            phone: cleanPhone,
            password: form.password,
            groomName: form.groomName,
            brideName: form.brideName,
            id: 'c_' + Date.now(),
            role: 'client',
          };

          const saveRes = await fetch(`${API}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser),
          });

          if (!saveRes.ok) throw new Error('Ошибка сохранения');
          navigate('/home');
        } else {
          const result = await login(cleanPhone, form.password, 'client');
          if (result.success) navigate('/home');
          else setError(result.error);
        }
        return;
      }

      // ───────── АРТИСТ ─────────
      if (role === 'artist') {
        const cleanPhone = toCleanPhone(form.phone);
        if (mode === 'register') {
          if (!form.name || !isPhoneComplete(form.phone) || !form.password || !form.price) {
            setError('Заполните обязательные поля (Имя, Цена, Телефон, Пароль)');
            return;
          }
          if (form.password.length < MIN_PASSWORD_LEN) {
            setError(`Пароль должен содержать минимум ${MIN_PASSWORD_LEN} символов`);
            return;
          }
          if (!agreed) {
            setError('Примите условия использования');
            return;
          }

          const newArtistObj = {
            name: form.name,
            category: form.category,
            genre: form.genre || 'Эстрада',
            price_per_hour_usd: Number(form.price),
            admin_phone: cleanPhone,
            phone: cleanPhone,
            password: form.password,
            rating: 0,
            image_url: '',
            booked_dates: [],
            pending: true,
          };

          const res = await register(newArtistObj, 'artist');
          if (res.success) setShowPendingModal(true);
          else setError(res.error);
        } else {
          const result = await login(cleanPhone, form.password, 'artist');
          if (result.success) navigate(`/artistProfile/${result.id}`);
          else setError(result.error);
        }
        return;
      }

      // ───────── РЕСТОРАН / ЗАЛ ─────────
      if (role === 'hall') {
        const cleanPhone = toCleanPhone(form.phone);
        if (mode === 'register') {
          const required = [
            form.name, form.district, form.address, form.maxCapacity,
            form.seatingCapacity, form.pricePerDay, form.waitersCount,
            form.stageSize, form.parkingSpaces, form.kitchenType, form.password,
          ];
          if (required.some(v => v === '' || v === undefined) || !isPhoneComplete(form.phone)) {
            setError('Заполните все поля (номер телефона должен быть полным)');
            return;
          }
          if (form.password.length < MIN_PASSWORD_LEN) {
            setError(`Пароль должен содержать минимум ${MIN_PASSWORD_LEN} символов`);
            return;
          }
          if (!agreed) {
            setError('Примите условия использования');
            return;
          }

          const res = await fetch(`${API}/restaurants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              district: form.district,
              address: form.address,
              max_capacity_people: Number(form.maxCapacity),
              seating_capacity: Number(form.seatingCapacity),
              price_per_day_uzs: Number(form.pricePerDay),
              waiters_count: Number(form.waitersCount),
              has_led_screen: form.hasLed,
              stage_size: form.stageSize,
              parking_spaces: Number(form.parkingSpaces),
              kitchen_type: form.kitchenType,
              image_url: form.imageUrl || '',
              phone: cleanPhone,
              password: form.password,
              booked_dates: [],
              pending: true,
            }),
          });

          if (!res.ok) throw new Error('Ошибка регистрации');
          setShowPendingModal(true);
        } else {
          const res = await fetch(`${API}/restaurants`);
          const list = await res.json();
          const hall = list.find(
            h => (h.phone === cleanPhone || h.admin_phone === cleanPhone) && h.password === form.password
          );

          if (!hall) {
            setError('Неверный номер телефона или пароль');
            return;
          }
          if (hall.pending) {
            setError('Ваша заявка ещё на рассмотрении у администратора');
            return;
          }

          dispatch(setHall(hall));
          localStorage.setItem('bayramly_session', JSON.stringify({ ...hall, role: 'hall' }));
          navigate(`/hallProfile/${hall.id}`);
        }
        return;
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = roles.find(r => r.key === role);
  const isClient = role === 'client';
  const isRegisterExtended = mode === 'register' && (role === 'artist' || role === 'hall');

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.92) translateY(6px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .anim-card { animation: fadeSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-fade { animation: fadeIn 0.35s ease both; }
        .anim-pop { animation: popIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .chevron-rotate { transition: transform 0.3s ease; }
        .chevron-rotate.open { transform: rotate(180deg); }
        .scroll-fields::-webkit-scrollbar { width: 5px; }
        .scroll-fields::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
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
              <p className="text-white/35 text-xs mt-0.5">Умный планировщик торжеств</p>
            </div>
          </div>
        </div>

        {/* Auth form */}
        <div key={role} className="bg-white/4 backdrop-blur border border-white/10 rounded-3xl p-6 sm:p-8 anim-card">
          <div className="flex items-center gap-3 mb-6">
            {!isClient && (
              <button onClick={goBackToClient}
                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/55 hover:text-white transition text-sm">
                ←
              </button>
            )}
            <div>
              <h2 className="text-white font-bold">{selectedRole?.emoji} {selectedRole?.label}</h2>
              {role !== 'admin' && (
                <div className="flex gap-3 mt-1">
                  {['login', 'register'].map(m => (
                    <button key={m} onClick={() => { setMode(m); setError(''); }}
                      className={`text-xs font-medium transition-colors pb-0.5 border-b ${mode === m
                        ? 'text-[#C9A84C] border-[#C9A84C]'
                        : 'text-white/35 border-transparent hover:text-white/60'
                        }`}>
                      {m === 'login' ? 'Войти' : 'Регистрация'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4 anim-fade">
            <div
              className={isRegisterExtended ? 'scroll-fields space-y-4 max-h-[360px] overflow-y-auto pr-1 -mr-1' : 'space-y-4'}
            >
              {/* ── Клиент: регистрация ── */}
              {role === 'client' && mode === 'register' && (
                <>
                  <Input label="Ваше имя" value={form.name} onChange={v => set('name', v)} placeholder="Имя" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Жених" value={form.groomName} onChange={v => set('groomName', v)} placeholder="Имя жениха" />
                    <Input label="Невеста" value={form.brideName} onChange={v => set('brideName', v)} placeholder="Имя невесты" />
                  </div>
                </>
              )}

              {/* ── Артист: регистрация ── */}
              {role === 'artist' && mode === 'register' && (
                <>
                  <Input label="Псевдоним / название" value={form.name} onChange={v => set('name', v)} placeholder="Например: DJ Macarella" />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Категория" value={form.category} onChange={v => set('category', v)} options={CATEGORIES} />
                    <Input label="Цена за час ($)" type="number" value={form.price} onChange={v => set('price', v)} placeholder="1500" />
                  </div>
                  <Input label="Жанр / стиль" value={form.genre} onChange={v => set('genre', v)} placeholder="Поп, Миллий, Клубный mix..." />
                </>
              )}

              {/* ── Ресторан: регистрация ── */}
              {role === 'hall' && mode === 'register' && (
                <>
                  <Input label="Название ресторана" value={form.name} onChange={v => set('name', v)} placeholder="Zarafshon Hall" />
                  <Select label="Район" value={form.district} onChange={v => set('district', v)} options={DISTRICTS} />
                  <Input label="Адрес" value={form.address} onChange={v => set('address', v)} placeholder="ул. Матбуотчилар, 17" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Макс. вместимость" type="number" value={form.maxCapacity} onChange={v => set('maxCapacity', v)} placeholder="400" />
                    <Input label="Мест за столами" type="number" value={form.seatingCapacity} onChange={v => set('seatingCapacity', v)} placeholder="380" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Цена за день (сум)" type="number" value={form.pricePerDay} onChange={v => set('pricePerDay', v)} placeholder="70000000" />
                    <Input label="Кол-во официантов" type="number" value={form.waitersCount} onChange={v => set('waitersCount', v)} placeholder="35" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Размер сцены" value={form.stageSize} onChange={v => set('stageSize', v)} placeholder="10x5м" />
                    <Input label="Мест на парковке" type="number" value={form.parkingSpaces} onChange={v => set('parkingSpaces', v)} placeholder="90" />
                  </div>
                  <Select label="Тип кухни" value={form.kitchenType} onChange={v => set('kitchenType', v)} options={KITCHEN_TYPES} />
                  <Input label="Ссылка на фото" value={form.imageUrl} onChange={v => set('imageUrl', v)} placeholder="https://..." />
                  <Checkbox checked={form.hasLed} onChange={v => set('hasLed', v)}>
                    Есть LED экран
                  </Checkbox>
                </>
              )}

              {role === 'admin' ? (
                <Input
                  label="Логин"
                  value={form.phone}
                  onChange={v => set('phone', v)}
                  placeholder="admin"
                />
              ) : (
                <PhoneInput
                  label="Телефон"
                  value={form.phone}
                  onChange={v => set('phone', v)}
                />
              )}
              <div>
                <Input
                  label="Пароль"
                  type="password"
                  value={form.password}
                  onChange={v => set('password', v)}
                  placeholder="••••••••"
                />
                {mode === 'register' && role !== 'admin' && (
                  <p className={`text-xs mt-1.5 ${form.password && form.password.length < MIN_PASSWORD_LEN ? 'text-red-400' : 'text-white/30'}`}>
                    Минимум {MIN_PASSWORD_LEN} символов
                  </p>
                )}
              </div>

              {mode === 'register' && role !== 'admin' && (
                <Checkbox checked={agreed} onChange={setAgreed}>
                  Я принимаю{' '}
                  <a href="/terms" target="_blank" className="text-[#C9A84C] hover:underline">условия использования</a>
                </Checkbox>
              )}
            </div>

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
                : mode === 'login' ? 'Войти' : (role === 'artist' || role === 'hall') ? 'Отправить заявку' : 'Зарегистрироваться'
              }
            </button>
          </form>
        </div>

        {/* Ссылка "Я исполнитель / ресторан" */}
        {isClient && (
          <div className="mt-5 anim-fade" style={{ animationDelay: '0.15s' }}>
            <button
              type="button"
              onClick={() => setShowBusinessPanel(v => !v)}
              className="w-full flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-sm font-medium transition-colors py-2"
            >
              Вы артист или ресторан?
              <span className={`chevron-rotate ${showBusinessPanel ? 'open' : ''} text-xs`}>▾</span>
            </button>

            <div
              style={{
                maxHeight: panelHeight,
                transition: 'max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
                opacity: showBusinessPanel ? 1 : 0,
                overflow: 'hidden',
              }}
            >
              <div ref={panelRef} className="pt-1 space-y-3">
                {businessRoles.map(({ key, emoji, label, desc, grad }) => (
                  <button key={key} onClick={() => chooseBusinessRole(key)}
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
          </div>
        )}
      </div>

      {/* Модалка "Заявка отправлена" — для артиста и ресторана */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-fade">
          <div className="bg-[#0d0d16] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl anim-pop">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-white font-bold text-lg mb-2">Заявка отправлена!</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              {role === 'artist' ? 'Ваша карточка артиста находится' : 'Ваш ресторан находится'} на проверке у администратора.
              После одобрения вы получите доступ к личному кабинету.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6">
              <p className="text-amber-400 text-xs font-medium">Обычно проверка занимает до 24 часов</p>
            </div>
            <button
              onClick={goBackToClient}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)' }}
            >
              На главную
            </button>
          </div>
        </div>
      )}

      {/* Скрытая кнопка админа */}
      <button
        onClick={() => { setRole('admin'); setShowBusinessPanel(false); resetForm(); }}
        className="fixed bottom-5 right-5 z-[999] w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/10 hover:text-white/40 transition-all active:scale-95"
      >
        <span className="text-xl">⚙️</span>
      </button>
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