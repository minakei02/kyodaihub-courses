import { createHash } from 'node:crypto';

/**
 * 表示用に表記をそろえる。全角英数字・半角カタカナ・ローマ数字（Ⅰ）などを NFKC で統一し、空白を詰める。
 * 例：「ｻﾝｽｸﾘｯﾄ」→「サンスクリット」、「線形代数学（講義・演義）Ａ」→「線形代数学(講義・演義)A」
 */
export function normalizeDisplay(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** 年度をまたいで同じ授業かを見分けるための鍵。表示用の表記から空白をなくし、小文字にしたもの */
export function normalizeKey(value: string): string {
  return normalizeDisplay(value).replace(/\s+/g, '').toLowerCase();
}

/**
 * 授業 ID。部局と名前から決まるので、名前が変わらない限り毎年同じになる。
 * 過去問や意見など、あとから足すデータはこの ID にひも付ける。
 */
export function courseId(department: string, name: string): string {
  return createHash('sha256')
    .update(`${normalizeKey(department)}|${normalizeKey(name)}`)
    .digest('hex')
    .slice(0, 12);
}
