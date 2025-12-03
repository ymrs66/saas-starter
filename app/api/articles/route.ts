import { NextRequest, NextResponse } from 'next/server';
import { getArticles } from '@/lib/db/articles-queries';
import { getUser, getTeamForUser } from '@/lib/db/queries';

/**
 * GET /api/articles
 * 記事一覧を取得するAPIエンドポイント
 * @param request - Next.jsリクエストオブジェクト
 * @returns 記事一覧とページネーション情報
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status') || undefined;
    const userId = searchParams.get('userId')
      ? parseInt(searchParams.get('userId')!, 10)
      : undefined;
    const teamId = searchParams.get('teamId')
      ? parseInt(searchParams.get('teamId')!, 10)
      : undefined;
    const categoryId = searchParams.get('categoryId')
      ? parseInt(searchParams.get('categoryId')!, 10)
      : undefined;
    const search = searchParams.get('search') || undefined;

    // 非公開記事を含む場合は認証チェック
    let finalTeamId = teamId;
    if (status && status !== 'published') {
      const user = await getUser();
      if (!user) {
        return NextResponse.json(
          { error: '認証が必要です' },
          { status: 401 }
        );
      }

      const team = await getTeamForUser();
      if (!team) {
        return NextResponse.json(
          { error: 'チームが見つかりません' },
          { status: 403 }
        );
      }

      // 自分のチームの記事のみ取得
      finalTeamId = team.id;
    }

    const result = await getArticles({
      page,
      limit,
      status,
      userId,
      teamId: finalTeamId,
      categoryId,
      search,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: '記事の取得に失敗しました' },
      { status: 500 }
    );
  }
}
