import type { Models } from 'appwrite'
import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { UserFormModal } from '@/components/users/UserFormModal'
import { UserTable } from '@/components/users/UserTable'
import { databaseService } from '@/services/appwrite/database'
import type { AppUser, UserCategory } from '@/types/user'

type UserRow = Models.Row & Omit<AppUser, 'id'>

interface UserFormData {
  category: UserCategory
  organization: string
  name: string
  email: string
}

function todayDisplayDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}/${month}/${day}`
}

export function UserManagementPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [query, setQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    databaseService.list<UserRow>('users').then(({ rows }) => {
      setUsers(rows.map(({ $id, ...rest }) => ({ id: $id, ...rest })))
    })
  }, [])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalized) ||
        user.organization.toLowerCase().includes(normalized),
    )
  }, [users, query])

  const organizations = useMemo(
    () => Array.from(new Set(users.map((user) => user.organization))),
    [users],
  )

  async function handleAdd(data: UserFormData) {
    const row = await databaseService.create<UserRow>('users', {
      date: todayDisplayDate(),
      ...data,
    })
    const { $id, ...rest } = row
    setUsers((prev) => [{ id: $id, ...rest }, ...prev])
  }

  async function handleEdit(id: string, data: UserFormData) {
    await databaseService.update<UserRow>('users', id, data)
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, ...data } : user)))
  }

  async function handleDelete(id: string) {
    await databaseService.remove('users', id)
    setUsers((prev) => prev.filter((user) => user.id !== id))
  }

  async function handleDuplicate(user: AppUser) {
    const row = await databaseService.create<UserRow>('users', {
      date: todayDisplayDate(),
      category: user.category,
      organization: user.organization,
      name: user.name,
      email: user.email,
    })
    const { $id, ...rest } = row
    setUsers((prev) => {
      const index = prev.findIndex((item) => item.id === user.id)
      const next = [...prev]
      next.splice(index + 1, 0, { id: $id, ...rest })
      return next
    })
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white transition hover:from-blue-700 hover:to-indigo-700"
            title="ユーザーを追加"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="検索"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="mt-6">
        <UserTable
          users={filteredUsers}
          organizations={organizations}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      </div>

      {isAdding && (
        <UserFormModal
          title="ユーザー登録"
          organizations={organizations}
          onClose={() => setIsAdding(false)}
          onSave={handleAdd}
        />
      )}
    </div>
  )
}
