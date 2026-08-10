import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RowActionIcons } from '@/components/common/RowActionIcons'
import type { AppUser, UserCategory } from '@/types/user'

import { UserCategoryBadge } from './UserCategoryBadge'
import { UserFormModal } from './UserFormModal'
import { UserPreviewModal } from './UserPreviewModal'

interface UserEditData {
  category: UserCategory
  organization: string
  name: string
  email: string
}

interface UserTableProps {
  users: AppUser[]
  organizations: string[]
  onEdit: (id: string, data: UserEditData) => void
  onDelete: (id: string) => void
  onDuplicate: (user: AppUser) => void
}

export function UserTable({ users, organizations, onEdit, onDelete, onDuplicate }: UserTableProps) {
  const [previewing, setPreviewing] = useState<AppUser | null>(null)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
        該当するユーザーが見つかりません
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-medium text-gray-500">
              <th className="w-44 px-8 py-3">日付</th>
              <th className="w-48 px-8 py-3">ユーザーカテゴリー</th>
              <th className="w-64 px-8 py-3">組織</th>
              <th className="px-8 py-3">名前</th>
              <th className="w-40 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-100">
                <td className="px-8 py-4 text-gray-500">{user.date}</td>
                <td className="px-8 py-4">
                  <UserCategoryBadge category={user.category} />
                </td>
                <td className="px-8 py-4 text-gray-900">{user.organization}</td>
                <td className="px-8 py-4 text-gray-900">{user.name}</td>
                <td className="px-6 py-4">
                  <RowActionIcons
                    copyText={`${window.location.origin}/users/${user.id}`}
                    onView={() => setPreviewing(user)}
                    onEdit={() => setEditing(user)}
                    onDelete={() => setPendingDeleteId(user.id)}
                    onDuplicate={() => onDuplicate(user)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewing && (
        <UserPreviewModal
          user={previewing}
          organizations={organizations}
          onClose={() => setPreviewing(null)}
          onSave={(data) =>
            onEdit(previewing.id, {
              category: data.category,
              organization: data.organization,
              name: previewing.name,
              email: previewing.email ?? '',
            })
          }
        />
      )}

      {editing && (
        <UserFormModal
          title="編集"
          organizations={organizations}
          initialUser={{
            category: editing.category,
            organization: editing.organization,
            name: editing.name,
            email: editing.email ?? '',
          }}
          onClose={() => setEditing(null)}
          onSave={(data) => onEdit(editing.id, data)}
        />
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          message="本当に削除しますか？"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            onDelete(pendingDeleteId)
            setPendingDeleteId(null)
          }}
        />
      )}
    </div>
  )
}
