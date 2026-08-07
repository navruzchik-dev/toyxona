import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext();

// Единственное место, где перечислены доступные темы — Navbar и Home.jsx
// берут этот список отсюда, чтобы не было двух рассинхронизированных копий.
export const THEMES = [
  { key: 'emerald',  label: 'Emerald',  swatch: '#34d399' },
  { key: 'rose',     label: 'Rose',     swatch: '#e8a0bf' },
  { key: 'amethyst', label: 'Amethyst', swatch: '#a78bfa' },
];

const DEFAULT_THEME = 'emerald';
const isValidTheme = (key) => THEMES.some(t => t.key === key);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('bay_theme');
    return isValidTheme(saved) ? saved : DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bay_theme', theme);
  }, [theme]);

  const setTheme = (key) => {
    if (isValidTheme(key)) setThemeState(key);
  };

  const cycleTheme = () => {
    setThemeState(prev => {
      const idx = THEMES.findIndex(t => t.key === prev);
      return THEMES[(idx + 1) % THEMES.length].key;
    });
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, cycleTheme, THEMES }}>
      {children}
    </ThemeCtx.Provider>
  );
};

export const useTheme = () => useContext(ThemeCtx);