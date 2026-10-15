/**
 * data/raw/{年度}.csv と data/fixes.csv から、配信用の docs/courses.json を作る。
 * docs/ は GitHub Pages でそのまま公開される（https://minakei02.github.io/kyodaihub-courses/courses.json）。
 * 同じ入力からは毎回同じファイルができる（日時などを入れない）ので、差分は中身が変わったときだけ出る。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { ATTRIBUTION, MIN_ROWS_PER_YEAR, SOURCES } from './config.ts';
import { parseCsv } from './csv.ts';
import { buildCourses, type Fix, type YearRows } from './courses.ts';

const OUTPUT = join('docs', 'courses.json');

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

const years = await Promise.all(SOURCES.map((source) => readYear(source.year)));
const courses = buildCourses(years, await readFixes());

const feed = {
  version: 1,
  source: {
    title: ATTRIBUTION,
    years: SOURCES.map((source) => source.year),
    urls: SOURCES.map((source) => source.url),
  },
  courses,
};

const json = JSON.stringify(feed);
await writeFile(OUTPUT, json);
console.log(
  `${OUTPUT}: ${courses.length}授業, ${(json.length / 1024).toFixed(0)}KB（圧縮すると ${(gzipSync(json).length / 1024).toFixed(0)}KB）`,
);
