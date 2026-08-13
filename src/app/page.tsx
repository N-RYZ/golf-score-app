'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function LoginPage() {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (pinCode: string) => {
    setError('');
    setIsLoading(true);

    try {
      const success = await login(pinCode);
      if (success) {
        router.push('/events');
      } else {
        setError('PINが正しくありません');
        setPin(['', '', '', '']);
      }
    } catch (err) {
      setError(`接続エラー: ${err}`);
    }

    setIsLoading(false);
  };

  const handleDigit = (digit: string) => {
    if (isLoading) return;
    const filledCount = pin.filter((d) => d !== '').length;
    if (filledCount >= 4) return;

    const newPin = [...pin];
    newPin[filledCount] = digit;
    setPin(newPin);
    setError('');

    if (filledCount === 3) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleBackspace = () => {
    if (isLoading) return;
    const filledCount = pin.filter((d) => d !== '').length;
    if (filledCount === 0) return;
    const newPin = [...pin];
    newPin[filledCount - 1] = '';
    setPin(newPin);
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

        <div className="flex justify-center gap-3 mb-6">
          {pin.map((digit, index) => (
            <div
              key={index}
              className="font-num flex items-center justify-center"
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
            >
              {digit}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-[10px]">
          {KEYPAD_KEYS.map((key, i) => {
            if (key === '') {
              return <div key={i} />;
            }
            if (key === '⌫') {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={handleBackspace}
                  disabled={isLoading}
                  className="flex items-center justify-center active:opacity-70 disabled:opacity-40"
                  style={{ height: '56px', borderRadius: '16px', backgroundColor: '#182D28' }}
                >
                  <span className="font-num" style={{ fontSize: '22px', fontWeight: 700, color: '#8FA69C' }}>⌫</span>
                </button>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDigit(key)}
                disabled={isLoading}
                className="font-num flex items-center justify-center active:opacity-70 disabled:opacity-40"
                style={{ height: '56px', borderRadius: '16px', backgroundColor: '#182D28', fontSize: '26px', fontWeight: 700, color: '#ffffff' }}
              >
                {key}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <p className="text-center text-sm mt-4" style={{ color: '#8FA69C' }}>認証中...</p>
        )}
      </div>
    </div>
  );
}
