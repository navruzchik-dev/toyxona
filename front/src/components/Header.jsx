import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-lg">
      <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">
          <Heart className="text-pink-500" size={28} />
          Mening To'yim
        </Link>
        
        <div className="flex gap-6 items-center">
          <Link to="/" className="hover:text-pink-500 font-semibold">Главная</Link>
          <Link to="/dashboard" className="hover:text-pink-500 font-semibold">Конструктор</Link>
          <button className="btn btn-primary gap-2">
            Начать
          </button>
        </div>
      </nav>
    </header>
  );
}