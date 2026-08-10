import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'

export function LogoutPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    void (async () => {
      await logout()
      navigate('/login', { replace: true })
    })()
  }, [logout, navigate])

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">ログアウト中...</h1>
        <p className="mt-3 text-sm text-gray-500">セッションを終了し、ログインページに戻ります。</p>
      </div>
    </div>
  )
}
