import React, { useEffect, useState } from 'react';

const AILoader = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Math.random();
      const newParticle = {
        id,
        size: Math.random() * 4 + 2,
        left: Math.random() * 90 + 5,
        bottom: Math.random() * 40,
        duration: Math.random() * 2 + 2
      };
      setParticles(prev => [...prev, newParticle]);
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      }, 4000);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ai-loading-stage shadow-2xl border border-primary/20">
      <div className="orb orb1"></div>
      <div className="orb orb2"></div>
      <div className="orb orb3"></div>

      <div className="star star1">
        <svg width="36" height="36" viewBox="0 0 36 36"><polygon points="18,2 21,13 32,13 23,20 26,31 18,24 10,31 13,20 4,13 15,13" fill="#C9A84C"/></svg>
      </div>
      <div className="star star2">
        <svg width="20" height="20" viewBox="0 0 20 20"><polygon points="10,1 12,7 18,7 13,11 15,17 10,13 5,17 7,11 2,7 8,7" fill="#C9A84C"/></svg>
      </div>
      <div className="star star3">
        <svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9 12,14 8,11 4,14 5,9 1,6 6,6" fill="#C9A84C" opacity="0.8"/></svg>
      </div>

      <div className="hex-wrap">
        <svg width="110" height="110" viewBox="-55 -55 110 110">
          <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="none" stroke="#C9A84C" stroke-width="1.5"/>
          <polygon points="0,-36 31,-18 31,18 0,36 -31,18 -31,-18" fill="#1A3A6B"/>
          <line x1="-12" y1="-18" x2="-12" y2="18" stroke="#C9A84C" stroke-width="3" stroke-linecap="round"/>
          <path d="M-12,-18 Q10,-18 10,-6 Q10,0 -12,0" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M-12,0 Q12,0 12,9 Q12,18 -12,18" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>

      <div className="brand-text">BAYRAMLY</div>
      <div className="tagline">AI EVENT PLANNER</div>
      <div className="divider"></div>
      <div className="subtitle">Ваш той — под ключ за 10 секунд</div>
      <div className="shimmer"></div>

      {particles.map(p => (
        <span
          key={p.id}
          className="particle"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            bottom: `${p.bottom}px`,
            animationDuration: `${p.duration}s`
          }}
        />
      ))}
    </div>
  );
};

export default AILoader;