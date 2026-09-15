import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { authService } from '@/services/appwrite/auth'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const [isSendingRecovery, setIsSendingRecovery] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRecoverySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSendingRecovery(true)
    try {
      await authService.createRecovery(recoveryEmail.trim())
      setRecoveryMessage('パスワード再設定用のメールを送信しました。メールをご確認ください。')
    } catch (err) {
      console.error(err)
      setRecoveryMessage('送信に失敗しました。メールアドレスをご確認のうえ、もう一度お試しください。')
    } finally {
      setIsSendingRecovery(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">ログイン</h1>
        <p className="mt-2 text-sm text-gray-500">
          メールアドレスとパスワードでログインしてください。
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="example@example.com"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              パスワード
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="パスワード"
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsRecovering((value) => !value)
            setRecoveryMessage(null)
          }}
          className="mt-4 text-sm font-medium text-indigo-600 hover:underline"
        >
          パスワードをお忘れですか？
        </button>

        {isRecovering && (
          <form onSubmit={handleRecoverySubmit} className="mt-4 space-y-3 rounded-2xl bg-gray-50 p-4">
            <label className="block text-sm font-medium text-gray-700">
              登録済みのメールアドレス
              <input
                type="email"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="example@example.com"
              />
            </label>
            {recoveryMessage && <p className="text-sm text-gray-600">{recoveryMessage}</p>}
            <button
              type="submit"
              disabled={isSendingRecovery}
              className="w-full rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSendingRecovery ? '送信中...' : '再設定メールを送信'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
