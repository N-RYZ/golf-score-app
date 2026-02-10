# ハンデキャップ・ポイント管理システム 導入ガイド

## 📋 概要

このシステムは、ゴルフコンペの年度ごとのハンデキャップ管理とポイントランキング機能を提供します。

### 主な機能
- ✅ プレイヤー（メンバー）管理
- ✅ 年度別ハンデキャップ管理（初期値・期中更新）
- ✅ イベントタイプ別ポイント計算（通常/メジャー/最終戦）
- ✅ 年間総合ランキング（ポイント制）
- ✅ ハンデキャップ自動更新（基本ルール + アンダーカット）
- ✅ 年度ごとのリセット・再定義

---

## 🚀 デプロイ手順

### 1. データベースマイグレーション

Supabaseダッシュボードの「SQL Editor」で以下のSQLファイルを順番に実行：

#### ① マイグレーション実行
```bash
migration_handicap_system.sql
```
- 新テーブル作成（players, player_season_stats, event_results, handicap_history）
- 既存テーブルへのカラム追加（events に year, event_type, is_finalized など）
- 既存データの移行準備

#### ② 初期データ投入
```bash
initial_data_players.sql
```
- 40名のプレイヤーデータ投入
- 2026年度の初期ハンデ設定
- 認証アカウント整理（admin / player の2つのみ）

### 2. コードデプロイ

```bash
# 変更をコミット
git add .
git commit -m "Add handicap and point management system"

# 両方のリモートにプッシュ
git push origin master
git push nagai master
```

`nagai`リモートへのpush後、Vercelで自動デプロイが開始されます。

---

## 📖 使用方法

### 管理者の操作

#### 1. プレイヤー管理（/admin/players）
- プレイヤーの新規登録・編集・削除
- 初期ハンデの設定
- 年度選択（2026, 2027...）

**新規プレイヤー登録時の入力項目：**
- 名前*（必須）
- 性別（男性/女性）
- 生年（西暦）
- 初期ハンデ*（必須）

#### 2. イベント確定（/events/[id]）
- イベント詳細画面で「イベント確定」ボタンをクリック
- 確定時の処理：
  1. 全参加者のグロススコアを集計
  2. ネットスコア（グロス - ハンデ）を計算
  3. ネットスコア順に順位付け
  4. 順位に応じてポイント付与
  5. 上位3位のハンデを更新（基本ルール + アンダーカット）
  6. 結果を保存（event_resultsテーブル）

**ポイント配分：**
| 順位 | 通常大会 | メジャー大会 | 最終戦 |
|------|----------|--------------|--------|
| 1位  | 16pt     | 21pt         | 26pt   |
| 2位  | 8pt      | 12pt         | 16pt   |
| 3位  | 4pt      | 7pt          | 10pt   |
| 4位  | 2pt      | 4pt          | 6pt    |
| 5位  | 1pt      | 2pt          | 3pt    |

**ハンデ更新ルール：**
- 1位: 現在ハンデ × 0.7（小数点以下切り捨て）
- 2位: 現在ハンデ × 0.8（小数点以下切り捨て）
- 3位: 現在ハンデ × 0.9（小数点以下切り捨て）
- アンダーカット: ネットスコアがパー未満の場合、アンダー分を差し引く
  - 例：HC30、グロス90、ネット60（-12）の場合
    - アンダーカット後: (30 - 12) × 0.7 = 12.6 → 12

#### 3. 結果確認（/events/[id]）
イベント確定後、「結果」タブで以下を確認：
- 順位
- グロススコア、ネットスコア
- 獲得ポイント
- ハンデ更新（更新前 → 更新後）

#### 4. 年間ランキング（/annual）
- ポイントランキングタブ：年間総合順位を表示
  - ソート順：ポイント総数 → 参加回数 → 初期ハンデ → 年齢
- 罰金累計タブ：従来通りの罰金表示

---

## 🔄 年度切り替え

### 新年度開始時の手順

1. **管理者がプレイヤー管理画面で年度を選択**
   - `/admin/players` で年度ドロップダウンから「2027年」などを選択

2. **新年度の初期ハンデを設定**
   - 各プレイヤーの編集画面で「2027年度 初期ハンデ」を入力
   - または、SQLで一括投入：

```sql
-- 2027年度の初期ハンデを一括設定（例）
INSERT INTO player_season_stats (player_id, year, initial_handicap, current_handicap)
SELECT
  id,
  2027,
  current_handicap, -- 前年度の最終ハンデを初期値にする場合
  current_handicap
FROM players
WHERE is_active = true
ON CONFLICT (player_id, year) DO NOTHING;
```

