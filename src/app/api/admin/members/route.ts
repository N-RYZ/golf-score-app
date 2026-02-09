import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// メンバー一覧取得
export async function GET() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// メンバー新規登録
export async function POST(req: NextRequest) {
  try {
    const { name, password, role } = await req.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: '名前とパスワードは必須です' },
        { status: 400 }
      );
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert({ name, password_hash, role: role || 'player' })
      .select('id, name, role, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'この名前は既に登録されています' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
