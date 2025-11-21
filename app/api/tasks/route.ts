import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

async function getUserFromToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証が必要です')
  }

  const token = authHeader.substring(7)
  const { payload } = await jwtVerify(token, SECRET_KEY)
  return payload.userId as number
}

// タスク一覧取得（フィルター機能付き）
export async function GET(request: Request) {
  try {
    const userId = await getUserFromToken(request)
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const status = searchParams.get('status')

    // Prisma高度な操作1: 条件付きフィルター
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        // 条件がある場合のみフィルターを追加
        ...(categoryId && { categoryId: parseInt(categoryId) }),
        ...(status && { status })
      },
      // リレーション先のデータも取得
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      // ソート: 期日が近い順、その後作成日時順
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json(
      { error: 'タスクの取得に失敗しました' },
      { status: 500 }
    )
  }
}

// タスク作成
export async function POST(request: Request) {
  try {
    const userId = await getUserFromToken(request)
    const data = await request.json()

    // カテゴリーの存在チェック
    const category = await prisma.category.findFirst({
      where: {
        id: data.categoryId,
        userId
      }
    })

    if (!category) {
      return NextResponse.json(
        { error: 'カテゴリーが見つかりません' },
        { status: 404 }
      )
    }

    // Prisma高度な操作2: ネストしたデータ作成
    const task = await prisma.task.create({
      data: {
        title: data.title,
        status: data.status || 'active',
        categoryId: data.categoryId,
        userId,
        estimatedHours: data.estimatedHours,
        dueDate: data.dueDate ? new Date(data.dueDate) : null
      },
      // 作成後、リレーションデータも含めて返す
      include: {
        category: true
      }
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json(
      { error: 'タスクの作成に失敗しました' },
      { status: 500 }
    )
  }
}
