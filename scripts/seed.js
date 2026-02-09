// 初期データ投入スクリプト
// 実行方法: node scripts/seed.js

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// 環境変数から読み込み（または直接指定）
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('環境変数が設定されていません。.env.local を確認してください。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('初期データ投入を開始します...\n');

  try {
    // 1. ユーザー作成
    console.log('1. ユーザーを作成中...');
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    const users = [
      { name: '永井良蔵', password_hash: passwordHash, role: 'admin' },
      { name: '田中太郎', password_hash: passwordHash, role: 'player' },
      { name: '佐藤花子', password_hash: passwordHash, role: 'player' },
      { name: '鈴木一郎', password_hash: passwordHash, role: 'player' },
    ];

    const createdUsers = [];
    for (const user of users) {
      const { data, error } = await supabase
        .from('users')
        .upsert(user, { onConflict: 'name' })
        .select()
        .single();

      if (error) {
        console.error(`  ✗ ${user.name} の作成に失敗:`, error.message);
      } else {
        console.log(`  ✓ ${user.name} (${user.role})`);
        createdUsers.push(data);
      }
    }

    // 2. コース作成
    console.log('\n2. コースを作成中...');
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .upsert({ name: 'テストゴルフクラブ' }, { onConflict: 'name' })
      .select()
      .single();

    if (courseError) {
      console.error('  ✗ コースの作成に失敗:', courseError.message);
      return;
    }
    console.log(`  ✓ ${course.name}`);

    // 3. ホール情報作成
    console.log('\n3. ホール情報を作成中...');
    const holes = [];
    for (let i = 1; i <= 18; i++) {
      let par;
      if ([3, 6, 12, 15].includes(i)) par = 3; // ショート
      else if ([5, 9, 13, 18].includes(i)) par = 5; // ロング
      else par = 4; // ミドル

      holes.push({
        course_id: course.id,
        hole_number: i,
        par: par,
      });
    }

    const { error: holesError } = await supabase
      .from('course_holes')
      .upsert(holes, { onConflict: 'course_id,hole_number' });

    if (holesError) {
      console.error('  ✗ ホール情報の作成に失敗:', holesError.message);
    } else {
      console.log(`  ✓ 18ホール (OUT: ${holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0)}, IN: ${holes.slice(9).reduce((sum, h) => sum + h.par, 0)})`);
    }

    // 4. イベント作成
    console.log('\n4. イベントを作成中...');
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        name: '2026年2月例会',
        event_date: new Date().toISOString().split('T')[0],
        course_id: course.id,
        status: 'in_progress',
      })
      .select()
      .single();

    if (eventError) {
      console.error('  ✗ イベントの作成に失敗:', eventError.message);
      return;
    }
    console.log(`  ✓ ${event.name}`);

    // 5. イベント参加者追加
    console.log('\n5. イベント参加者を追加中...');
    const participants = createdUsers.map(user => ({
      event_id: event.id,
      user_id: user.id,
    }));

    const { error: participantsError } = await supabase
      .from('event_participants')
      .insert(participants);

    if (participantsError) {
      console.error('  ✗ 参加者の追加に失敗:', participantsError.message);
    } else {
      console.log(`  ✓ ${participants.length}名の参加者を追加`);
    }

    // 6. 組み合わせ作成
    console.log('\n6. 組み合わせを作成中...');
    const { data: group, error: groupError } = await supabase
      .from('event_groups')
      .insert({
        event_id: event.id,
        group_number: 1,
        start_time: '09:00',
      })
      .select()
      .single();

    if (groupError) {
      console.error('  ✗ 組の作成に失敗:', groupError.message);
      return;
    }
    console.log(`  ✓ 第1組 (09:00スタート)`);

    // 7. 組メンバー追加
    console.log('\n7. 組メンバーを追加中...');
    const groupMembers = createdUsers.map(user => ({
      group_id: group.id,
      user_id: user.id,
    }));

    const { error: groupMembersError } = await supabase
      .from('group_members')
      .insert(groupMembers);

    if (groupMembersError) {
      console.error('  ✗ 組メンバーの追加に失敗:', groupMembersError.message);
    } else {
      console.log(`  ✓ ${groupMembers.length}名のメンバーを追加`);
    }

    console.log('\n✅ 初期データ投入が完了しました！');
    console.log('\nログイン情報:');
    console.log('  名前: 永井良蔵');
    console.log('  パスワード: password123');
    console.log('\nブラウザで http://localhost:3000 にアクセスしてログインしてください。');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

seed();
