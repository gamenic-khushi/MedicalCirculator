import { useState } from 'react'

import { Modal } from '@/components/common/Modal'
import type { AppUser, UserCategory } from '@/types/user'

import { CategorySelect } from './CategorySelect'
import { OrganizationSelect } from './OrganizationSelect'

interface UserPreviewModalProps {
  user: AppUser
  organizations: string[]
  onClose: () => void
  onSave: (data: { category: UserCategory; organization: string }) => void
}

export function UserPreviewModal({ user, organizations, onClose, onSave }: UserPreviewModalProps) {
  const [category, setCategory] = useState(user.category)
  const [organization, setOrganization] = useState(user.organization)

  function handleSave() {
    onSave({ category, organization })
    onClose()
  }

  return (
    <Modal title="ビュー" onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          ユーザーカテゴリー
          <CategorySelect value={category} onChange={setCategory} />
        </div>

        <div className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          組織
          <OrganizationSelect
            value={organization}
            organizations={organizations}
            onChange={setOrganization}
          />
        </div>

        <div className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          名前
          <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900">{user.name}</div>
        </div>

        <div className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          メール
          <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900">
            {user.email || '-'}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
  )
}
