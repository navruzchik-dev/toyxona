import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import Login from './pages/Login.jsx'
import ArtistLogin from './login/ArtistLogin.jsx'
import HallLogin from './login/HallLogin.jsx'
import Terms from './pages/Terms.jsx'
import Artist from './profiles/Artist.jsx'
import Hall from './profiles/Hall.jsx'

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <Router>
      <div className="min-h-screen bg-base-300 text-base-content relative overflow-x-hidden pb-12">
        <Navbar user={currentUser} onLogin={setCurrentUser} onLogout={handleLogout} />
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/" element={<Login/>}/>
          <Route path="/artistLogin" element={<ArtistLogin/>}/>
          <Route path="/hallLogin" element={<HallLogin/>}/>
          <Route path='/terms' element={<Terms/>}/>
          <Route path='/artistProfile/:id' element={<Artist/>}/>
          <Route path='/hallProfile/:id' element={<Hall/>}/>
        </Routes>
      </div>
    </Router>
  );
}

export default App;