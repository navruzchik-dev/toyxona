import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const Terms = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen text-white pt-24 pb-16 px-6 sm:px-12 lg:px-32" style={{ background: 'var(--bg)' }}>
      <button
        onClick={() => navigate('/login')}
        className="inline-flex items-center gap-2 mb-10 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        <ArrowLeft size={16} />
        Назад ко входу
      </button>

      <div className="flex flex-col gap-8 max-w-3xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black mb-2" style={{ color: 'var(--text)' }}>
            Условия использования платформы
          </h1>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            Пожалуйста, ознакомьтесь с условиями перед бронированием зала, артиста или кортежа.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
          <p>
            1. Бронирование считается подтверждённым только после одобрения площадкой или
            исполнителем в личном кабинете партнёра.
          </p>
          <p>
            2. Отмена бронирования возможна в любой момент до подтверждения без штрафов. После
            подтверждения условия отмены обсуждаются напрямую с исполнителем.
          </p>
          <p>
            3. Смена зала или артиста в уже созданной брони возможна не позднее чем за 5 дней
            до даты тоя. После этого срока изменение недоступно.
          </p>
          <p>
            4. Оплата производится через платформу (картой или наличными при встрече) —
            в зависимости от выбранного способа оплаты и договорённости с партнёром.
          </p>
          <p>
            5. Платформа не несёт ответственности за качество услуг третьих лиц (декор, кортеж),
            но содействует в разрешении спорных ситуаций.
          </p>
        </div>

        <label className="inline-flex items-center gap-3 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
          <input type="checkbox" className="w-4 h-4" style={{ accentColor: 'var(--gold)' }} />
          Я прочитал(а) и согласен(на) с условиями использования
        </label>
      </div>
    </div>
  )
}

export default Terms