3. **イベント作成時に年度を指定**
   - 新規イベント作成時、yearカラムに2027を設定

---

## 📂 作成・変更されたファイル

### データベース
- `migration_handicap_system.sql` - マイグレーションSQL
- `initial_data_players.sql` - 初期データSQL（40名分）

### API
- `src/app/api/admin/players/route.ts` - プレイヤー一覧・新規登録
- `src/app/api/admin/players/[id]/route.ts` - プレイヤー詳細・編集・削除
- `src/app/api/events/[id]/finalize/route.ts` - イベント確定・結果取得
- `src/app/api/rankings/annual/route.ts` - 年間ポイントランキング

### 画面
- `src/app/(authenticated)/admin/players/page.tsx` - プレイヤー管理画面
- `src/app/(authenticated)/events/[id]/page.tsx` - イベント詳細画面（確定ボタン・結果タブ追加）
- `src/app/(authenticated)/annual/page.tsx` - 年間成績画面（ポイントランキング追加）

---

## 📊 データ構造

### 新テーブル

#### `players`
プレイヤー基本情報（年度を超えて変わらない情報）
```sql
- id: UUID
- name: VARCHAR(100) - プレイヤー名
- gender: VARCHAR(10) - 性別（male/female）
- birth_year: INTEGER - 生年
- is_active: BOOLEAN
```

#### `player_season_stats`
年度ごとのハンデ・ポイント情報
```sql
- id: UUID
- player_id: UUID
- year: INTEGER - 年度（2026, 2027...）
- initial_handicap: DECIMAL(4,1) - 年度初期ハンデ
- current_handicap: DECIMAL(4,1) - 現在のハンデ
- total_points: INTEGER - 年間累計ポイント
- participation_count: INTEGER - 参加回数
```

#### `event_results`
イベント確定後の結果
```sql
- id: UUID
- event_id: UUID
- player_id: UUID
- gross_score: INTEGER
- net_score: INTEGER
- rank: INTEGER
- points: INTEGER
- handicap_before: DECIMAL(4,1)
- handicap_after: DECIMAL(4,1)
- under_par_strokes: INTEGER
```

#### `handicap_history`
ハンデ変更履歴
```sql
- id: UUID
- player_id: UUID
- event_id: UUID
- year: INTEGER
- handicap_before: DECIMAL(4,1)
- handicap_after: DECIMAL(4,1)
- adjustment_reason: TEXT
```

### 既存テーブルへの追加カラム

#### `events`
```sql
- year: INTEGER - 年度
- event_type: VARCHAR(20) - イベントタイプ（regular/major/final）
- is_finalized: BOOLEAN - 確定済みフラグ
- finalized_at: TIMESTAMPTZ - 確定日時
- finalized_by: UUID - 確定実行者
```

---

## ⚠️ 注意事項

### 認証アカウントの変更
- 従来：各メンバーが個別のアカウントを持つ
- 新システム：認証用アカウントは2つのみ
  - `admin`（管理者用）
  - `player`（プレイヤー共用）

### ログイン情報
```
管理者: admin / golf1234
プレイヤー: player / golf1234
```

### データ移行について
- `migration_handicap_system.sql` 実行時、既存のusersテーブルのプレイヤーデータはplayersテーブルに移行されます
- 既存のscores、event_participantsなどのテーブルには`player_id`カラムが追加され、既存の`user_id`がコピーされます

---

## 🐛 トラブルシューティング

### イベント確定が失敗する
- 全参加者のスコアが18ホール入力済みか確認
- Supabaseのログでエラー詳細を確認

### ハンデが正しく更新されない
- イベントが確定済み（is_finalized=true）か確認
- `event_results`テーブルにデータが保存されているか確認
- `handicap_history`テーブルで履歴を確認

### ポイントランキングが表示されない
- `/api/rankings/annual?year=2026` にアクセスしてデータがあるか確認
- `player_season_stats`テーブルに該当年度のデータがあるか確認

---

## 📝 今後の拡張可能性

- [ ] ハンデ推移グラフ表示
- [ ] イベント結果のPDF出力
- [ ] プレイヤー個人の詳細統計ページ
- [ ] ハンデ手動調整機能（管理者のみ）
- [ ] 過去年度との比較表示

---

## 📞 サポート

問題が発生した場合は、以下を確認してください：
1. Supabaseダッシュボードのログ
2. ブラウザのコンソールログ
3. `MEMORY.md` のトラブルシューティング項目

---

作成日: 2026-02-10
バージョン: 1.0.0
