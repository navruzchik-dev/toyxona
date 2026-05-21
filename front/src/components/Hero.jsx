import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 text-white pt-20">
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="animate-bounce mb-6">
          <Sparkles size={48} className="mx-auto text-yellow-300" />
        </div>
        
        <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
          AI-Конструктор <br /> 
          <span className="text-yellow-300">Твоей Идеальной Свадьбы</span>
        </h1>
        
        <p className="text-xl md:text-2xl mb-12 max-w-3xl mx-auto opacity-90">
          🎉 За 10 секунд готовый пакет "под ключ" за честную цену
        </p>

        <div className="flex gap-6 justify-center mb-16">
          <Link to="/dashboard" className="btn btn-lg bg-yellow-300 text-purple-900 hover:bg-yellow-400 font-bold gap-2">
            Начать Конструктор
            <ArrowRight size={20} />
          </Link>
          
          <button className="btn btn-lg btn-outline border-white text-white hover:bg-white hover:text-purple-600">
            Смотреть Примеры
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white/10 backdrop-blur p-6 rounded-xl">
            <p className="text-3xl font-bold">📍</p>
            <h3 className="text-xl font-bold mt-2">Все Рестораны</h3>
            <p className="text-sm opacity-80">Свободные даты и цены</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur p-6 rounded-xl">
            <p className="text-3xl font-bold">🎤</p>
            <h3 className="text-xl font-bold mt-2">Артисты</h3>
            <p className="text-sm opacity-80">Проверенные исполнители</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur p-6 rounded-xl">
            <p className="text-3xl font-bold">💰</p>
            <h3 className="text-xl font-bold mt-2">Честные Цены</h3>
            <p className="text-sm opacity-80">Без скрытых наценок</p>
          </div>
        </div>
      </div>
    </section>
  );
}