# Prisma学習ガイド

## 基本的なPrismaコマンド

```bash
# Prismaクライアントを生成（schema.prismaを変更した後に実行）
npx prisma generate

# データベースマイグレーション（開発環境）
npx prisma migrate dev --name マイグレーション名

# マイグレーションを本番環境に適用
npx prisma migrate deploy

# Prisma Studioを起動（GUIでデータベースを操作）
npx prisma studio

# データベースをリセット（全データ削除）
npx prisma migrate reset

# スキーマをフォーマット
npx prisma format

# 既存のデータベースからスキーマを生成
npx prisma db pull

# スキーマからデータベースを更新（開発時のみ）
npx prisma db push
```

## Prismaの主要な操作パターン

### 1. 基本的なCRUD

```typescript
// CREATE - 作成
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed_password'
  }
})

// READ - 読み取り
// 単一レコード
const user = await prisma.user.findUnique({
  where: { id: 1 }
})

// 複数レコード
const users = await prisma.user.findMany({
  where: { email: { contains: '@example.com' } }
})

// 最初の1件
const firstUser = await prisma.user.findFirst({
  where: { username: 'admin' }
})

// UPDATE - 更新
const updatedUser = await prisma.user.update({
  where: { id: 1 },
  data: { username: 'newname' }
})

// 複数更新
const result = await prisma.user.updateMany({
  where: { email: { contains: '@old.com' } },
  data: { email: { set: '@new.com' } }
})

// DELETE - 削除
await prisma.user.delete({
  where: { id: 1 }
})

// 複数削除
await prisma.user.deleteMany({
  where: { createdAt: { lt: new Date('2020-01-01') } }
})
```

### 2. フィルタリング（where条件）

```typescript
// 等しい
where: { status: 'active' }

// 含む
where: { email: { contains: '@gmail.com' } }

// 開始/終了
where: { 
  title: { startsWith: 'TODO' },
  email: { endsWith: '@company.com' }
}

// 大小比較
where: {
  age: { gte: 18, lte: 65 } // >= 18 AND <= 65
}

// IN演算子
where: { status: { in: ['active', 'pending'] } }

// NOT
where: { status: { not: 'deleted' } }

// OR条件
where: {
  OR: [
    { status: 'active' },
    { priority: 'high' }
  ]
}

// AND条件
where: {
  AND: [
    { status: 'active' },
    { userId: 1 }
  ]
}

// NULL判定
where: {
  dueDate: { isSet: true } // NOT NULL
  // または
  dueDate: null // IS NULL
}
```

### 3. リレーション操作

```typescript
// リレーションデータを含めて取得
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    tasks: true, // 全てのタスク
    categories: true // 全てのカテゴリー
  }
})

// 選択的にフィールドを取得
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    email: true,
    tasks: {
      select: {
        id: true,
        title: true
      }
    }
  }
})

// リレーション先でフィルター
const categories = await prisma.category.findMany({
  where: {
    userId: 1,
    tasks: {
      some: { // 最低1つのタスクが条件に合う
        status: 'active'
      }
    }
  }
})

// ネストした作成
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    username: 'test',
    password: 'hash',
    categories: {
      create: [
        { name: 'Work' },
        { name: 'Personal' }
      ]
    }
  }
})
```

### 4. ソートとページネーション

```typescript
// ソート
const tasks = await prisma.task.findMany({
  orderBy: {
    createdAt: 'desc'
  }
})

// 複数フィールドでソート
const tasks = await prisma.task.findMany({
  orderBy: [
    { dueDate: 'asc' },
    { priority: 'desc' }
  ]
})

// ページネーション
const tasks = await prisma.task.findMany({
  skip: 20, // 最初の20件をスキップ
  take: 10, // 10件取得
  orderBy: { createdAt: 'desc' }
})
```

### 5. 集計とグループ化

```typescript
// カウント
const count = await prisma.task.count({
  where: { status: 'active' }
})

// 集計
const stats = await prisma.task.aggregate({
  _count: { id: true },
  _sum: { estimatedHours: true },
  _avg: { actualHours: true },
  _min: { dueDate: true },
  _max: { dueDate: true }
})

// グループ化
const grouped = await prisma.task.groupBy({
  by: ['status', 'categoryId'],
  _count: { id: true },
  _sum: { estimatedHours: true }
})
```

### 6. トランザクション

```typescript
// 複数の操作をトランザクションで実行
const result = await prisma.$transaction([
  prisma.task.create({ data: { ... } }),
  prisma.category.update({ where: { id: 1 }, data: { ... } }),
  prisma.user.delete({ where: { id: 1 } })
])

// インタラクティブトランザクション
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id: 1 } })
  
  if (user) {
    await tx.task.createMany({
      data: [
        { title: 'Task 1', userId: user.id, categoryId: 1 },
        { title: 'Task 2', userId: user.id, categoryId: 1 }
      ]
    })
  }
})
```

### 7. 便利な機能

```typescript
// upsert（存在すれば更新、なければ作成）
const category = await prisma.category.upsert({
  where: { 
    userId_name: { userId: 1, name: 'Work' }
  },
  update: {},
  create: {
    name: 'Work',
    userId: 1
  }
})

// connectOrCreate
const task = await prisma.task.create({
  data: {
    title: 'New Task',
    category: {
      connectOrCreate: {
        where: { id: 1 },
        create: { name: 'Default', userId: 1 }
      }
    }
  }
})

// createMany（複数一括作成）
await prisma.task.createMany({
  data: [
    { title: 'Task 1', userId: 1, categoryId: 1 },
    { title: 'Task 2', userId: 1, categoryId: 1 }
  ],
  skipDuplicates: true // ユニーク制約違反をスキップ
})
```

## エラーハンドリング

```typescript
try {
  await prisma.user.create({ data: { ... } })
} catch (error) {
  if (error.code === 'P2002') {
    // ユニーク制約違反
  } else if (error.code === 'P2025') {
    // レコードが見つからない
  }
}
```

## パフォーマンス最適化

```typescript
// N+1問題を避ける - include を使う
const users = await prisma.user.findMany({
  include: { tasks: true } // 1回のクエリでタスクも取得
})

// 必要なフィールドのみ取得
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true // passwordなど不要なフィールドは取得しない
  }
})
```

## 実際のアプリでの使い方

作成したAPI:
- `GET /api/categories` - カテゴリー一覧
- `POST /api/categories` - カテゴリー作成
- `PUT /api/categories/[id]` - カテゴリー更新
- `DELETE /api/categories/[id]` - カテゴリー削除
- `GET /api/tasks` - タスク一覧
- `POST /api/tasks` - タスク作成
- `GET /api/tasks/[id]` - タスク詳細
- `PUT /api/tasks/[id]` - タスク更新
- `DELETE /api/tasks/[id]` - タスク削除
- `GET /api/stats` - 統計情報

これらのAPIを使ってフロントエンドから呼び出せます！
