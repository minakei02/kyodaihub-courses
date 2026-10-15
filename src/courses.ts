import { displayDepartment, isTargetDepartment } from './config.ts';
import { courseId, normalizeDisplay, normalizeKey } from './normalize.ts';
import type { Row } from './parse.ts';

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
};

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
