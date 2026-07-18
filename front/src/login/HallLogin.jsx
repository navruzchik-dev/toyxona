import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setHall } from '../redux/slices/hallSlice.js';

const DISTRICTS = ['Мирабад', 'Юнусабад', 'Чиланзар', 'Яккасарай', 'Бектемир', 'Сергели', 'Учтепа', 'Олмазор', 'Шайхонтохур', 'Яшнабод'];
const KITCHEN_TYPES = ['Узбекская', 'Европейская', 'Смешанная', 'Азиатская', 'Миллий', 'Восточная'];

const emptyForm = {
  name: '', district: '', address: '', maxCapacity: '', seatingCapacity: '',
  pricePerDay: '', waitersCount: '', hasLed: false, stageSize: '',
  parkingSpaces: '', kitchenType: '', imageUrl: '', phone: '', password: '',
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
  const p1 = digits.slice(0, 2), p2 = digits.slice(2, 5), p3 = digits.slice(5, 9);
  let out = `+${PHONE_PREFIX}`;
  if (p1) out += ` ${p1}`;
  if (p2) out += ` ${p2}`;
  if (p3) out += ` ${p3}`;
  return out;
};
const toCleanPhone = (rawDigits) => `+${PHONE_PREFIX}${onlyPhoneDigits(rawDigits)}`;
const isPhoneComplete = (rawDigits) => onlyPhoneDigits(rawDigits).length === 9;

export default function HallLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isLoginTab, setIsLoginTab] = useState(true);
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.phone || !loginForm.password) {
      setError('Заполните все поля');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cleanPhone = toCleanPhone(loginForm.phone);
      const res = await fetch('http://localhost:5000/restaurants');
      const list = await res.json();
      const hall = list.find(
        h => (h.phone === cleanPhone || h.admin_phone === cleanPhone) && h.password === loginForm.password
      );
      if (!hall) {
        setError('Неверный номер телефона или пароль');
      } else if (hall.pending) {
        setError('Ваша заявка ещё на рассмотрении. Пожалуйста, дождитесь одобрения администратором.');
      } else {
        dispatch(setHall(hall));
        navigate(`/hallProfile/${hall.id}`);
      }
    } catch {
      setError('Ошибка сервера');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const required = [
      form.name, form.district, form.address, form.maxCapacity, form.seatingCapacity,
      form.pricePerDay, form.waitersCount, form.stageSize, form.parkingSpaces,
      form.kitchenType, form.password,
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

    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/restaurants', {
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
          image_url: form.imageUrl,
          phone: toCleanPhone(form.phone),
          password: form.password,
          booked_dates: [],
          pending: true,
        }),
      });
      if (res.ok) {
        setShowPendingModal(true);
      } else {
        setError('Ошибка при регистрации. Попробуйте снова.');
      }
    } catch {
      setError('Сервер недоступен. Проверьте подключение.');
    }
    setLoading(false);
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
        .scroll-fields::-webkit-scrollbar { width: 5px; }
        .scroll-fields::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
      `}</style>

      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] bg-[#C9A84C]/6 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 anim-fade">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#7A5C1E] flex items-center justify-center shadow-2xl shadow-[#C9A84C]/25">
              <span className="text-white font-black text-xl">B</span>
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-widest leading-none">
                BAYRAMLY<span className="text-[#C9A84C]">.ai</span>
              </h1>
              <p className="text-white/35 text-xs mt-0.5">Панель ресторана</p>
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
              <h2 className="text-white font-bold">🏛️ Ресторан</h2>
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

          {isLoginTab ? (
            <form onSubmit={handleLogin} className="space-y-4 anim-fade">
              <PhoneInput label="Контактный телефон" value={loginForm.phone} onChange={v => setLoginForm(p => ({ ...p, phone: v }))} />
              <Input label="Пароль" type="password" value={loginForm.password} onChange={v => setLoginForm(p => ({ ...p, password: v }))} placeholder="••••••••" />

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center anim-pop">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-45 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)', boxShadow: '0 8px 25px rgba(201,168,76,0.2)' }}>
                {loading ? 'Вход...' : 'Войти в панель'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 anim-fade">
              <div className="scroll-fields space-y-4 max-h-[360px] overflow-y-auto pr-1 -mr-1">
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
                <PhoneInput label="Контактный телефон" value={form.phone} onChange={v => set('phone', v)} />
                <div>
                  <Input label="Пароль" type="password" value={form.password} onChange={v => set('password', v)} placeholder="••••••••" />
                  <p className={`text-xs mt-1.5 ${form.password && form.password.length < MIN_PASSWORD_LEN ? 'text-red-400' : 'text-white/30'}`}>
                    Минимум {MIN_PASSWORD_LEN} символов
                  </p>
                </div>
                <Checkbox checked={agreed} onChange={setAgreed}>
                  Я принимаю{' '}
                  <a href="/terms" target="_blank" className="text-[#C9A84C] hover:underline">условия использования</a>
                </Checkbox>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center anim-pop">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-45 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #7A5C1E)', boxShadow: '0 8px 25px rgba(201,168,76,0.2)' }}>
                {loading ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </form>
          )}
        </div>
      </div>

      {showPendingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-fade">
          <div className="bg-[#0d0d16] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl anim-pop">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-white font-bold text-lg mb-2">Заявка отправлена!</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              Ваш ресторан находится на проверке у администратора. После одобрения вы сможете войти в личный кабинет.
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