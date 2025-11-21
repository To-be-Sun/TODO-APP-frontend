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

// カテゴリー一覧取得
export async function GET(request: Request) {
  try {
    const userId = await getUserFromToken(request)

    // Prisma基本操作1: findMany - 複数レコード取得
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      // リレーションデータも取得する例
      include: {
        _count: {
          select: { tasks: true }
        }
      }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json(
      { error: 'カテゴリーの取得に失敗しました' },
      { status: 500 }
    )
  }
}

// カテゴリー作成
export async function POST(request: Request) {
  try {
    const userId = await getUserFromToken(request)
    const { name } = await request.json()

    // Prisma基本操作2: create - レコード作成
    const category = await prisma.category.create({
      data: {
        name,
        userId
      }
    })

    return NextResponse.json(category)
  } catch (error: any) {
    console.error('Create category error:', error)
    
    // ユニーク制約違反のエラー処理
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'このカテゴリー名は既に存在します' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'カテゴリーの作成に失敗しました' },
      { status: 500 }
    )
  }
}
