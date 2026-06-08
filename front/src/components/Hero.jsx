import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Sparkles, 
  ArrowRight, 
  MapPin, 
  Mic, 
  Banknote, 
  Settings, 
  Calendar, 
  Users 
} from "lucide-react";

export default function Hero() {
  const navigate = useNavigate();
  
  // Состояния для интерактивной панели параметров (как на скрине image_3ce81c.png)
  const [budget, setBudget] = useState(15000);
  const [guests, setGuests] = useState(250);
  const [date, setDate] = useState("");

  const handleGenerate = (e) => {
    e.preventDefault();
    // Передаем параметры в конструктор/dashboard
    navigate("/dashboard", { state: { budget, guests, date } });
  };

  return (
    <section className="min-h-screen bg-[#080810] text-white pt-24 pb-16 relative overflow-hidden flex items-center">
      {/* Фоновое свечение в премиальном стиле */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[140px] bg-[#C9A84C]/10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* ЛЕВАЯ ЧАСТЬ: Контент заголовка */}
          <div className="lg:col-span-7 text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#C9A84C]">
              <Sparkles size={14} />
              <span>Умное планирование на базе AI</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.15]">
              AI-Конструктор <br /> 
              <span className="bg-gradient-to-r from-[#C9A84C] to-[#F3E3B6] bg-clip-text text-transparent">
                Твоей Идеальной Свадьбы
              </span>
            </h1>
            
            <p className="text-lg text-white/60 max-w-xl">
              🎉 Получи готовый свадебный пакет «под ключ» всего за 10 секунд и по абсолютно честной цене без скрытых переплат.
            </p>

            {/* Карточки преимуществ с реальными иконками вместо эмодзи */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="bg-white/4 border border-white/5 backdrop-blur p-4 rounded-2xl flex flex-col gap-2">
                <MapPin className="text-[#C9A84C]" size={22} />
                <div>
                  <h3 className="text-sm font-bold text-white">Все Рестораны</h3>
                  <p className="text-xs text-white/45 mt-0.5">Свободные даты и цены</p>
                </div>
              </div>
              
              <div className="bg-white/4 border border-white/5 backdrop-blur p-4 rounded-2xl flex flex-col gap-2">
                <Mic className="text-[#C9A84C]" size={22} />
                <div>
                  <h3 className="text-sm font-bold text-white">Артисты</h3>
                  <p className="text-xs text-white/45 mt-0.5">Проверенные профи</p>
                </div>
              </div>
              
              <div className="bg-white/4 border border-white/5 backdrop-blur p-4 rounded-2xl flex flex-col gap-2">
                <Banknote className="text-[#C9A84C]" size={22} />
                <div>
                  <h3 className="text-sm font-bold text-white">Честные Цены</h3>
                  <p className="text-xs text-white/45 mt-0.5">Без скрытых наценок</p>
                </div>
              </div>
            </div>
          </div>

          {/* ПРАВАЯ ЧАСТЬ: Идеальная интерактивная панель параметров (из скрина) */}
          <div className="lg:col-span-5">
            <div className="bg-[#12121e] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
                <Settings size={18} className="text-[#C9A84C]" />
                <h2 className="text-lg font-bold tracking-wide text-white/90">Параметры тоя</h2>
              </div>

              <form onSubmit={handleGenerate} className="space-y-6">
                {/* Бюджет */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/60">Бюджет</span>
                    <span className="font-bold text-[#C9A84C] text-base">
                      ${budget.toLocaleString()}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="2000" 
                    max="50000" 
                    step="500"
                    value={budget} 
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full accent-[#C9A84C] bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Гостей */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/60 flex items-center gap-1.5">
                      Гостей
                    </span>
                    <span className="font-bold text-purple-400 text-base">
                      {guests} чел.
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="30" 
                    max="500" 
                    step="10"
                    value={guests} 
                    onChange={(e) => setGuests(Number(e.target.value))}
                    className="w-full accent-[#C9A84C] bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Дата торжества */}
                <div className="space-y-2 pt-2">
                  <label className="text-sm text-white/60 flex items-center gap-2">
                    <Calendar size={16} className="text-white/40" />
                    Дата торжества
                  </label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C]/50 focus:bg-white/8 transition-all scheme-dark"
                    />
                  </div>
                </div>

                {/* Главная кнопка генерации пакета */}
                <button 
                  type="submit"
                  className="w-full mt-4 bg-gradient-to-r from-[#C9A84C] to-[#7A5C1E] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[#C9A84C]/10"
                >
                  <Sparkles size={16} />
                  <span>Сгенерировать пакет</span>
                  <ArrowRight size={16} className="ml-1" />
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}