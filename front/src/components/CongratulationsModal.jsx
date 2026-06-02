import React, { useEffect, useState } from 'react';

export default function CongratulationsModal({ groomName, brideName }) {
  const [show, setShow] = useState(true);
  const [hearts, setHearts] = useState([]);

  useEffect(() => {
    const arr = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      size: 14 + Math.random() * 18,
      dur: 3 + Math.random() * 2,
    }));
    setHearts(arr);
    const t = setTimeout(() => setShow(false), 5500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.15) 0%, rgba(8,8,16,0.97) 70%)' }}>
      
      {/* Floating hearts */}
      {hearts.map(h => (
        <div key={h.id} className="absolute bottom-0 pointer-events-none"
          style={{
            left: `${h.left}%`,
            animationName: 'floatHeart',
            animationDuration: `${h.dur}s`,
            animationDelay: `${h.delay}s`,
            animationTimingFunction: 'ease-in-out',
            animationFillMode: 'forwards',
          }}>
          <span style={{ fontSize: h.size }}>💍</span>
        </div>
      ))}

      <div className="text-center px-6 relative z-10">
        {/* Ring animation */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-[#C9A84C]/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-4 border-[#C9A84C]/50 animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-0 flex items-center justify-center text-5xl">💍</div>
          </div>
        </div>

        <div className="text-white/60 text-sm uppercase tracking-[0.3em] font-medium mb-4">
          Поздравляем
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white mb-3 leading-tight">
          {groomName && brideName
            ? <><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] to-[#F5D78E]">{groomName}</span>
              {' & '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5D78E] to-[#C9A84C]">{brideName}</span></>
            : <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] to-[#F5D78E]">Поздравляем!</span>
          }
        </h1>

        <p className="text-white/50 text-base sm:text-lg mb-2">Ваш той успешно забронирован</p>
        <p className="text-[#C9A84C] text-xl sm:text-2xl font-bold">Будьте счастливы! 🌸</p>

        {/* Progress bar */}
        <div className="mt-10 w-48 mx-auto h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#C9A84C] to-[#F5D78E] rounded-full"
            style={{ animation: 'expand 5.5s linear forwards' }} />
        </div>
        <p className="text-white/25 text-xs mt-2">Переходим к бронированию...</p>
      </div>

      <style>{`
        @keyframes floatHeart {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes expand {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  );
}