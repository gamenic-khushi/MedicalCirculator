import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { authService, type AppwriteUser } from '@/services/appwrite'

import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppwriteUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authService
      .getCurrentUser()
      .then(setUser)
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setUser(await authService.login(email, password))
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setUser(await authService.createAccount(email, password, name))
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const updateEmail = useCallback(async (newEmail: string, password: string) => {
    setUser(await authService.updateEmail(newEmail, password))
  }, [])

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authService.updatePassword(currentPassword, newPassword)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, updateEmail, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}
