import React from 'react'
import { useNavigate } from 'react-router-dom'

const Login = () => {

  const navigate = useNavigate()  

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center px-4 py-8">
      
      <div className="bg-[#6c5ce7] text-white rounded-full px-6 py-2.5 text-sm font-medium mb-12">
        Добро пожаловать
      </div>

      <div className="bg-[#16213e] rounded-2xl p-10 w-full max-w-md flex flex-col items-center gap-6">
        
        <p className="text-white text-xl font-medium text-center m-0">
          Кто вы?
        </p>

        <div className="flex flex-col gap-3 w-full">
          {[
            { letter: 'A', label: 'Ресторан', onClick: () => navigate("/hallLogin") },
            { letter: 'B', label: 'Артист', onClick: () => navigate("/artistLogin") },
            { letter: 'C', label: 'Клиент', onClick: () => navigate("/home") },
          ].map(({ letter, label, onClick }) => (
            <button
              key={letter}
              onClick={onClick}
              className="flex items-center gap-4 bg-[#0f3460] border border-[#6c5ce7]/30 rounded-2xl px-5 py-3.5 w-full text-left cursor-pointer hover:bg-[#1a4a80] hover:border-[#6c5ce7] active:scale-[0.98] transition-all duration-150"
            >
              <div className="w-9 h-9 rounded-full bg-[#6c5ce7] text-white flex items-center justify-center text-sm font-medium shrink-0">
                {letter}
              </div>
              <span className="text-[#c8d0e0] text-sm">{label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}

export default Login