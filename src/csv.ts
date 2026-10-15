/** 最小限の CSV の読み書き（値にカンマ・ダブルクォート・改行があればクォートする） */

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n') + '\n';
}

/** 1行目を見出しとして、各行を { 見出し: 値 } にする。# で始まる行と空行は飛ばす */
export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    records.push(row);
  }

  const meaningful = records.filter(
    (record) => !(record.length === 1 && record[0].trim() === '') && !record[0].startsWith('#'),
  );
  const [header, ...body] = meaningful;
  if (!header) return [];
  return body.map((record) =>
    Object.fromEntries(header.map((key, index) => [key.trim(), (record[index] ?? '').trim()])),
  );
}
