/**
 * 京大の PDF を読んで、年度ごとの表を data/raw/{年度}.csv に書き出す。
 * PDF は cache/ に保存し、すでにあれば取り直さない（相手のサーバーに負担をかけない）。
 * 使い方: npm run extract（全年度） / npm run extract -- --year 2025（1年度だけ）
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { SOURCES, USER_AGENT } from './config.ts';
import { toCsv } from './csv.ts';
import { findYear, parsePage, type Row, type TextItem } from './parse.ts';

const CACHE_DIR = 'cache';
const RAW_DIR = join('data', 'raw');
/** 想定外に大きいファイルは取り込まない */
const MAX_PDF_BYTES = 30 * 1024 * 1024;

async function downloadPdf(year: number, url: string): Promise<Uint8Array> {
  const path = join(CACHE_DIR, `${year}.pdf`);
  if (existsSync(path)) return new Uint8Array(await readFile(path));

  if (!url.startsWith('https://')) throw new Error(`${year}: https 以外の URL は使わない: ${url}`);
  console.log(`${year}: ダウンロード ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`${year}: HTTP ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_PDF_BYTES) throw new Error(`${year}: ファイルが大きすぎる (${data.byteLength} bytes)`);
  if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-') throw new Error(`${year}: PDF ではない`);

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, data);
  return data;
}

async function extractYear(year: number, url: string): Promise<void> {
  const data = await downloadPdf(year, url);
  const doc = await getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;

  const rows: Row[] = [];
  const skipped: string[] = [];
  let foundYear: number | null = null;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items
      .filter((item) => 'str' in item)
      .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
    foundYear ??= findYear(items);
    const result = parsePage(items);
    rows.push(...result.rows);
    skipped.push(...result.skipped.map((text) => `p${pageNumber}: ${text}`));
  }

  if (foundYear !== year) {
    throw new Error(`${year}: PDF に書かれた年度が違う（${foundYear ?? '読めない'}）。URL を確かめる`);
  }
  const broken = rows.filter((row) => row.earned > row.registered || row.classes < 1);
  if (broken.length > 0) {
    throw new Error(`${year}: 数のおかしい行がある: ${JSON.stringify(broken.slice(0, 3))}`);
  }

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    join(RAW_DIR, `${year}.csv`),
    toCsv(
      ['department', 'name', 'registered', 'earned', 'classes'],
      rows.map((row) => [row.department, row.name, row.registered, row.earned, row.classes]),
    ),
  );
  console.log(`${year}: ${doc.numPages}ページ → ${rows.length}行`);
  if (skipped.length > 0) {
    console.log(`${year}: 表の行として読めなかった ${skipped.length}行（取りこぼしでないか確かめる）`);
    for (const text of skipped) console.log(`  ${text}`);
  }
}

const { values } = parseArgs({ options: { year: { type: 'string' } } });
const targets = values.year ? SOURCES.filter((source) => source.year === Number(values.year)) : SOURCES;
if (targets.length === 0) throw new Error(`config.ts にない年度: ${values.year}`);

for (const source of targets) {
  await extractYear(source.year, source.url);
}
