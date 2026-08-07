import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, cycleTheme, THEMES } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled,    setScrolled]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  // ── Navbar виден ТОЛЬКО у клиента (и у гостя, пока не вошёл в систему).
  // Скрываем для hall, artist И admin — у них своя часть приложения без
  // этого меню (было: скрывался только hall/artist, admin оставался).
  if (user && user.role !== 'client') return null;

  const isActive = p => location.pathname === p;
  const handleLogout = () => { logout(); navigate('/login'); };

  const clientLinks = [
    { to: '/home',     label: 'Конструктор' },
    { to: '/checkout', label: 'Мои брони'   },
  ];
  const links    = clientLinks;
  const isClient = user?.role === 'client';
  const currentThemeInfo = THEMES.find(t => t.key === theme) || THEMES[0];

  const builderSections = [
    { emoji: '🏛️', label: 'Выбрать зал',     path: '/home', tab: 'planner'   },
    { emoji: '🎤', label: 'Выбрать артиста',  path: '/home', tab: 'planner'   },
    { emoji: '🚗', label: 'Выбрать машины',   path: '/home', tab: 'planner'   },
    { emoji: '✨', label: 'Выбрать декор',    path: '/home', tab: 'planner'   },
    { emoji: '🗺️', label: 'Карта залов',      path: '/home', tab: 'map'       },
    { emoji: '💬', label: 'AI Консультант',   path: '/home', tab: 'chat'      },
    { emoji: '❤️', label: 'Избранное',        path: '/home', tab: 'favorites' },
    { emoji: '⚖️', label: 'Сравнить пакеты', path: '/home', tab: 'compare'   },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--bg2) 95%, transparent)' : 'transparent',
          borderBottom: scrolled ? '1px solid var(--border)' : 'none',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          boxShadow: scrolled ? '0 8px 24px rgba(0,0,0,0.25)' : 'none',
        }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">

          {/* Logo */}
          <Link
            to={user?.role === 'client' ? '/home' : '/'}
            className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shadow-lg overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, black))' }}>
              <span className="text-white font-black text-lg leading-none select-none">B</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="leading-none">
              <span className="font-black tracking-widest text-base sm:text-lg" style={{ color: 'var(--text)' }}>BAYRAMLY</span>
              <span className="text-[10px] font-bold" style={{ color: 'var(--gold)' }}>.ai</span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {links.map(({ to, label }) => (
              <Link key={to} to={to}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={isActive(to)
                  ? { background: 'rgba(var(--gold-rgb),0.12)', border: '1px solid rgba(var(--gold-rgb),0.28)', color: 'var(--gold)' }
                  : { color: 'var(--text2)' }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={cycleTheme} title={`Тема: ${currentThemeInfo.label}`}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <span className="w-4 h-4 rounded-full block" style={{ background: currentThemeInfo.swatch }} />
            </button>

            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 55%, black))' }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium max-w-[90px] truncate" style={{ color: 'var(--text)' }}>{user.name}</span>
              </div>
            )}

            {user && (
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.10)'}>
                <span>↩</span>
                <span className="hidden sm:inline">Выйти</span>
              </button>
            )}

            <button onClick={() => setMenuOpen(o => !o)}
              className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-xl transition-all"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              {[0,1,2].map(i => (
                <span key={i} className="block h-0.5 rounded-full transition-all duration-200"
                  style={{
                    width: '16px',
                    background: 'var(--text)',
                    transform: menuOpen
                      ? i===0 ? 'rotate(45deg) translate(5px,5px)'
                      : i===2 ? 'rotate(-45deg) translate(5px,-5px)'
                      : 'scaleX(0)'
                      : 'none',
                    opacity: menuOpen && i===1 ? 0 : 1,
                  }} />
              ))}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t px-4 py-3 space-y-1"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            {links.map(({ to, label }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={isActive(to) ? { background: 'rgba(var(--gold-rgb),0.12)', color: 'var(--gold)' } : { color: 'var(--text2)' }}>
                {label}
              </Link>
            ))}
            {isClient && builderSections.map(({ emoji, label, path, tab }) => (
              <button key={label}
                onClick={() => { setMenuOpen(false); navigate(path, { state: { tab } }); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left"
                style={{ color: 'var(--text2)' }}>
                {emoji} {label}
              </button>
            ))}
            {user && (
              <button onClick={handleLogout}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-400">
                ↩ Выйти
              </button>
            )}
          </div>
        )}
      </nav>

      {builderOpen && <div className="fixed inset-0 z-40" onClick={() => setBuilderOpen(false)} />}
    </>
  );
}