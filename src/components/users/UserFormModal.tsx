import { useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'
import type { UserCategory } from '@/types/user'

import { CategorySelect } from './CategorySelect'
import { OrganizationSelect } from './OrganizationSelect'

interface UserFormData {
  category: UserCategory
  organization: string
  name: string
  email: string
}

interface UserFormModalProps {
  title: string
  organizations: string[]
  initialUser?: UserFormData
  onClose: () => void
  onSave: (data: UserFormData) => void
}

export function UserFormModal({
  title,
  organizations,
  initialUser,
  onClose,
  onSave,
}: UserFormModalProps) {
  const [category, setCategory] = useState<UserCategory>(initialUser?.category ?? 'hospital_admin')
  const [organization, setOrganization] = useState(
    initialUser?.organization ?? organizations[0] ?? '',
  )
  const [name, setName] = useState(initialUser?.name ?? '')
  const [email, setEmail] = useState(initialUser?.email ?? '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!organization.trim() || !name.trim()) return
    onSave({ category, organization: organization.trim(), name: name.trim(), email: email.trim() })
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          ユーザーカテゴリー
          <CategorySelect value={category} onChange={setCategory} />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          組織
          <OrganizationSelect
            value={organization}
            organizations={organizations}
            onChange={setOrganization}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          名前
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          メール
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {initialUser ? '保存' : '登録'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
