// Prisma APIとの連携サービス

export const apiService = {
  // 認証トークンを取得
  getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  },

  // カテゴリー関連
  async getCategories() {
    const res = await fetch('/api/categories', {
      headers: this.getAuthHeader()
    })
    if (!res.ok) throw new Error('カテゴリーの取得に失敗しました')
    return res.json()
  },

  async createCategory(name: string) {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'カテゴリーの作成に失敗しました')
    }
    return res.json()
  },

  async updateCategory(id: number, name: string) {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ name })
    })
    if (!res.ok) throw new Error('カテゴリーの更新に失敗しました')
    return res.json()
  },

  async deleteCategory(id: number) {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeader()
    })
    if (!res.ok) throw new Error('カテゴリーの削除に失敗しました')
    return res.json()
  },

  // タスク関連
  async getTasks(categoryId?: number, status?: string) {
    const params = new URLSearchParams()
    if (categoryId) params.append('categoryId', categoryId.toString())
    if (status) params.append('status', status)
    
    const res = await fetch(`/api/tasks?${params}`, {
      headers: this.getAuthHeader()
    })
    if (!res.ok) throw new Error('タスクの取得に失敗しました')
    return res.json()
  },

  async createTask(data: {
    title: string
    categoryId: number
    status?: string
    estimatedHours?: number
    dueDate?: string
  }) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'タスクの作成に失敗しました')
    }
    return res.json()
  },

  async updateTask(id: string, data: {
    title?: string
    status?: string
    estimatedHours?: number
    actualHours?: number
    isWorking?: boolean
    workStartTime?: string | null
    dueDate?: string | null
  }) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('タスクの更新に失敗しました')
    return res.json()
  },

  async deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeader()
    })
    if (!res.ok) throw new Error('タスクの削除に失敗しました')
    return res.json()
  },

  async getStats() {
    const res = await fetch('/api/stats', {
      headers: this.getAuthHeader()
    })
    if (!res.ok) throw new Error('統計情報の取得に失敗しました')
    return res.json()
  }
}
