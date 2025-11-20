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

export async function GET(request: Request) {
  try {
    const userId = await getUserFromToken(request)

    // Prisma高度な操作4: 集計クエリ
    
    // 総タスク数
    const totalTasks = await prisma.task.count({
      where: { userId }
    })

    // ステータス別のタスク数
    const tasksByStatus = await prisma.task.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        id: true
      }
    })

    // カテゴリー別のタスク数と合計工数
    const tasksByCategory = await prisma.category.findMany({
      where: { userId },
      include: {
        _count: {
          select: { tasks: true }
        },
        tasks: {
          select: {
            estimatedHours: true,
            actualHours: true,
            status: true
          }
        }
      }
    })

    // カテゴリーごとの統計を計算
    const categoryStats = tasksByCategory.map(category => {
      const totalEstimated = category.tasks.reduce(
        (sum, task) => sum + (task.estimatedHours || 0),
        0
      )
      const totalActual = category.tasks.reduce(
        (sum, task) => sum + (task.actualHours || 0),
        0
      )
      const completedTasks = category.tasks.filter(
        task => task.status === 'done'
      ).length

      return {
        categoryId: category.id,
        categoryName: category.name,
        totalTasks: category._count.tasks,
        completedTasks,
        totalEstimatedHours: totalEstimated,
        totalActualHours: totalActual
      }
    })

    // Prisma高度な操作5: 集計関数
    const hoursStats = await prisma.task.aggregate({
      where: { userId },
      _sum: {
        estimatedHours: true,
        actualHours: true
      },
      _avg: {
        estimatedHours: true,
        actualHours: true
      }
    })

    return NextResponse.json({
      totalTasks,
      tasksByStatus,
      categoryStats,
      hoursStats: {
        totalEstimatedHours: hoursStats._sum.estimatedHours || 0,
        totalActualHours: hoursStats._sum.actualHours || 0,
        avgEstimatedHours: hoursStats._avg.estimatedHours || 0,
        avgActualHours: hoursStats._avg.actualHours || 0
      }
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json(
      { error: '統計情報の取得に失敗しました' },
      { status: 500 }
    )
  }
}
