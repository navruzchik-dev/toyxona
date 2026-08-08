import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext();

// Светлые свадебные темы — Navbar и Home берут список отсюда
export const THEMES = [
  { key: 'light',    label: 'Classic',  swatch: '#b8953d' },
  { key: 'emerald',  label: 'Emerald',  swatch: '#2a9d6e' },
  { key: 'rose',     label: 'Rose',     swatch: '#c97a9a' },
];

const DEFAULT_THEME = 'light';
const isValidTheme = (key) => THEMES.some(t => t.key === key);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('bay_theme');
      // старые тёмные ключи → light
      if (saved === 'gold' || saved === 'amethyst' || !isValidTheme(saved)) return DEFAULT_THEME;
      return saved;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('bay_theme', theme); } catch {}
  }, [theme]);

  const setTheme = (key) => {
    if (isValidTheme(key)) setThemeState(key);
  };

  const cycleTheme = () => {
    setThemeState(prev => {
      const idx = THEMES.findIndex(t => t.key === prev);
      const next = THEMES[(idx + 1) % THEMES.length];
      return next.key;
    });
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, cycleTheme, THEMES }}>
      {children}
    </ThemeCtx.Provider>
  );
};

export const useTheme = () => useContext(ThemeCtx);
