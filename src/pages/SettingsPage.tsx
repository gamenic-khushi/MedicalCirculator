import { useState, type FormEvent } from 'react'

import { Toast } from '@/components/common/Toast'
import { useAuth } from '@/hooks/useAuth'

const TOAST_DURATION_MS = 1800

export function SettingsPage() {
  const { user, updateEmail, updatePassword } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [emailPassword, setEmailPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function showToast(message: string) {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await updateEmail(email, emailPassword)
      setEmailPassword('')
      showToast('メールアドレスを更新しました')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await updatePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      showToast('パスワードを更新しました')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      <div className="mt-4 border-b border-gray-200" />

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form
        onSubmit={handleEmailSubmit}
        className="mt-6 flex max-w-md flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-900">メールアドレス変更</h2>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          新しいメールアドレス
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          現在のパスワード
          <input
            type="password"
            required
            value={emailPassword}
            onChange={(event) => setEmailPassword(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          更新
        </button>
      </form>

      <form
        onSubmit={handlePasswordSubmit}
        className="mt-6 flex max-w-md flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-900">パスワード変更</h2>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          現在のパスワード
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          新しいパスワード
          <input
            type="password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          更新
        </button>
      </form>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
