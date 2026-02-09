import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// CSV生成ヘルパー: BOM付きUTF-8
function buildCsv(rows: string[][]): string {
  const bom = '\uFEFF';
  return bom + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

// イベント1件分のCSVデータ生成
async function buildEventCsv(eventId: string) {
  // イベント情報
  const { data: event } = await supabase
    .from('events')
    .select(`
      id, name, event_date,
      courses ( name, course_holes ( hole_number, par ) )
    `)
    .eq('id', eventId)
    .single();

  if (!event) return null;

  // 参加者
  const { data: participants } = await supabase
    .from('event_participants')
    .select('user_id, users ( name )')
    .eq('event_id', eventId);

  // スコア
  const { data: scores } = await supabase
    .from('scores')
    .select('user_id, hole_number, strokes, putts')
    .eq('event_id', eventId);

  const course = event.courses as unknown as { name: string; course_holes: { hole_number: number; par: number }[] } | null;
  const holes = course?.course_holes?.sort((a, b) => a.hole_number - b.hole_number) || [];

  const rows: string[][] = [];

  // ヘッダー行1: イベント情報
  rows.push(['イベント', event.name, '日付', event.event_date, 'コース', course?.name || '']);

  // ヘッダー行2: カラムヘッダー
  const header = ['プレイヤー'];
  for (let i = 1; i <= 18; i++) header.push(`${i}H打`);
  header.push('OUT', 'IN', '合計');
  for (let i = 1; i <= 18; i++) header.push(`${i}Hパット`);
  header.push('パットOUT', 'パットIN', 'パット計', '罰金');
  rows.push(header);

  // PAR行
  const parRow = ['PAR'];
  for (const h of holes) parRow.push(String(h.par));
  if (holes.length < 18) for (let i = holes.length; i < 18; i++) parRow.push('');
  const outPar = holes.filter((h) => h.hole_number <= 9).reduce((s, h) => s + h.par, 0);
  const inPar = holes.filter((h) => h.hole_number > 9).reduce((s, h) => s + h.par, 0);
  parRow.push(String(outPar), String(inPar), String(outPar + inPar));
  for (let i = 0; i < 18; i++) parRow.push('');
  parRow.push('', '', '', '');
  rows.push(parRow);

  // プレイヤーごとのデータ行
  for (const p of (participants || [])) {
    const user = p.users as unknown as { name: string };
    const row = [user.name];

    const playerScores = (scores || []).filter((s) => s.user_id === p.user_id);
    let outStrokes = 0, inStrokes = 0, outPutts = 0, inPutts = 0;
    let penalty = 0;

    // 打数
    for (let i = 1; i <= 18; i++) {
      const s = playerScores.find((sc) => sc.hole_number === i);
      const strokes = s?.strokes || 0;
      row.push(strokes > 0 ? String(strokes) : '');
      if (i <= 9) outStrokes += strokes;
      else inStrokes += strokes;
    }
    row.push(String(outStrokes || ''), String(inStrokes || ''), String((outStrokes + inStrokes) || ''));

    // パット
    for (let i = 1; i <= 18; i++) {
      const s = playerScores.find((sc) => sc.hole_number === i);
      const putts = s?.putts || 0;
      row.push(putts > 0 ? String(putts) : '');
      if (i <= 9) outPutts += putts;
      else inPutts += putts;
    }
    row.push(String(outPutts || ''), String(inPutts || ''), String((outPutts + inPutts) || ''));

    // 罰金計算
    for (const s of playerScores) {
      if (s.putts >= 3) penalty += (s.putts - 2) * 100;
      const hole = holes.find((h) => h.hole_number === s.hole_number);
      if (hole && hole.par === 3 && s.strokes >= 2) penalty += 100;
    }
    row.push(String(penalty));

    rows.push(row);
  }

  return { csv: buildCsv(rows), eventName: event.name, eventDate: event.event_date };
}

// GET: イベント単位 or 期間一括CSV
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  const startDate = req.nextUrl.searchParams.get('start_date');
  const endDate = req.nextUrl.searchParams.get('end_date');

  // イベント単位
  if (eventId) {
    const result = await buildEventCsv(eventId);
    if (!result) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    return new NextResponse(result.csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.eventDate}_${result.eventName}.csv"`,
      },
    });
  }

  // 期間一括
  if (startDate && endDate) {
    const { data: events } = await supabase
      .from('events')
      .select('id, name, event_date')
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date');

    if (!events || events.length === 0) {
      return NextResponse.json({ error: '該当期間のイベントがありません' }, { status: 404 });
    }

    // 全イベントのCSVを連結
    const allRows: string[][] = [];
    for (const event of events) {
      const result = await buildEventCsv(event.id);
      if (result) {
        // BOMを除去してパース
        const csvContent = result.csv.replace('\uFEFF', '');
        const rows = csvContent.split('\r\n').map((line) =>
          line.split(',').map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"'))
        );
        allRows.push(...rows);
        allRows.push([]); // 空行で区切り
      }
    }

    const csv = buildCsv(allRows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${startDate}_${endDate}_全イベント.csv"`,
      },
    });
  }

  return NextResponse.json({ error: 'event_id または start_date/end_date を指定してください' }, { status: 400 });
}
