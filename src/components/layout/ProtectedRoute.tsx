import { Navigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
