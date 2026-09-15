import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { authService } from '@/services/appwrite/auth'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const userId = searchParams.get('userId') ?? ''
  const secret = searchParams.get('secret') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。')
      return
    }
    if (!userId || !secret) {
      setError('リンクが無効です。もう一度パスワード再設定をリクエストしてください。')
      return
    }

    setIsSubmitting(true)
    try {
      await authService.confirmRecovery(userId, secret, password)
      setIsDone(true)
    } catch (err) {
      console.error(err)
      setError('パスワードの再設定に失敗しました。リンクの有効期限が切れている可能性があります。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">パスワードの再設定</h1>

        {isDone ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-gray-600">パスワードを再設定しました。</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-indigo-700"
            >
              ログイン画面へ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                新しいパスワード
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="8文字以上"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                新しいパスワード（確認）
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-indigo-500"
                />
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? '送信中...' : 'パスワードを再設定'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
