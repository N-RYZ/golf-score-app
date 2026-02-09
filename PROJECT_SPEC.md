# ゴルフスコア管理アプリ - プロジェクト仕様書

## 技術構成
- **フロント**: Next.js (App Router) + TypeScript + Tailwind CSS
- **バックエンド/DB**: Supabase (PostgreSQL)
- **認証**: 簡易認証（名前+パスワード、bcryptjs）
- **ホスティング**: Vercel
- **環境変数**: `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定済み

---

## 概要
月例会など定期的なゴルフイベントで使用するスコア入力・集計Webアプリ。
20人程度の登録メンバーが利用し、ラウンド中にスマホからリアルタイムでスコアを入力する。

---

## ユーザーと権限

### ユーザー種別
| 種別 | 説明 |
|------|------|
| 幹事（admin） | イベント作成・コース設定・全員のスコア編集・CSV出力・メンバー管理 |
| 一般プレイヤー（player） | 自分と同組メンバーのスコア入力・閲覧のみ |

### 認証方式
- 簡易ログイン（名前＋パスワード）
- 新規プレイヤーの登録は幹事が行う（セルフサインアップなし）

---

## 主要機能

### メンバー管理（幹事のみ）
- プレイヤーの新規登録（名前・パスワード設定）
- プレイヤーの編集・削除
- 登録メンバー一覧の表示

### コース管理（幹事のみ）
- コースの新規登録（コース名・18ホール各パー）
- 登録済みコースの再利用（マスタ管理）
- コースの編集・削除

### イベント管理（幹事のみ）
- イベントの新規作成（日付・コース選択）
- 参加者の選択（登録メンバーの中から選ぶ、毎回入れ替わる）
- 組み合わせ（ペアリング）の手動設定（組番号・スタート時間・メンバー割り当て）
- イベント一覧・過去履歴の閲覧
- イベントの編集・削除

### スコア入力（プレイヤー）
- 各自が自分のスコアを入力
- 同組メンバーであれば他のメンバーのスコアも入力可能
- ホールごとに「ストローク数」「パット数」の2項目を入力（＋/−ボタン）
- 画面構成は最小限：メンバー選択、打数、パット、ホール番号＋PARのみ
- 合計スコア表示・確定ボタン・確認ダイアログは設けない
- 保存タイミング：メンバータブ切替時、ホール移動（◀▶）時に自動保存
- 電波が悪い場合はスマホ内に一時保存し、電波復帰時に自動同期
- アプリ再開時は最後に入力していたホール・プレイヤーの画面に自動復帰

### スコア修正ルール
| 条件 | 修正可否 |
|------|----------|
| イベント当日 18:00 まで | 本人または同組メンバーが修正可 |
| イベント当日 18:00 以降 | 幹事のみ修正可 |

### 罰金管理
#### 罰金ルール（固定）
| 条件 | 金額 |
|------|------|
| 3パット以上 | （パット数 − 2）× 100円 ※3パット以上の場合のみ |
| パー3で1オン失敗 | 100円 ※ストローク数2以上の場合 |

- スコア入力データから罰金を自動計算
- イベントごとに各プレイヤーの罰金合計金額を表示（ホール内訳は不要）
- 年間の罰金累計を表示
- CSV出力に罰金合計を含める

### 結果閲覧
- イベント詳細画面で全員のスコア一覧を表示（各ホールのストローク数・パット数、OUT/IN/合計）
- 過去イベントの結果も閲覧可能

### 年間成績
- 年間通算のランキング・集計表示
- 対象期間内のイベント横断での成績比較

### CSV出力（幹事のみ）
#### イベント単位のCSV
- イベント日付・コース名
- プレイヤー名
- 1H〜18H ストローク数
- 1H〜18H パット数
- OUT / IN / 合計
- 罰金合計
- ※順位列は含めない

#### 全イベント一括CSV
- 年間分など複数イベントをまとめて出力

---

## 画面一覧

| # | 画面・パス | 対象 | 主な機能 |
|---|-----------|------|----------|
| 1 | `/` ログイン | 共通 | 名前＋パスワードで認証。フッターなし |
| 2 | `/home` ホーム | 共通 | 直近イベント・自分の成績サマリー。幹事のみ右上にハンバーガーメニューで管理画面へ |
| 3 | `/events` イベント一覧 | 共通 | ステータスフィルタ付き一覧 |
| 4 | `/events/[id]` イベント詳細 | 共通 | スコア一覧・組み合わせ・罰金タブ切替 |
| 5 | `/events/[id]/score` スコア入力 | プレイヤー | ホールごとのストローク・パット入力。フッターは下スクロール時のみ表示 |
| 6 | `/annual` 年間成績 | 共通 | 通算ランキング・罰金累計 |
| 7 | `/admin/members` メンバー管理 | 幹事 | プレイヤーの登録・編集・削除 |
| 8 | `/admin/courses` コース管理 | 幹事 | コースの登録・編集・削除 |
| 9 | `/admin/events/new` イベント作成 | 幹事 | イベント設定・参加者・組み合わせ |
| 10 | `/admin/csv` CSV出力 | 幹事 | イベント単位 / 一括出力 |

### フッターナビゲーション
- 背景：緑（#166534）、白抜きSVGアイコンのみ（テキストなし）
- 3アイコン：ホーム（家）、イベント（カレンダー）、成績（グラフ）
- 管理メニューはフッターに含めない。スマホではホーム画面右上のハンバーガーアイコン（幹事のみ表示）からアクセス
- スコア入力画面ではフッター通常非表示。下スクロール時にスライド表示し、数秒後に自動非表示

### スコア入力画面のUI設計（最重要画面）
- **設計思想**: カートのナビでもスコア確認できるため、このアプリではスコア入力をいかに正確でシンプルにできるかを追求する
- **スマホ最適化**: 手袋着用・老眼でも操作可能な大きなボタン・文字
- **レイアウト**（上から順に）:
  1. メンバー選択: 2行×2列のグリッド。横幅いっぱいに均等配置。フォント22px太字。選択中は緑背景白文字
  2. 打数エリア: 薄緑背景。「打数」ラベル + −/数字/+ ボタン。数字64px、＋−は62pxで円形64pxボタン内に配置。パーとの差分（ボギー等）を赤字で表示
  3. パットエリア: 薄グレー背景。「パット」ラベル + −/数字/+ ボタン。同様のサイズ感
  4. ホール番号: 画面最下部。◀（56×56px角丸ボタン）、ホール番号（56px太字）＋PAR表示、▶
- **レスポンシブ**: 画面幅・高さに応じてボタンサイズ・フォントサイズを自動調整。スクロールなしで全要素が画面内に収まる。縦向き専用

---

## DB設計（Supabase PostgreSQL、テーブル作成済み）

### users
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| name | VARCHAR(50) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL |
| role | VARCHAR(10) | NOT NULL, DEFAULT 'player', CHECK ('admin','player') |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### courses
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL, UNIQUE |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### course_holes
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| course_id | UUID | FK → courses.id, CASCADE |
| hole_number | SMALLINT | CHECK(1-18) |
| par | SMALLINT | CHECK(3-5) |
| created_at | TIMESTAMPTZ | DEFAULT now() |
UNIQUE: (course_id, hole_number)

### events
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| event_date | DATE | NOT NULL |
| course_id | UUID | FK → courses.id |
| score_edit_deadline | TIME | DEFAULT '18:00' |
| status | VARCHAR(20) | DEFAULT 'upcoming', CHECK ('upcoming','in_progress','completed') |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### event_participants
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| event_id | UUID | FK → events.id, CASCADE |
| user_id | UUID | FK → users.id, CASCADE |
| created_at | TIMESTAMPTZ | DEFAULT now() |
UNIQUE: (event_id, user_id)

### event_groups
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| event_id | UUID | FK → events.id, CASCADE |
| group_number | SMALLINT | NOT NULL |
| start_time | TIME | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
UNIQUE: (event_id, group_number)

### group_members
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| group_id | UUID | FK → event_groups.id, CASCADE |
| user_id | UUID | FK → users.id, CASCADE |
| created_at | TIMESTAMPTZ | DEFAULT now() |
UNIQUE: (group_id, user_id)

### scores
| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| event_id | UUID | FK → events.id, CASCADE |
| user_id | UUID | FK → users.id, CASCADE |
| hole_number | SMALLINT | CHECK(1-18) |
| strokes | SMALLINT | CHECK(>=1) |
| putts | SMALLINT | CHECK(>=0) |
| updated_by | UUID | FK → users.id, NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
UNIQUE: (event_id, user_id, hole_number)

### 罰金計算（DBに保存せず都度計算）
```sql
SELECT
  s.user_id,
  COALESCE(SUM(CASE WHEN s.putts >= 3 THEN (s.putts - 2) * 100 ELSE 0 END), 0)
  + COALESCE(SUM(CASE WHEN ch.par = 3 AND s.strokes >= 2 THEN 100 ELSE 0 END), 0)
  AS total_penalty
