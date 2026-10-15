/**
 * data/raw/{年度}.csv と data/fixes.csv から、配信用の docs/courses.json を作る。
 * data/syllabus/{年度}.html（人がブラウザで保存したシラバスの一覧）があれば、そこから
 * data/syllabus/{年度}.csv（部局・授業名・ページの場所だけ）を作り直し、いちばん新しい年度の分を授業に付ける。
 * docs/ は GitHub Pages でそのまま公開される（https://minakei02.github.io/kyodaihub-courses/courses.json）。
 * 同じ入力からは毎回同じファイルができる（日時などを入れない）ので、差分は中身が変わったときだけ出る。
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { ATTRIBUTION, MIN_ROWS_PER_YEAR, SOURCES } from './config.ts';
import { parseCsv, toCsv } from './csv.ts';
import { attachSyllabus, buildCourses, type Fix, type YearRows } from './courses.ts';
import {
  decodeSavedPage,
  isSyllabusPath,
  parseSyllabusIndex,
  SYLLABUS_BASE_URL,
  type SyllabusEntry,
} from './syllabus.ts';

const OUTPUT = join('docs', 'courses.json');
const SYLLABUS_DIR = join('data', 'syllabus');
/** 一覧の読み取りが壊れたときに、ほとんど空のリンクで公開しないための下限 */
const MIN_SYLLABUS_ENTRIES = 5000;

async function readYear(year: number): Promise<YearRows> {
  const records = parseCsv(await readFile(join('data', 'raw', `${year}.csv`), 'utf8'));
  if (records.length < MIN_ROWS_PER_YEAR) {
    throw new Error(`${year}: 行が少なすぎる（${records.length}行）。npm run extract の結果を確かめる`);
  }
  return {
    year,
    rows: records.map((record) => ({
      department: record.department,
      name: record.name,
      registered: Number(record.registered),
      earned: Number(record.earned),
      classes: Number(record.classes),
    })),
  };
}

async function readFixes(): Promise<Fix[]> {
  const records = parseCsv(await readFile(join('data', 'fixes.csv'), 'utf8'));
  return records.map((record) => ({
    department: record.department,
    from: record.from,
    to: record.to,
  }));
}

/** 保存したページ（.html）があれば .csv を作り直す。リポジトリに入れるのは .csv だけ */
async function refreshSyllabusCsv(): Promise<void> {
  if (!existsSync(SYLLABUS_DIR)) return;
  for (const file of await readdir(SYLLABUS_DIR)) {
    const match = file.match(/^(\d{4})\.html$/);
    if (!match) continue;
    const entries = parseSyllabusIndex(decodeSavedPage(new Uint8Array(await readFile(join(SYLLABUS_DIR, file)))));
    if (entries.length < MIN_SYLLABUS_ENTRIES) {
      throw new Error(`${file}: 授業のリンクが少なすぎる（${entries.length}件）。保存したページを確かめる`);
    }
    await writeFile(
      join(SYLLABUS_DIR, `${match[1]}.csv`),
      toCsv(
        ['department', 'name', 'path'],
        entries.map((entry) => [entry.department, entry.name, entry.path]),
      ),
    );
    console.log(`${file} → ${match[1]}.csv（${entries.length}件）`);
  }
}

/** いちばん新しい年度のシラバスの一覧 */
async function readLatestSyllabus(): Promise<{ year: number; entries: SyllabusEntry[] } | null> {
  if (!existsSync(SYLLABUS_DIR)) return null;
  const years = (await readdir(SYLLABUS_DIR))
    .map((file) => file.match(/^(\d{4})\.csv$/)?.[1])
    .filter((year): year is string => Boolean(year))
    .map(Number)
    .sort((a, b) => b - a);
  if (years.length === 0) return null;

  const records = parseCsv(await readFile(join(SYLLABUS_DIR, `${years[0]}.csv`), 'utf8'));
  const entries = records.filter((record) => isSyllabusPath(record.path)) as SyllabusEntry[];
  return { year: years[0], entries };
}

await refreshSyllabusCsv();
const years = await Promise.all(SOURCES.map((source) => readYear(source.year)));
let courses = buildCourses(years, await readFixes());

const syllabus = await readLatestSyllabus();
if (syllabus) {
  courses = attachSyllabus(courses, syllabus.entries);
  const linked = courses.filter((course) => course.syllabus).length;
  console.log(`シラバス ${syllabus.year}年度: ${linked}授業にリンクを付けた`);
}

const feed = {
  version: 1,
  source: {
    title: ATTRIBUTION,
    years: SOURCES.map((source) => source.year),
    urls: SOURCES.map((source) => source.url),
  },
  ...(syllabus ? { syllabus: { year: syllabus.year, baseUrl: SYLLABUS_BASE_URL } } : {}),
  courses,
};

const json = JSON.stringify(feed);
await writeFile(OUTPUT, json);
console.log(
  `${OUTPUT}: ${courses.length}授業, ${(json.length / 1024).toFixed(0)}KB（圧縮すると ${(gzipSync(json).length / 1024).toFixed(0)}KB）`,
);
