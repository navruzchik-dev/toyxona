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
  name: '', phone: '', password: '', password2: '', telegram: '',
  groomName: '', brideName: '',
  category: 'Хонанда', genre: '', price: '',
  district: '', address: '', maxCapacity: '', seatingCapacity: '',
  pricePerDay: '', waitersCount: '', hasLed: false, stageSize: '',
  parkingSpaces: '', kitchenType: '', imageUrl: '',
};

const PHONE_PREFIX = '998';
const MIN_PASSWORD_LEN = 8;

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
const toCleanPhone = (rawDigits) => `+${PHONE_PREFIX}${onlyPhoneDigits(rawDigits)}`;
const isPhoneComplete = (rawDigits) => onlyPhoneDigits(rawDigits).length === 9;
const normalizeTg = (u) => String(u || '').replace(/^@/, '').trim();

/** Отправка кода в Telegram. Бэкенд: POST /auth/send-telegram-code */
async function sendTelegramCode(payload) {
  try {
    const res = await fetch(`${API}/auth/send-telegram-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, devCode: data.dev_code || null };
    }
  } catch (_) {}
  // Dev fallback
  const mock = String(Math.floor(100000 + Math.random() * 900000));
  sessionStorage.setItem('bay_tg_code', mock);
  sessionStorage.setItem('bay_tg_payload', JSON.stringify(payload));
  console.info('[Bayramly] Telegram code (dev):', mock);
  return { ok: true, devCode: mock };
}

/** Проверка кода. Бэкенд: POST /auth/verify-telegram-code */
async function verifyTelegramCode(payload) {
  try {
    const res = await fetch(`${API}/auth/verify-telegram-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.message || 'Неверный код' };
  } catch (_) {}
  const expected = sessionStorage.getItem('bay_tg_code');
  if (expected && payload.code === expected) {
    sessionStorage.removeItem('bay_tg_code');
    return { ok: true };
  }
  return { ok: false, error: 'Неверный код. Проверьте Telegram.' };
}

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { login, register, user } = useAuth();

  const [role, setRole] = useState('client');
  const [mode, setMode] = useState('login'); // login | register | verify
  const [form, setForm] = useState(emptyForm);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [pendingClient, setPendingClient] = useState(null);

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
    setInfo('');
    setForm(emptyForm);
    setAgreed(false);
    setVerifyCode('');
    setDevCode(null);
    setPendingClient(null);
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

  /** Финальное сохранение клиента после подтверждения Telegram */
  const finishClientRegister = async (clientData) => {
    const checkRes = await fetch(`${API}/users?phone=${encodeURIComponent(clientData.phone)}`);
    const existing = await checkRes.json();
    if (existing.length > 0) {
      setError('Этот номер уже зарегистрирован');
      return false;
    }

    const newUser = {
      name: clientData.name,
      phone: clientData.phone,
      password: clientData.password,
      telegram_username: clientData.telegram_username,
      groomName: clientData.groomName || '',
      brideName: clientData.brideName || '',
      id: 'c_' + Date.now(),
      role: 'client',
      verified: true,
    };

    const saveRes = await fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });

    if (!saveRes.ok) throw new Error('Ошибка сохранения');

    // Авто-вход
    const result = await login(clientData.phone, clientData.password, 'client');
    if (result?.success) navigate('/home');
    else navigate('/home');
    return true;
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(verifyCode.trim())) {
      setError('Введите код из 4–6 цифр');
      return;
    }
    setLoading(true);
    try {
      const check = await verifyTelegramCode({
        code: verifyCode.trim(),
        phone: pendingClient?.phone,
        telegram_username: pendingClient?.telegram_username,
      });
      if (!check.ok) {
        setError(check.error || 'Неверный код');
        return;
      }
      await finishClientRegister(pendingClient);
    } catch (err) {
      setError(err.message || 'Ошибка подтверждения');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
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
          if (!normalizeTg(form.telegram)) {
            setError('Укажите Telegram username — туда придёт код подтверждения');
            return;
          }
          if (form.password.length < MIN_PASSWORD_LEN) {
            setError(`Пароль должен содержать минимум ${MIN_PASSWORD_LEN} символов`);
            return;
          }
          if (form.password !== form.password2) {
            setError('Пароли не совпадают');
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

          const tg = normalizeTg(form.telegram);
          const sent = await sendTelegramCode({
            purpose: 'register',
            phone: cleanPhone,
            telegram_username: tg,
            name: form.name,
          });
          if (!sent.ok) {
            setError('Не удалось отправить код. Напишите /start боту @BayramlyBot и попробуйте снова.');
            return;
          }

          setPendingClient({
            name: form.name,
            phone: cleanPhone,
            password: form.password,
            telegram_username: tg,
            groomName: form.groomName,
            brideName: form.brideName,
          });
          setDevCode(sent.devCode);
          setInfo(`Код отправлен в Telegram @${tg}. Если не пришло — напишите боту @BayramlyBot команду /start.`);
          setMode('verify');
          setVerifyCode('');
          return;
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
          if (form.password !== form.password2) {
            setError('Пароли не совпадают');
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
            telegram_username: normalizeTg(form.telegram) || undefined,
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
          if (form.password !== form.password2) {
            setError('Пароли не совпадают');
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
              telegram_username: normalizeTg(form.telegram) || undefined,
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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
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
        .scroll-fields::-webkit-scrollbar-thumb { background: rgba(var(--gold-rgb),0.25); border-radius: 10px; }
      `}</style>

      {/* Soft gold glow — theme aware */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'rgba(var(--gold-rgb), 0.12)' }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(to right, transparent, rgba(var(--gold-rgb),0.35), transparent)' }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 anim-fade">
          <div className="inline-flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, #000))',
                boxShadow: '0 12px 40px rgba(var(--gold-rgb),0.25)',
              }}
            >
              <span className="text-white font-black text-xl">B</span>
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-black tracking-widest leading-none" style={{ color: 'var(--text)' }}>
                BAYRAMLY<span style={{ color: 'var(--gold)' }}>.ai</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Умный планировщик торжеств</p>
            </div>
          </div>
        </div>

        {/* Auth form */}
        <div
          key={`${role}-${mode}`}
          className="rounded-3xl p-6 sm:p-8 anim-card border"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            {(!isClient || mode === 'verify') && (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'verify') { setMode('register'); setError(''); setInfo(''); return; }
                  goBackToClient();
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition"
                style={{ background: 'rgba(var(--gold-rgb),0.08)', color: 'var(--text2)' }}
              >
                ←
              </button>
            )}
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>
                {mode === 'verify' ? '📱 Подтверждение' : `${selectedRole?.emoji} ${selectedRole?.label}`}
              </h2>
              {role !== 'admin' && mode !== 'verify' && (
                <div className="flex gap-3 mt-1">
                  {['login', 'register'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMode(m); setError(''); setInfo(''); }}
                      className="text-xs font-medium transition-colors pb-0.5 border-b"
                      style={{
                        color: mode === m ? 'var(--gold)' : 'var(--text2)',
                        borderColor: mode === m ? 'var(--gold)' : 'transparent',
                      }}
                    >
                      {m === 'login' ? 'Войти' : 'Регистрация'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── VERIFY (Telegram code) ── */}
          {mode === 'verify' ? (
            <form onSubmit={handleVerifyCode} className="space-y-4 anim-fade">
              {info && (
                <div
                  className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{ background: 'rgba(var(--gold-rgb),0.08)', color: 'var(--text)', border: '1px solid rgba(var(--gold-rgb),0.2)' }}
                >
                  {info}
                </div>
              )}
              {devCode && (
                <div
                  className="rounded-xl px-4 py-2 text-xs"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  Режим разработки: код <strong className="tracking-widest">{devCode}</strong>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
                  Код из Telegram
                </label>
                <input
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  inputMode="numeric"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none tracking-[0.35em] text-center font-bold"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-500 text-sm text-center anim-pop">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-45"
                style={{
                  background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, #000))',
                  boxShadow: '0 8px 25px rgba(var(--gold-rgb),0.2)',
                }}
              >
                {loading ? 'Проверяем…' : 'Подтвердить и войти'}
              </button>
            </form>
          ) : (
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
                    <Input
                      label="Telegram username"
                      value={form.telegram}
                      onChange={v => set('telegram', v)}
                      placeholder="@username"
                    />
                    <p className="text-[10px] -mt-2" style={{ color: 'var(--text2)' }}>
                      На этот аккаунт придёт код. Сначала напишите боту @BayramlyBot: /start
                    </p>
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
                    <Input label="Telegram (необязательно)" value={form.telegram} onChange={v => set('telegram', v)} placeholder="@username" />
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
                    <Input label="Telegram (необязательно)" value={form.telegram} onChange={v => set('telegram', v)} placeholder="@username" />
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
                    <p
                      className="text-xs mt-1.5"
                      style={{
                        color: form.password && form.password.length < MIN_PASSWORD_LEN
                          ? '#ef4444'
                          : 'var(--text2)',
                      }}
                    >
                      Минимум {MIN_PASSWORD_LEN} символов
                    </p>
                  )}
                </div>

                {/* Повтор пароля при регистрации */}
                {mode === 'register' && role !== 'admin' && (
                  <div>
                    <Input
                      label="Повторите пароль"
                      type="password"
                      value={form.password2}
                      onChange={v => set('password2', v)}
                      placeholder="Ещё раз тот же пароль"
                    />
                    {form.password2 && form.password !== form.password2 && (
                      <p className="text-xs mt-1.5 text-red-500">Пароли не совпадают</p>
                    )}
                  </div>
                )}

                {mode === 'register' && role !== 'admin' && (
                  <Checkbox checked={agreed} onChange={setAgreed}>
                    Я принимаю{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }} className="hover:underline">
                      условия использования
                    </a>
                  </Checkbox>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-500 text-sm text-center anim-pop">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-45"
                style={{
                  background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, #000))',
                  boxShadow: '0 8px 25px rgba(var(--gold-rgb),0.2)',
                }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                    Загрузка...
                  </span>
                ) : mode === 'login'
                  ? 'Войти'
                  : (role === 'artist' || role === 'hall')
                    ? 'Отправить заявку'
                    : 'Получить код в Telegram'}
              </button>
            </form>
          )}
        </div>

        {/* Ссылка "Я исполнитель / ресторан" */}
        {isClient && mode !== 'verify' && (
          <div className="mt-5 anim-fade" style={{ animationDelay: '0.15s' }}>
            <button
              type="button"
              onClick={() => setShowBusinessPanel(v => !v)}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium transition-colors py-2"
              style={{ color: 'var(--text2)' }}
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
                  <button
                    key={key}
                    type="button"
                    onClick={() => chooseBusinessRole(key)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 group text-left"
                    style={{
                      background: 'var(--card)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg transition-transform group-hover:scale-110"
                      style={{ background: `linear-gradient(135deg, ${grad})` }}
                    >
                      {emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>{desc}</div>
                    </div>
                    <span className="ml-auto text-lg transition-colors" style={{ color: 'var(--text2)' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Модалка "Заявка отправлена" */}
      {showPendingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade"
          style={{ background: 'rgba(20,16,12,0.55)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl anim-pop border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>Заявка отправлена!</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text2)' }}>
              {role === 'artist' ? 'Ваша карточка артиста находится' : 'Ваш ресторан находится'} на проверке у администратора.
              После одобрения вы получите доступ к личному кабинету.
            </p>
            <div
              className="rounded-xl px-4 py-3 mb-6"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <p className="text-amber-600 text-xs font-medium">Обычно проверка занимает до 24 часов</p>
            </div>
            <button
              type="button"
              onClick={goBackToClient}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, #000))' }}
            >
              На главную
            </button>
          </div>
        </div>
      )}

      {/* Скрытая кнопка админа */}
      <button
        type="button"
        onClick={() => { setRole('admin'); setShowBusinessPanel(false); resetForm(); setMode('login'); }}
        className="fixed bottom-5 right-5 z-[999] w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{ background: 'rgba(var(--gold-rgb),0.08)', color: 'var(--text2)' }}
      >
        <span className="text-xl">⚙️</span>
      </button>
    </div>
  );
}

const Input = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
    />
  </div>
);

const PhoneInput = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
      {label}
    </label>
    <input
      type="text"
      inputMode="numeric"
      autoComplete="tel"
      value={formatPhoneDisplay(value)}
      onChange={e => onChange(onlyPhoneDigits(e.target.value))}
      placeholder="+998 90 123 45 67"
      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all tabular-nums"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
    />
  </div>
);

const Select = ({ label, value, onChange, options, placeholder = 'Выберите' }) => (
  <div>
    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
      {label}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

const Checkbox = ({ checked, onChange, children }) => (
  <label className="flex items-start gap-3 cursor-pointer group">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all"
      style={{
        background: checked ? 'var(--gold)' : 'transparent',
        borderColor: checked ? 'var(--gold)' : 'var(--border)',
      }}
    >
      {checked && <span className="text-white text-xs font-bold">✓</span>}
    </button>
    <span className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{children}</span>
  </label>
);
