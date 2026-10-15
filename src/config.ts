/**
 * 取り込み元。京都大学「教育情報の公表」の「各授業の平均学生在籍数」（年に1回公表される PDF）。
 * 新しい年度が公表されたら、ここに1行足して npm run extract → npm run build を実行する。
 * 京大のサイトから消えた古い年度は、国立国会図書館のアーカイブ（WARP）の URL を使う。
 */
export const SOURCES: { year: number; url: string }[] = [
  {
    year: 2021,
    url: 'https://warp.ndl.go.jp/20230215/20230212045553/https://www.kyoto-u.ac.jp/sites/default/files/inline-files/10-1-52863019b112f7a941da66f1f67732fb.pdf',
  },
  {
    year: 2022,
    url: 'https://warp.ndl.go.jp/20231114/20231111014441/https://www.kyoto-u.ac.jp/sites/default/files/inline-files/10-1-870f18c88e9cc1d2194873eefd28443d.pdf',
  },
  {
    year: 2023,
    url: 'https://warp.ndl.go.jp/20251125/20251111073840/https://www.kyoto-u.ac.jp/sites/default/files/inline-files/10-1-fd74b48ede8655ef7a87d79175a75c51.pdf',
  },
  {
    year: 2024,
    url: 'https://warp.ndl.go.jp/20260218/20260212010802/https://www.kyoto-u.ac.jp/sites/default/files/inline-files/7-2-4-190f9f6cd37b67970d8069ecdbe2a5e8.pdf',
  },
  {
    year: 2025,
    url: 'https://www.kyoto-u.ac.jp/sites/default/files/inline-files/7-2-4-ce73ef5c799cbe52eeaabe2c2c2296c7.pdf',
  },
];

export const ATTRIBUTION = '京都大学「各授業の平均学生在籍数」';

export const USER_AGENT =
  'kyodaihub-courses/1.0 (+https://github.com/minakei02/kyodaihub-courses)';

/** 取り込む部局。学部の授業と、全学共通科目（国際高等教育院）だけ。大学院は入れない */
export function isTargetDepartment(department: string): boolean {
  if (department === '国際高等教育院') return true;
  return department.includes('学部') && !/研究科|教育部|学舎|学館/.test(department);
}

/** アプリに出す部局名。国際高等教育院は学生に通じる「全学共通科目」と言い換える */
export function displayDepartment(department: string): string {
  return department === '国際高等教育院' ? '全学共通科目' : department;
}

/**
 * 安全装置。PDF の作りが変わって読み取りが壊れたときに、
 * 中身の欠けたファイルを作らないための下限（1年度あたりの行数）。
 */
export const MIN_ROWS_PER_YEAR = 3000;
