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

// タスク更新
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserFromToken(request)
    const data = await request.json()

    // Prisma高度な操作3: 部分更新（undefined のフィールドは更新しない）
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.status !== undefined) updateData.status = data.status
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours
    if (data.actualHours !== undefined) updateData.actualHours = data.actualHours
    if (data.isWorking !== undefined) updateData.isWorking = data.isWorking
    if (data.workStartTime !== undefined) {
      updateData.workStartTime = data.workStartTime ? new Date(data.workStartTime) : null
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    }

    const task = await prisma.task.update({
      where: {
        id: params.id,
        userId
      },
      data: updateData,
      include: {
        category: true
      }
    })

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('Update task error:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'タスクが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'タスクの更新に失敗しました' },
      { status: 500 }
    )
  }
}

// タスク削除
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserFromToken(request)

    await prisma.task.delete({
      where: {
        id: params.id,
        userId
      }
    })

    return NextResponse.json({ message: '削除しました' })
  } catch (error: any) {
    console.error('Delete task error:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'タスクが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'タスクの削除に失敗しました' },
      { status: 500 }
    )
  }
}

// 単一タスク取得
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserFromToken(request)

    // Prisma基本操作5: findUnique - 単一レコード取得
    const task = await prisma.task.findUnique({
      where: {
        id: params.id
      },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    })

    // 権限チェック
    if (!task || task.userId !== userId) {
      return NextResponse.json(
        { error: 'タスクが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json(
      { error: 'タスクの取得に失敗しました' },
      { status: 500 }
    )
  }
}
