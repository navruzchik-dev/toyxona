import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ToastNotification';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import ArtistLogin from './login/ArtistLogin';
import HallLogin from './login/HallLogin';
import Terms from './pages/Terms';
import Artist from './profiles/Artist';
import Hall from './profiles/Hall';
import AdminDashboard from './pages/AdminDashboard';

const NO_NAVBAR = ['/', '/artistLogin', '/hallLogin', '/terms'];

const Layout = () => {
  const location = useLocation();
  const showNavbar = !NO_NAVBAR.includes(location.pathname);

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/"                  element={<Login />} />
        <Route path="/home"              element={<Home />} />
        <Route path="/dashboard"         element={<Dashboard />} />
        <Route path="/checkout"          element={<Checkout />} />
        <Route path="/artistLogin"       element={<ArtistLogin />} />
        <Route path="/hallLogin"         element={<HallLogin />} />
        <Route path="/terms"             element={<Terms />} />
        <Route path="/artistProfile/:id" element={<Artist />} />
        <Route path="/hallProfile/:id"   element={<Hall />} />
        <Route path="/admin"             element={<AdminDashboard />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Layout />
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}