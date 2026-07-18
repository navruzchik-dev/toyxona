import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('bayramly_session');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (phone, password, target = 'client') => {
    try {
      // Admin: ищем по полю login, не phone
      if (target === 'admin') {
        const res = await fetch(`http://localhost:5000/users?login=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.length === 0) throw new Error('Неверный логин');
        const found = data[0];
        if (found.password !== password) throw new Error('Неверный пароль');
        if (found.role !== 'admin') throw new Error('Нет доступа');
        const sessionData = { ...found, role: 'admin' };
        localStorage.setItem('bayramly_session', JSON.stringify(sessionData));
        setUser(sessionData);
        return { success: true, role: 'admin', id: found.id };
      }

      // Клиент / артист
      const endpoint = target === 'artist' ? 'artists' : 'users';
      const phoneKey = target === 'artist' ? 'admin_phone' : 'phone';
      const res = await fetch(`http://localhost:5000/${endpoint}?${phoneKey}=${encodeURIComponent(phone)}`);
      if (!res.ok) throw new Error('Ошибка связи с сервером БД');
      const data = await res.json();
      if (data.length === 0) throw new Error('Пользователь с таким номером не найден');
      const found = data[0];
      if (found.password !== password) throw new Error('Неверный пароль');
      const sessionData = { ...found, role: target };
      localStorage.setItem('bayramly_session', JSON.stringify(sessionData));
      setUser(sessionData);
      return { success: true, role: target, id: found.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const register = async (userData, target = 'client') => {
    try {
      const endpoint = target === 'artist' ? 'artists' : 'users';
      const phoneKey = target === 'artist' ? 'admin_phone' : 'phone';
      const checkPhone = userData[phoneKey];

      const checkRes = await fetch(`http://localhost:5000/${endpoint}?${phoneKey}=${encodeURIComponent(checkPhone)}`);
      const existing = await checkRes.json();
      if (existing.length > 0) throw new Error('Этот номер телефона уже занят!');

      const res = await fetch(`http://localhost:5000/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) throw new Error('Не удалось записать данные в db.json');

      const savedUser = await res.json();
      const sessionData = { ...savedUser, role: target };
      localStorage.setItem('bayramly_session', JSON.stringify(sessionData));
      setUser(sessionData);
      return { success: true, role: target, id: savedUser.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('bayramly_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);