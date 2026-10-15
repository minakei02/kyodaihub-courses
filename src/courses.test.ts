import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCourses } from './courses.ts';
import { parseCsv, toCsv } from './csv.ts';
import { courseId, normalizeDisplay, normalizeKey } from './normalize.ts';

const row = (department: string, name: string, registered: number, earned: number, classes = 1) => ({
  department,
  name,
  registered,
  earned,
  classes,
});

test('表記: 全角英数字・半角カナ・ローマ数字をそろえる', () => {
  assert.equal(normalizeDisplay('線形代数学（講義・演義）Ａ'), '線形代数学(講義・演義)A');
  assert.equal(normalizeDisplay('ｻﾝｽｸﾘｯﾄ'), 'サンスクリット');
  assert.equal(normalizeDisplay('心理学Ⅰ'), '心理学I');
  assert.equal(normalizeKey('Urban  and Regional'), normalizeKey('urban and regional'));
});

test('ID: 表記の揺れがあっても同じ授業なら同じ ID', () => {
  assert.equal(courseId('国際高等教育院', '心理学Ｉ'), courseId('国際高等教育院', '心理学I'));
  assert.notEqual(courseId('国際高等教育院', '心理学I'), courseId('教育学部', '心理学I'));
  assert.match(courseId('文学部', '哲学'), /^[0-9a-f]{12}$/);
});

test('まとめ: 年度をまたいで同じ授業をまとめ、新しい年度を先にする', () => {
  const courses = buildCourses(
    [
      { year: 2025, rows: [row('国際高等教育院', '心理学Ｉ', 749, 494, 6)] },
      { year: 2024, rows: [row('国際高等教育院', '心理学I', 790, 496, 5)] },
    ],
    [],
  );
  assert.equal(courses.length, 1);
  assert.equal(courses[0].name, '心理学I');
  assert.equal(courses[0].department, '全学共通科目');
  assert.deepEqual(
    courses[0].stats.map((item) => item.year),
    [2025, 2024],
  );
});

test('まとめ: 同じ年度に同じ名前の行が複数あれば、別の集計として並べる', () => {
  const courses = buildCourses(
    [{ year: 2025, rows: [row('国際高等教育院', '線形代数学A', 93, 89), row('国際高等教育院', '線形代数学A', 213, 192, 2)] }],
    [],
  );
  assert.deepEqual(courses[0].stats[0].variants, [
    { registered: 93, earned: 89, classes: 1 },
    { registered: 213, earned: 192, classes: 2 },
  ]);
});

test('まとめ: 大学院の授業は入れない', () => {
  const courses = buildCourses(
    [
      {
        year: 2025,
        rows: [
          row('理学部', '物理学', 100, 90),
          row('理学研究科', '物理学特論', 10, 10),
          row('医学研究科（人間健康科学系専攻', '看護学特論', 5, 5),
          row('経営管理教育部', '会計', 20, 18),
        ],
      },
    ],
    [],
  );
  assert.deepEqual(
    courses.map((course) => course.name),
    ['物理学'],
  );
});

test('まとめ: 手直しで切れた名前を直し、年度をまたいでまとめる', () => {
  const courses = buildCourses(
    [
      { year: 2025, rows: [row('工学部', 'Structural Mechanics II and Exerci', 11, 11)] },
      { year: 2024, rows: [row('工学部', 'Structural Mechanics II and Exercise', 12, 10)] },
    ],
    [{ department: '工学部', from: 'Structural Mechanics II and Exerci', to: 'Structural Mechanics II and Exercise' }],
  );
  assert.equal(courses.length, 1);
  assert.equal(courses[0].name, 'Structural Mechanics II and Exercise');
});

test('CSV: カンマやダブルクォートを含む名前も往復できる', () => {
  const csv = toCsv(['department', 'name'], [['文学部', 'A, "B"']]);
  assert.deepEqual(parseCsv(`# コメント\n${csv}`), [{ department: '文学部', name: 'A, "B"' }]);
});
