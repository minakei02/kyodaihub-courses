import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findYear, joinParts, parsePage, type TextItem } from './parse.ts';

/** PDF の1行ぶんの文字を、実際の横位置に近い形で作る */
function line(y: number, department: string, name: string | string[], numbers: number[]): TextItem[] {
  const names = Array.isArray(name) ? name : [name];
  const numberX = [409, 442, 486, 520, 561];
  return [
    { str: department, x: 20, y },
    ...names.map((str, index) => ({ str, x: 172 + index * 120, y })),
    ...numbers.map((value, index) => ({ str: String(value), x: numberX[index], y })),
  ];
}

test('年度: 見出しから読む', () => {
  assert.equal(findYear([{ str: '( 2025年度）', x: 453, y: 806 }]), 2025);
  assert.equal(findYear([{ str: '各授業の平均学生在籍数', x: 19, y: 807 }]), null);
});

test('行: 平均の列は使わず、合計と授業数を取る', () => {
  const { rows, skipped } = parsePage(line(700, '文学部', 'アメリカ文学 (演習I)', [18, 3, 17, 3, 6]));
  assert.deepEqual(rows, [
    { department: '文学部', name: 'アメリカ文学 (演習I)', registered: 18, earned: 17, classes: 6 },
  ]);
  assert.deepEqual(skipped, []);
});

test('行: 見出しは飛ばし、取りこぼしとして数えない', () => {
  const header: TextItem[] = [
    { str: '開講学部・研究科等', x: 52, y: 747 },
    { str: '授業科目名', x: 247, y: 747 },
    { str: '授業数', x: 535, y: 747 },
  ];
  const { rows, skipped } = parsePage(header);
  assert.equal(rows.length, 0);
  assert.deepEqual(skipped, []);
});

test('行: 数がそろわない行は取りこぼしとして残す', () => {
  const { rows, skipped } = parsePage([
    { str: '文学部', x: 20, y: 700 },
    { str: '何かの注記', x: 172, y: 700 },
  ]);
  assert.equal(rows.length, 0);
  assert.equal(skipped.length, 1);
});

test('行: 欄からあふれて分かれた名前をつなぐ', () => {
  const { rows } = parsePage([
    ...line(700, '経済学部', ['演', '習'], [744, 6, 663, 5, 123]),
    ...line(686, '工学部', ['Urban and', 'Regional Planning'], [12, 12, 9, 9, 1]),
  ]);
  assert.equal(rows[0].name, '演習');
  assert.equal(rows[1].name, 'Urban and Regional Planning');
});

test('行: 部局名の列にはみ出した名前の頭も名前に入れる', () => {
  const items: TextItem[] = [
    { str: '医学部', x: 20, y: 700 },
    { str: 'Ｂ13', x: 120, y: 700 },
    { str: '社会・環境・予防医学', x: 172, y: 700 },
    ...[112, 112, 112, 112, 1].map((value, index) => ({ str: String(value), x: [409, 442, 486, 520, 561][index], y: 700 })),
  ];
  const { rows } = parsePage(items);
  assert.equal(rows[0].department, '医学部');
  assert.equal(rows[0].name, 'Ｂ13社会・環境・予防医学');
});

test('行: 縦位置が少しずれていても同じ行とみなす', () => {
  const items = line(700, '理学部', '物理学基礎論A', [100, 100, 90, 90, 1]).map((item, index) => ({
    ...item,
    y: item.y + (index % 2),
  }));
  assert.equal(parsePage(items).rows.length, 1);
});

test('名前のつなぎ: 英数字の境目だけ空白を入れる', () => {
  assert.equal(joinParts(['演', '習']), '演習');
  assert.equal(joinParts(['Structural Mechanics II and', 'Exerci']), 'Structural Mechanics II and Exerci');
  assert.equal(joinParts(['病院実習ＩＡ', '(心理実践実習)']), '病院実習ＩＡ (心理実践実習)');
});
