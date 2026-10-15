import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachSyllabus, type FeedCourse } from './courses.ts';
import { decodeSavedPage, isSyllabusPath, parseSyllabusIndex } from './syllabus.ts';

const page = `
<div class="departmentName"> 全学共通科目<span class="departmentIcon">＋</span></div>
<a href="https://www.k.kyoto-u.ac.jp/external/open_syllabus/la_syllabus?lectureNo=62407">心理学II</a>
<a href="https://www.k.kyoto-u.ac.jp/external/open_syllabus/la_syllabus?lectureNo=62456">心理学II</a>
<div class="departmentName"> 医学部(人間)<span class="departmentIcon">＋</span></div>
<a href="https://www.k.kyoto-u.ac.jp/external/open_syllabus/department_syllabus?lectureNo=100&amp;departmentNo=7">看護学概論</a>
<div class="departmentName"> 理学部<span class="departmentIcon">＋</span></div>
<a href="department_syllabus?lectureNo=8752&amp;departmentNo=10">集合と位相 </a>
<a href="https://example.com/evil?lectureNo=1">悪いリンク</a>
<a href="https://www.k.kyoto-u.ac.jp/external/open_syllabus/la_syllabus?lectureNo=1&amp;x=javascript">変な形</a>
`;

test('シラバス一覧: 直前の見出しを部局として、授業名とページの場所を取り出す', () => {
  assert.deepEqual(parseSyllabusIndex(page), [
    { department: '全学共通科目', name: '心理学II', path: 'la_syllabus?lectureNo=62407' },
    { department: '全学共通科目', name: '心理学II', path: 'la_syllabus?lectureNo=62456' },
    { department: '医学部（人間健康科学科）', name: '看護学概論', path: 'department_syllabus?lectureNo=100&departmentNo=7' },
    { department: '理学部', name: '集合と位相', path: 'department_syllabus?lectureNo=8752&departmentNo=10' },
  ]);
});

test('シラバス一覧: 決まった2つの形以外の場所は受け付けない', () => {
  assert.equal(isSyllabusPath('la_syllabus?lectureNo=62407'), true);
  assert.equal(isSyllabusPath('department_syllabus?lectureNo=1&departmentNo=2'), true);
  assert.equal(isSyllabusPath('la_syllabus?lectureNo=1&x=2'), false);
  assert.equal(isSyllabusPath('../../evil'), false);
});

test('シラバス一覧: 保存したページの charset を見て文字にする', () => {
  const utf8 = new TextEncoder().encode('<meta charset="utf-8"><p>心理学</p>');
  assert.match(decodeSavedPage(utf8), /心理学/);
});

test('ひも付け: 「授業名＋空白＋クラスの記号」も同じ授業として、記号をボタンの名前にする', () => {
  const course = (name: string): FeedCourse => ({
    id: '000000000000',
    name,
    department: '全学共通科目',
    stats: [{ year: 2025, variants: [{ registered: 10, earned: 9, classes: 1 }] }],
  });
  const entry = (name: string, lectureNo: number) => ({
    department: '全学共通科目',
    name,
    path: `la_syllabus?lectureNo=${lectureNo}`,
  });
  const [reading, seminar] = attachSyllabus(
    [course('英語リーディング'), course('ILASセミナー'), course('心理学')],
    [
      entry('英語リーディング 1T10', 3),
      entry('英語リーディング 1T9', 2),
      entry('英語リーディング 単位未修得者クラス', 4),
      entry('ILASセミナー :エンジンの科学', 5),
      entry('心理学 (演習)', 6),
    ],
  );
  assert.deepEqual(reading.syllabusLabels, ['1T9', '1T10', '単位未修得者クラス']);
  assert.deepEqual(reading.syllabus, ['la_syllabus?lectureNo=2', 'la_syllabus?lectureNo=3', 'la_syllabus?lectureNo=4']);
  assert.deepEqual(seminar.syllabusLabels, ['エンジンの科学']);
});

test('ひも付け: 括弧で続く名前は別の授業なので、記号つきとして付けない', () => {
  const [course] = attachSyllabus(
    [{ id: '000000000000', name: '心理学', department: '文学部', stats: [] }],
    [{ department: '文学部', name: '心理学 (演習)', path: 'department_syllabus?lectureNo=1&departmentNo=1' }],
  );
  assert.equal(course.syllabus, undefined);
});

test('ひも付け: 部局と名前（表記をそろえたもの）が一致する授業にだけ付ける', () => {
  const course = (department: string, name: string): FeedCourse => ({
    id: '000000000000',
    name,
    department,
    stats: [{ year: 2025, variants: [{ registered: 10, earned: 9, classes: 1 }] }],
  });
  const linked = attachSyllabus(
    [course('全学共通科目', '心理学II'), course('教育学部', '心理学II'), course('理学部', '集合と位相')],
    parseSyllabusIndex(page),
  );
  assert.deepEqual(linked[0].syllabus, ['la_syllabus?lectureNo=62407', 'la_syllabus?lectureNo=62456']);
  assert.equal(linked[1].syllabus, undefined);
  assert.deepEqual(linked[2].syllabus, ['department_syllabus?lectureNo=8752&departmentNo=10']);
});
