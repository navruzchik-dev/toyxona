import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setHall } from '../redux/slices/hallSlice.js'


const HallLogin = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    district: '',
    address: '',
    max_capacity_people: '',
    seating_capacity: '',
    price_per_day_uzs: '',
    waiters_count: '',
    has_led_screen: false,
    stage_size: '',
    parking_spaces: '',
    kitchen_type: '',
    image_url: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const isFormFilled =
    form.name !== '' &&
    form.district !== '' &&
    form.address !== '' &&
    form.max_capacity_people !== '' &&
    form.seating_capacity !== '' &&
    form.price_per_day_uzs !== '' &&
    form.waiters_count !== '' &&
    form.stage_size !== '' &&
    form.parking_spaces !== '' &&
    form.kitchen_type !== '' &&
    form.password !== ''

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    setMessage(null)
    console.log('отпраляется:', form)
    try {
      const res = await fetch('http://localhost:5000/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          max_capacity_people: Number(form.max_capacity_people),
          seating_capacity: Number(form.seating_capacity),
          price_per_day_uzs: Number(form.price_per_day_uzs),
          waiters_count: Number(form.waiters_count),
          parking_spaces: Number(form.parking_spaces),
        }),
      })
      console.log('Server status:', res.status)
      const data = await res.json()
      console.log('Data:', data)
      if (res.ok) {
        dispatch(setHall(data))
        navigate(`/hallProfile/${data.id}`)
      } else {
        setMessage({ type: 'error', text: 'Ошибка при регистрации. Попробуйте снова.' })
      }
    } catch (err) {
      console.log('loshara:', err)
      setMessage({ type: 'error', text: 'Сервер недоступен. Проверьте подключение.' })
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { label: 'Название ресторана', name: 'name', type: 'text', placeholder: 'Zarafshon Hall' },
    { label: 'Адрес', name: 'address', type: 'text', placeholder: 'ул. Матбуотчилар, 17' },
    { label: 'Макс. вместимость', name: 'max_capacity_people', type: 'number', placeholder: '400' },
    { label: 'Мест за столами', name: 'seating_capacity', type: 'number', placeholder: '380' },
    { label: 'Цена за день (сум)', name: 'price_per_day_uzs', type: 'number', placeholder: '70000000' },
    { label: 'Кол-во официантов', name: 'waiters_count', type: 'number', placeholder: '35' },
    { label: 'Размер сцены', name: 'stage_size', type: 'text', placeholder: '10x5м' },
    { label: 'Мест на парковке', name: 'parking_spaces', type: 'number', placeholder: '90' },
    { label: 'Ссылка на фото', name: 'image_url', type: 'text', placeholder: 'https://...' },
    { label: 'Пароль', name: 'password', type: 'password', placeholder: 'Введите пароль' },
  ]

  const districts = ['Мирабад', 'Юнусабад', 'Чиланзар', 'Яккасарай', 'Бектемир', 'Сергели', 'Учтепа', 'Олмазор', 'Шайхонтохур', 'Яшнабод']
  const kitchenTypes = ['Узбекская', 'Европейская', 'Смешанная', 'Азиатская']

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden flex shadow-2xl">

        {/* Левая панель */}
        <div className="w-2/5 bg-blue-950 flex flex-col items-center justify-center p-8 gap-4">
          <p className="text-white text-lg font-medium">Добро пожаловать</p>
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-white text-sm">
            Лого
          </div>
          <p className="text-white text-2xl font-semibold">Ресторан</p>
          <p className="text-white/70 text-xs text-center mt-4">
            Зарегистрируйте ваш ресторан чтобы продолжить
          </p>
        </div>

        {/* Правая форма */}
        <div className="w-3/5 flex flex-col px-10 py-10 gap-5 overflow-y-auto" style={{ maxHeight: '100vh' }}>
          <h2 className="text-gray-800 text-2xl font-semibold">Регистрация</h2>

          <div className="flex flex-col gap-4">
            {fields.map(({ label, name, type, placeholder }) => (
              <div key={name} className="flex flex-col gap-1">
                <label className="text-gray-700 text-sm font-medium">{label}</label>
                <input
                  type={type}
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  className="border-b border-gray-300 focus:border-[#2196f3] outline-none py-2 text-sm text-gray-700 placeholder-gray-400 transition-colors duration-150"
                />
              </div>
            ))}

            {/* Район */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-700 text-sm font-medium">Район</label>
              <select
                name="district"
                value={form.district}
                onChange={handleChange}
                className="border-b border-gray-300 focus:border-[#2196f3] outline-none py-2 text-sm text-gray-700 bg-transparent transition-colors duration-150"
              >
                <option value="">Выберите район</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Тип кухни */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-700 text-sm font-medium">Тип кухни</label>
              <select
                name="kitchen_type"
                value={form.kitchen_type}
                onChange={handleChange}
                className="border-b border-gray-300 focus:border-[#2196f3] outline-none py-2 text-sm text-gray-700 bg-transparent transition-colors duration-150"
              >
                <option value="">Выберите тип кухни</option>
                {kitchenTypes.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            {/* LED экран */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="has_led_screen"
                name="has_led_screen"
                checked={form.has_led_screen}
                onChange={handleChange}
                className="accent-[#2196f3] w-4 h-4"
              />
              <label htmlFor="has_led_screen" className="text-sm text-gray-700">
                Есть LED экран
              </label>
            </div>

            {/* Условия */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="terms" className="accent-[#2196f3] w-4 h-4" />
              <label htmlFor="terms" className="text-xs text-gray-500">
                Я соглашаюсь с{' '}
                <a href="/terms" target="_blank" className="text-[#2196f3] hover:underline font-medium">
                  условиями использования
                </a>
              </label>
            </div>
          </div>

          {message && (
            <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading || !isFormFilled}
              className={`rounded-full px-8 py-2.5 text-sm font-medium transition-all duration-150
                ${isFormFilled
                  ? 'bg-[#2196f3] text-white hover:bg-[#1a6fd4] active:scale-95 cursor-pointer'
                  : 'bg-gray-300 text-gray-400 cursor-not-allowed'
                }`}
            >
              {loading ? 'щас подожди' : 'Зарегистрироваться'}
            </button>
            <button className="border border-gray-300 text-gray-600 rounded-full px-8 py-2.5 text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all duration-150">
              Войти
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default HallLogin