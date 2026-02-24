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
    <div className="min-h-screen flex flex-col bg-[#1d3937]">
      {/* 画像エリア（元の横幅・縦横比を保持） */}
      <div className="relative w-full shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/isprime.jpg"
          alt="isPrime Golf"
          className="w-full h-auto block"
        />
        {/* 上部：青グラデーション */}
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-blue-900/60 to-transparent pointer-events-none" />
        {/* 下部：黒グラデーション */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1d3937] to-transparent pointer-events-none" />
      </div>

      {/* PINエリア */}
      <div className="px-8 pb-14 pt-4 space-y-5">
        {error && (
          <div className="bg-red-900/60 border border-red-400 text-white px-4 py-3 rounded text-center text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/80 text-center mb-4">
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
                className="w-16 h-16 text-center text-3xl font-bold border-2 border-white/50 rounded-lg bg-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50 backdrop-blur-sm"
                autoFocus={index === 0}
              />
            ))}
          </div>
        </div>

        {isLoading && (
          <p className="text-center text-sm text-white/70">認証中...</p>
        )}
      </div>
    </div>
  );
}
