'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    // 次の入力欄にフォーカス
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // 4桁揃ったら自動送信
    if (value && index === 3) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (pinCode?: string) => {
    const code = pinCode || pin.join('');
    if (code.length !== 4) {
      setError('4桁のPINを入力してください');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const success = await login(code);
      if (success) {
        router.push('/events');
      } else {
        setError('PINが正しくありません');
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(`接続エラー: ${err}`);
    }

    setIsLoading(false);
  };

  return (
    <div className="h-dvh flex flex-col" style={{ backgroundColor: '#0E1A18' }}>
      {/* 画像エリア */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/isprime.jpg"
          alt="isPrime Golf"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: '42%',
            background: 'linear-gradient(to top, #0E1A18 12%, rgba(14,26,24,.7) 55%, transparent)',
          }}
        />
      </div>

      {/* PINエリア */}
      <div className="shrink-0" style={{ padding: '26px 26px 44px' }}>
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-center text-sm font-bold"
            style={{ backgroundColor: '#2A1E1A', color: '#D98E6E', border: '1px solid #7A3B26' }}
          >
            {error}
          </div>
        )}

        <label
          className="block text-center mb-4"
          style={{ fontSize: '17px', fontWeight: 700, color: '#8FA69C' }}
        >
          PINコードを入力
        </label>

        <div className="flex justify-center gap-3">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              autoFocus={index === 0}
              className="font-num text-center focus:outline-none disabled:opacity-50"
              style={{
                width: '64px',
                height: '74px',
                borderRadius: '18px',
                fontSize: '36px',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: digit ? '#1F4A3F' : '#182D28',
                border: digit ? '2px solid #6BAF8E' : '1.5px solid #2E4A43',
              }}
            />
          ))}
        </div>

        {isLoading && (
          <p className="text-center text-sm mt-4" style={{ color: '#8FA69C' }}>認証中...</p>
        )}
      </div>
    </div>
  );
}
