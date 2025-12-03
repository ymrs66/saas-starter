import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * タイトルからURLフレンドリーなスラッグを生成する
 * @param title - 記事のタイトル
 * @returns URLフレンドリーなスラッグ
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * カンマ区切りの文字列をトリムされたタグ配列に変換する
 * @param tagsString - カンマ区切りのタグ文字列
 * @returns トリムされたタグ配列
 */
export function parseTagsString(tagsString: string | undefined): string[] {
  if (!tagsString) {
    return [];
  }

  return tagsString
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
