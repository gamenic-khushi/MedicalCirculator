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

interface NewUserFormData extends UserFormData {
  password: string
}

interface UserFormModalProps {
  title: string
  organizations: string[]
  initialUser?: UserFormData
  onClose: () => void
  onSave: (data: UserFormData | NewUserFormData) => Promise<void> | void
}

export function UserFormModal({
  title,
  organizations,
  initialUser,
  onClose,
  onSave,
}: UserFormModalProps) {
  const isNewUser = !initialUser
  const [category, setCategory] = useState<UserCategory>(initialUser?.category ?? 'hospital_admin')
  const [organization, setOrganization] = useState(
    initialUser?.organization ?? organizations[0] ?? '',
  )
  const [name, setName] = useState(initialUser?.name ?? '')
  const [email, setEmail] = useState(initialUser?.email ?? '')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!organization.trim() || !name.trim()) return
    if (isNewUser && (!email.trim() || password.length < 8)) return

    setError(null)
    setIsSubmitting(true)
    try {
      const data: UserFormData | NewUserFormData = isNewUser
        ? {
            category,
            organization: organization.trim(),
            name: name.trim(),
            email: email.trim(),
            password,
          }
        : { category, organization: organization.trim(), name: name.trim(), email: email.trim() }
      await onSave(data)
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'アカウントの作成に失敗しました。',
      )
    } finally {
      setIsSubmitting(false)
    }
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
            required={isNewUser}
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        {isNewUser && (
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              placeholder="8文字以上"
              className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="text-xs font-normal text-gray-400">
              このアカウントでログインするためのパスワードです。
            </span>
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '処理中...' : initialUser ? '保存' : '登録'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
