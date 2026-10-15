/**
 * PDF の1ページぶんの文字（位置つき）から、表の行を取り出す。
 * PDF の表は「部局名 | 授業科目名 | 履修登録者数（合計・平均）| 単位修得者数（合計・平均）| 授業数」で、
 * 列の横位置は年度が変わってもほぼ同じなので、位置で列を見分ける。
 */

export type TextItem = { str: string; x: number; y: number };

export type Row = {
  department: string;
  name: string;
  registered: number;
  earned: number;
  classes: number;
};

/** これより左は部局名の列 */
const NAME_COLUMN_X = 165;
/** これより右の数字だけの文字は、数の列 */
const NUMBER_COLUMN_X = 380;
/** 同じ行とみなす縦位置のずれ */
const SAME_LINE_TOLERANCE = 2;

/** 「( 2025年度）」から年度を読む */
export function findYear(items: TextItem[]): number | null {
  for (const item of items) {
    const match = item.str.match(/(\d{4})\s*年度/);
    if (match) return Number(match[1]);
  }
  return null;
}

function groupLines(items: TextItem[]): TextItem[][] {
  const sorted = items
    .filter((item) => item.str.trim() !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].y - item.y) <= SAME_LINE_TOLERANCE) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
}

/**
 * 欄からあふれて2つに分かれた名前をつなぐ。
 * 英数字どうしの境目だけ空白を入れる（「Urban and」+「Regional Planning」）。日本語はそのまま（「演」+「習」）。
 */
export function joinParts(parts: string[]): string {
  let result = '';
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const needsSpace = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ)）]$/.test(result) && /^[0-9A-Za-z０-９Ａ-Ｚａ-ｚ(（]/.test(part);
    result = result ? `${result}${needsSpace ? ' ' : ''}${part}` : part;
  }
  return result;
}

export type ParseResult = { rows: Row[]; skipped: string[] };

/**
 * 表の行を取り出す。数が5つそろわない行は、見出しなどとして skipped に入れる
 * （取りこぼしがないか、人が確かめられるように）。
 */
export function parsePage(items: TextItem[]): ParseResult {
  const rows: Row[] = [];
  const skipped: string[] = [];

  for (const line of groupLines(items)) {
    const numbers = line.filter((item) => item.x >= NUMBER_COLUMN_X && /^\d+$/.test(item.str.trim()));
    const texts = line.filter((item) => !numbers.includes(item));
    const departmentParts = texts.filter((item) => item.x < NAME_COLUMN_X).map((item) => item.str);
    const nameParts = texts.filter((item) => item.x >= NAME_COLUMN_X).map((item) => item.str);

    if (numbers.length !== 5 || departmentParts.length === 0) {
      const text = line.map((item) => item.str.trim()).join(' | ');
      if (!isHeaderLine(text)) skipped.push(text);
      continue;
    }

    // 数の並びは「登録者 合計・平均、修得者 合計・平均、授業数」。平均は使わない
    const [registered, , earned, , classes] = numbers.map((item) => Number(item.str.trim()));
    // 部局名の列に名前の頭がはみ出している行（「医学部 | Ｂ13 | 社会・環境・予防医学」）
    const [department, ...nameHead] = departmentParts;
    rows.push({
      department: department.trim(),
      name: joinParts([...nameHead, ...nameParts]),
      registered,
      earned,
      classes,
    });
  }

  return { rows, skipped };
}

function isHeaderLine(text: string): boolean {
  return /各授業の平均|年度）|注）|なる科目|り扱い|開講学部|履修登録者数|単位(取得|修得)者数|^合計|^平均/.test(text);
}