FROM scores s
JOIN events e ON e.id = s.event_id
JOIN course_holes ch ON ch.course_id = e.course_id AND ch.hole_number = s.hole_number
WHERE s.event_id = :event_id
GROUP BY s.user_id;
```

### 権限制御
| 操作 | 幹事 | 同組メンバー | 本人 | 条件 |
|------|:----:|:----------:|:----:|------|
| スコア入力 | ✅ | ✅ | ✅ | - |
| スコア修正 | ✅ | ✅ | ✅ | 当日 18:00 まで |
| スコア修正 | ✅ | ❌ | ❌ | 当日 18:00 以降 |
| イベント作成・編集 | ✅ | ❌ | ❌ | - |
| メンバー管理 | ✅ | ❌ | ❌ | - |
| コース管理 | ✅ | ❌ | ❌ | - |
| CSV出力 | ✅ | ❌ | ❌ | - |
| 結果閲覧 | ✅ | ✅ | ✅ | - |

---

## Supabaseクライアント設定

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 実装フェーズ

### Phase 1: 認証・基盤
- Supabaseクライアント設定
- 簡易認証（名前+パスワード、bcryptjs）
- AuthContext（ログイン状態管理、sessionStorage）
- ログインAPI（/api/auth/login）
- ログイン画面
- 共通レイアウト（フッターナビ）

### Phase 2: 管理画面
- メンバー管理（CRUD）
- メンバー登録時のパスワードハッシュ化API
- コース管理（CRUD + 18ホールパー設定）

### Phase 3: イベント管理
- イベント作成（日付・コース選択・参加者選択・組み合わせ設定）
- イベント一覧（ステータスフィルタ）
- イベント詳細（スコア一覧・組み合わせ・罰金タブ）

### Phase 4: スコア入力
- スコア入力画面（最重要、上記UI設計に従う）
- 同組メンバーの判定と入力権限
- オートセーブ（メンバー切替時・ホール移動時）
- オフライン対応（一時保存→自動同期）
- 自動復帰（最後のホール・プレイヤー）

### Phase 5: 結果・集計
- イベント結果閲覧
- 罰金自動計算・表示
- 年間成績ランキング
- 年間罰金累計

### Phase 6: CSV出力・仕上げ
- イベント単位CSV出力
- 期間一括CSV出力
- レスポンシブ調整
- デプロイ（Vercel）