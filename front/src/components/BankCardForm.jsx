import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

/** Определение платёжной системы по BIN */
export function detectCardType(num) {
  const clean = (num || '').replace(/\s/g, '');
  if (/^8600/.test(clean)) return { name: 'Uzcard', color: '#16a34a', gradient: 'linear-gradient(135deg,#15803d,#22c55e)' };
  if (/^9860/.test(clean)) return { name: 'Humo', color: '#0284c7', gradient: 'linear-gradient(135deg,#0369a1,#38bdf8)' };
  if (/^4/.test(clean)) return { name: 'Visa', color: '#1d4ed8', gradient: 'linear-gradient(135deg,#1e3a8a,#3b82f6)' };
  if (/^5[1-5]/.test(clean)) return { name: 'Mastercard', color: '#ea580c', gradient: 'linear-gradient(135deg,#c2410c,#f97316)' };
  return { name: 'Card', color: '#a67c2d', gradient: 'linear-gradient(135deg,#8a6520,#c9a84c)' };
}

const formatCard = (v) =>
  v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

/**
 * Красивая банковская карта + поля ввода
 *
 * props:
 *  - value: { number, name, expiry, cvv }
 *  - onChange: (next) => void
 *  - receiverCard?: string  — карта получателя (показать + копировать)
 *  - amount?: number
 */
export default function BankCardForm({ value, onChange, receiverCard, amount }) {
  const [flipped, setFlipped] = useState(false);
  const card = value || { number: '', name: '', expiry: '', cvv: '' };
  const type = useMemo(() => detectCardType(card.number), [card.number]);

  const set = (key, val) => onChange?.({ ...card, [key]: val });

  const displayNum = card.number
    ? formatCard(card.number.padEnd(16, '•'))
    : '•••• •••• •••• ••••';

  const copyReceiver = () => {
    if (!receiverCard) return;
    navigator.clipboard?.writeText(receiverCard.replace(/\s/g, ''));
  };

  return (
    <div className="space-y-5">
      {/* Visual card */}
      <div
        className="relative mx-auto w-full max-w-sm h-52 cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={() => setFlipped(f => !f)}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 rounded-2xl shadow-xl"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl p-5 flex flex-col justify-between overflow-hidden"
            style={{
              background: type.gradient,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -left-10 bottom-0 w-32 h-32 rounded-full bg-black/10" />

            <div className="flex justify-between items-start relative z-10">
              <div className="w-10 h-7 rounded bg-gradient-to-br from-yellow-200 to-yellow-500 opacity-90" />
              <span className="text-white/90 text-sm font-bold tracking-wide">{type.name}</span>
            </div>

            <div className="relative z-10 font-mono text-white text-lg sm:text-xl tracking-widest drop-shadow">
              {displayNum}
            </div>

            <div className="flex justify-between items-end relative z-10">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/60 mb-0.5">Cardholder</div>
                <div className="text-white text-sm font-semibold uppercase tracking-wide truncate max-w-[160px]">
                  {card.name || 'YOUR NAME'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-widest text-white/60 mb-0.5">Expires</div>
                <div className="text-white text-sm font-semibold">{card.expiry || 'MM/YY'}</div>
              </div>
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              background: type.gradient,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="h-10 bg-black/50 mt-5" />
            <div className="px-5 mt-4">
              <div className="text-[9px] uppercase tracking-widest text-white/60 mb-1">CVV</div>
              <div className="h-9 rounded bg-white/90 flex items-center justify-end px-3 font-mono text-sm text-gray-800">
                {card.cvv ? '•'.repeat(card.cvv.length) : '•••'}
              </div>
              <p className="text-[10px] text-white/50 mt-3">Нажмите карту, чтобы перевернуть</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Receiver card hint */}
      {receiverCard && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-xs"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#6d28d9' }}>
          <span>💳 Карта получателя: <strong>{formatCard(receiverCard)}</strong></span>
          <button type="button" onClick={copyReceiver} className="font-bold flex-shrink-0">📋 Копировать</button>
        </div>
      )}

      {amount != null && (
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text2)' }}>К оплате</div>
          <div className="text-3xl font-black" style={{ color: 'var(--gold)' }}>${amount}</div>
        </div>
      )}

      {/* Inputs */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
            Номер карты
          </label>
          <input
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="8600 1234 5678 9012"
            value={formatCard(card.number)}
            onChange={e => set('number', e.target.value.replace(/\D/g, '').slice(0, 16))}
            onFocus={() => setFlipped(false)}
            className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          {card.number.length >= 4 && (
            <div className="mt-1 text-[11px] font-semibold" style={{ color: type.color }}>{type.name}</div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
            Имя на карте
          </label>
          <input
            autoComplete="cc-name"
            placeholder="IVAN IVANOV"
            value={card.name}
            onChange={e => set('name', e.target.value.toUpperCase())}
            onFocus={() => setFlipped(false)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none uppercase"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
              Срок (MM/YY)
            </label>
            <input
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="12/28"
              value={card.expiry}
              onChange={e => {
                let v = e.target.value.replace(/[^\d]/g, '').slice(0, 5);
                if (v.length >= 3 && !v.includes('/')) v = v.slice(0, 2) + '/' + v.slice(2);
                set('expiry', v);
              }}
              onFocus={() => setFlipped(false)}
              className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
              CVV
            </label>
            <input
              inputMode="numeric"
              autoComplete="cc-csc"
              type="password"
              placeholder="•••"
              maxLength={4}
              value={card.cvv}
              onChange={e => set('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
              onFocus={() => setFlipped(true)}
              onBlur={() => setFlipped(false)}
              className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Валидация перед оплатой */
export function isCardValid(card) {
  if (!card) return false;
  const num = (card.number || '').replace(/\s/g, '');
  if (num.length < 16) return false;
  if (!(card.name || '').trim()) return false;
  if (!/^\d{2}\/\d{2}$/.test(card.expiry || '')) return false;
  if ((card.cvv || '').length < 3) return false;
  return true;
}
