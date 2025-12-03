import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory } from '@/lib/db/articles-queries';
import { getUser } from '@/lib/db/queries';
import { generateSlug } from '@/lib/utils';

/**
 * GET /api/categories
 * カテゴリ一覧を取得するAPIエンドポイント
 * @returns カテゴリ一覧
 */
export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json(
      { error: 'カテゴリの取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * カテゴリを作成するAPIエンドポイント
 * @param request - Next.jsリクエストオブジェクト
 * @returns 作成されたカテゴリ
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'カテゴリ名は必須です' },
        { status: 400 }
      );
    }

    const slug = generateSlug(name);
    const category = await createCategory({ name: name.trim(), slug });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'カテゴリの作成に失敗しました' },
      { status: 500 }
    );
  }
}
