import React, { useState } from "react";
import { useDispatch } from 'react-redux'
import { setArtist } from '../redux/slices/artistSlice.js'
import { useNavigate } from 'react-router-dom'  


const ArtistLogin = () => {
   const dispatch = useDispatch()
  const navigate = useNavigate()  // ← добавь хук
 


  const [form, setForm] = useState({
    name: "",
    category: "",
    admin_phone: "",
    price_per_hour_usd: "",
    genre: "",
    rating: "",
    image_url: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
const isFormFilled = 
  form.name !== '' &&
  form.category !== '' &&
  form.admin_phone !== '' &&
  form.price_per_hour_usd !== '' &&
  form.genre !== '' &&
  form.password !== ''


  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
  setLoading(true);
  setMessage(null);
  console.log('шас подожди:', form) 
  try {
    const res = await fetch("http://localhost:5000/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price_per_hour_usd: Number(form.price_per_hour_usd),
        rating: Number(form.rating),
      }),
    });
    console.log('Server status:', res.status) 
    const data = await res.json() 
    console.log('Data:', data) 
    if (res.ok) {
      dispatch(setArtist(data))
      navigate(`/artistProfile/${data.id}`)

      console.log('все хорошо')
    } else {
      setMessage({ type: "error", text: "помогите" }); 
    }
  }
   catch (err) {
    console.log('lox:', err) 
    setMessage({ type: "error", text: "не получилось" });
    console.log('ne rabotaet rodnoy')
  } 
  finally {
    setLoading(false);
  }
};
  const fields = [
    {
      label: "Имя артиста",
      name: "name",
      type: "text",
      placeholder: "Введите ваше имя",
    },
    {
      label: "Телефон",
      name: "admin_phone",
      type: "text",
      placeholder: "Введите ваш номер",
    },
    {
      label: "Цена за час (USD)",
      name: "price_per_hour_usd",
      type: "number",
      placeholder: "Цена выступления за час",
    },
    { label: "Жанр", name: "genre", type: "text", placeholder: "Ваш жанр" },
  
    {
      label: "Пароль",
      name: "password",
      type: "password",
      placeholder: "Введите пароль",
    },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden flex shadow-2xl">
        {/* Левая панель */}
        <div className="w-2/5 bg-blue-950 flex flex-col items-center justify-center p-8 gap-4">
          <p className="text-white text-lg font-medium">Добро пожаловать</p>
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-white text-sm">
            Лого
          </div>
          <p className="text-white text-2xl font-semibold">Артист</p>
          <p className="text-white/70 text-xs text-center mt-4">
            Зарегистрируйтесь чтобы продолжить
          </p>
        </div>

        {/* Правая форма */}
        <div className="w-3/5 flex flex-col justify-center px-10 py-10 gap-5 overflow-y-auto max-h-screen">
          <h2 className="text-gray-800 text-2xl font-semibold">Регистрация</h2>

          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
  <div className="flex flex-col gap-2">
    {fields.map(({ label, name, type, placeholder }) => (
      <div key={name} className="flex flex-col gap-1">
        <label className="text-gray-700 text-sm font-medium">
          {label}
        </label>

        <input
          type={type}
          name={name}
          value={form[name]}
          onChange={handleChange}
          placeholder={placeholder}
          required   
          className="border-b border-gray-300 focus:border-[#2196f3] outline-none py-2 text-sm text-gray-700 placeholder-gray-400 transition-colors duration-150"
        />
      </div>
    ))}
  </div>

 <div className="flex flex-col gap-1">
              <label className="text-gray-700 text-sm font-medium">
                Категория
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className="border-b border-gray-300 focus:border-[#2196f3] outline-none py-2 text-sm text-gray-700 bg-transparent transition-colors duration-150"
              >
                <option value="">Выберите категорию</option>
                <option value="Хонзода">Хонзода</option>
                <option value="Рэпер">Рэпер</option>
                <option value="Поп">Поп</option>
                <option value="Классика">Классика</option>
                <option value="DJ">DJ</option>
                <option value="универсал">чорт</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="terms"
                className="accent-[#2196f3] w-4 h-4"
              />
              <label htmlFor="terms" className="text-xs text-gray-500">
                Я соглашаюсь с{" "}
                <span className="text-[#2196f3] font-medium cursor-pointer">
                  продажей своей почки
                </span>
              </label>
            </div>


  {/* <button
    type="submit"
    onClick={handleSubmit}
    disabled={loading}
    className="bg-[#2196f3] text-white rounded-full px-8 py-2.5 text-sm font-medium"
  >
    {loading ? "щас подожди" : "зарегатся"}
  </button> */}
  <button
  onClick={handleSubmit}
  disabled={loading || !isFormFilled}
  className={`rounded-full px-8 py-2.5 text-sm font-medium transition-all duration-150
    ${isFormFilled 
      ? 'bg-[#2196f3] text-white hover:bg-[#1a6fd4] active:scale-95 cursor-pointer' 
      : 'bg-gray-300 text-gray-400 cursor-not-allowed'
    }`}
>
  {loading ? "щас подожди" : "зарегатся"}
</button>
</form>


          {message && (
            <p
              className={`text-sm font-medium ${message.type === "success" ? "text-green-500" : "text-red-500"}`}
            >
              {message.text}
            </p>
          )}

          <div className="flex gap-3">
            {/* <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-[#2196f3] text-white rounded-full px-8 py-2.5 text-sm font-medium hover:bg-[#1a6fd4] active:scale-95 transition-all duration-150 disabled:opacity-50"
            >
              {loading ? "щас подожди" : "зарегатся"}
            </button> */}
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistLogin;
