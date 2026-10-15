import { displayDepartment, isTargetDepartment } from './config.ts';
import { courseId, normalizeDisplay, normalizeKey } from './normalize.ts';
import type { Row } from './parse.ts';
import type { SyllabusEntry } from './syllabus.ts';

export type YearRows = { year: number; rows: Row[] };

/** data/fixes.csv の1行。PDF で切れた名前などを、全年度まとめて直す */
export type Fix = { department: string; from: string; to: string };

/** courses.json の形。アプリと Web はこの形を読む */
export type CourseVariant = {
  /** 履修登録者数 */
  registered: number;
  /** 単位修得者数 */
  earned: number;
  /** 授業数（2以上なら複数クラスの合算） */
  classes: number;
};

export type CourseYear = {
  year: number;
  /** 同じ名前で単位数などが違う科目は、PDF の順に複数並ぶ */
  variants: CourseVariant[];
};

export type FeedCourse = {
  id: string;
  name: string;
  department: string;
  /** 新しい年度が先 */
  stats: CourseYear[];
  /**
   * 公開シラバスのページの場所（feed.syllabus.baseUrl からの相対パス）。
   * 部局と授業名が一致したものだけ。複数クラスある授業は複数並ぶ。一致しなければ入れない
   */
  syllabus?: string[];
  /**
   * syllabus と同じ順の、クラスを見分ける名前（「1T3」「単位未修得者クラス」、セミナーのテーマなど）。
   * シラバス側の名前が「授業名＋空白＋記号」だったときだけ入る
   */
  syllabusLabels?: string[];
};

/**
 * シラバスの一覧と一致する授業に、シラバスのページの場所を付ける。
 * 1. 部局と授業名（表記をそろえたもの）が完全に一致するもの
 * 2. 1がなければ、同じ部局で「授業名＋空白＋クラスの記号」になっているもの（「英語リーディング 1T3」など）。
 *    記号はボタンの名前に使う。「(演習)」のように括弧で続くものは別の授業なので含めない
 */
export function attachSyllabus(courses: FeedCourse[], entries: SyllabusEntry[]): FeedCourse[] {
  const exact = new Map<string, string[]>();
  const byDepartment = new Map<string, { name: string; path: string }[]>();
  for (const entry of entries) {
    const key = `${entry.department}|${normalizeKey(entry.name)}`;
    const paths = exact.get(key) ?? [];
    if (!paths.includes(entry.path)) paths.push(entry.path);
    exact.set(key, paths);

    const list = byDepartment.get(entry.department) ?? [];
    list.push({ name: normalizeDisplay(entry.name), path: entry.path });
    byDepartment.set(entry.department, list);
  }
  // ほかの授業の名前とそのまま一致するシラバスは、その授業のものなので記号つきとしては使わない
  const courseNames = new Set(courses.map((course) => `${course.department}|${normalizeKey(course.name)}`));

  return courses.map((course) => {
    const paths = exact.get(`${course.department}|${normalizeKey(course.name)}`);
    if (paths) return { ...course, syllabus: paths };

    const prefix = `${normalizeDisplay(course.name)} `;
    const labeled = new Map<string, string>();
    for (const entry of byDepartment.get(course.department) ?? []) {
      if (!entry.name.startsWith(prefix)) continue;
      const suffix = entry.name.slice(prefix.length);
      if (/^[(（]/.test(suffix) || courseNames.has(`${course.department}|${normalizeKey(entry.name)}`)) continue;
      const label = suffix.replace(/^[\s:：]+/, '').trim();
      if (label && !labeled.has(entry.path)) labeled.set(entry.path, label);
    }
    if (labeled.size === 0) return course;

    const sorted = [...labeled].sort((a, b) => a[1].localeCompare(b[1], 'ja', { numeric: true }));
    // 同じ記号のシラバスが複数ある（前期・後期など）ときは、見分けられるよう2つ目から番号を付ける
    const seen = new Map<string, number>();
    const labels = sorted.map(([, label]) => {
      const count = (seen.get(label) ?? 0) + 1;
      seen.set(label, count);
      return count === 1 ? label : `${label}（${count}）`;
    });
    return { ...course, syllabus: sorted.map(([path]) => path), syllabusLabels: labels };
  });
}

function applyFixes(row: Row, fixes: Fix[]): Row {
  const fix = fixes.find(
    (item) => item.department === row.department && normalizeKey(item.from) === normalizeKey(row.name),
  );
  return fix ? { ...row, name: fix.to } : row;
}

/** 年度ごとの行を、授業（部局＋名前）ごとにまとめる */
export function buildCourses(years: YearRows[], fixes: Fix[]): FeedCourse[] {
  const byId = new Map<string, { course: FeedCourse; latestYear: number }>();

  // 古い年度から順に入れ、表示名は最新の年度のものにする
  for (const { year, rows } of [...years].sort((a, b) => a.year - b.year)) {
    for (const original of rows) {
      if (!isTargetDepartment(original.department)) continue;
      const row = applyFixes(original, fixes);
      const id = courseId(row.department, row.name);

      let entry = byId.get(id);
      if (!entry) {
        entry = {
          course: { id, name: '', department: displayDepartment(row.department), stats: [] },
          latestYear: year,
        };
        byId.set(id, entry);
      }
      entry.course.name = normalizeDisplay(row.name);
      entry.latestYear = year;

      let yearStats = entry.course.stats.find((item) => item.year === year);
      if (!yearStats) {
        yearStats = { year, variants: [] };
        entry.course.stats.push(yearStats);
      }
      yearStats.variants.push({ registered: row.registered, earned: row.earned, classes: row.classes });
    }
  }

  return [...byId.values()]
    .map(({ course }) => ({ ...course, stats: course.stats.sort((a, b) => b.year - a.year) }))
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department, 'ja') || a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id),
    );
}
