import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { isAdminCategory } from '@/types/user'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  if (!isAdminCategory(user?.category)) {
    return <Navigate to="/" replace />
  }

  return children
}
