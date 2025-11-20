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

// カテゴリー更新
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserFromToken(request)
    const { name } = await request.json()
    const categoryId = parseInt(params.id)

    // Prisma基本操作3: update - レコード更新
    // where条件で権限チェックも同時に行う
    const category = await prisma.category.update({
      where: {
        id: categoryId,
        userId // 自分のカテゴリーのみ更新可能
      },
      data: { name }
    })

    return NextResponse.json(category)
  } catch (error: any) {
    console.error('Update category error:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'カテゴリーが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'カテゴリーの更新に失敗しました' },
      { status: 500 }
    )
  }
}

// カテゴリー削除
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserFromToken(request)
    const categoryId = parseInt(params.id)

    // Prisma基本操作4: delete - レコード削除
    // onDelete: Cascade が設定されているので、関連するタスクも自動削除される
    await prisma.category.delete({
      where: {
        id: categoryId,
        userId
      }
    })

    return NextResponse.json({ message: '削除しました' })
  } catch (error: any) {
    console.error('Delete category error:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'カテゴリーが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'カテゴリーの削除に失敗しました' },
      { status: 500 }
    )
  }
}
