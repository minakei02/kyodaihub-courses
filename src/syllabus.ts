/**
 * 京大の公開シラバスの「すべての授業」一覧ページ（人がブラウザで保存したもの）から、
 * 部局・授業名・シラバスのページの場所（番号）だけを取り出す。説明文などの中身は取り込まない。
 * シラバスのサイトは robots.txt で自動取得を断っているので、このリポジトリからは取りに行かない。
 */

export const SYLLABUS_BASE_URL = 'https://www.k.kyoto-u.ac.jp/external/open_syllabus/';

export type SyllabusEntry = {
  /** courses.json の部局名にそろえたもの */
  department: string;
  name: string;
  /** SYLLABUS_BASE_URL からの相対パス。2つの形だけを受け付ける */
  path: string;
};

/** シラバスの見出しの部局名 → courses.json の部局名（違うものだけ） */
const DEPARTMENT_ALIASES: Record<string, string> = {
  '医学部(人間)': '医学部（人間健康科学科）',
};

const SYLLABUS_PATH = /^(?:la_syllabus\?lectureNo=\d+|department_syllabus\?lectureNo=\d+&departmentNo=\d+)$/;

export function isSyllabusPath(path: string): boolean {
  return SYLLABUS_PATH.test(path);
}

/** 保存したページの文字コード（meta の charset）を見て文字にする。京大のページは Shift_JIS */
export function decodeSavedPage(data: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(data.slice(0, 2048));
  const charset = head.match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? 'shift_jis';
  const label = ['utf-8', 'utf8'].includes(charset) ? 'utf-8' : 'shift_jis';
  return new TextDecoder(label).decode(data);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 「部局の見出し」と「授業のリンク」を上から順に読む。
 * リンクの前にある直近の見出しが、その授業の部局。
 */
export function parseSyllabusIndex(html: string): SyllabusEntry[] {
  const pattern =
    /<div class="departmentName">\s*([^<]+?)\s*<span|<a href="(?:[^"]*\/)?((?:la_syllabus|department_syllabus)\?[^"]+)"[^>]*>([^<]*)<\/a>/g;
  const entries: SyllabusEntry[] = [];
  let department = '';

  for (const match of html.matchAll(pattern)) {
    if (match[1]) {
      const heading = decodeEntities(match[1]).trim();
      department = DEPARTMENT_ALIASES[heading] ?? heading;
      continue;
    }
    const path = decodeEntities(match[2]);
    const name = decodeEntities(match[3]).trim();
    if (!department || !name || !isSyllabusPath(path)) continue;
    entries.push({ department, name, path });
  }
  return entries;
}
