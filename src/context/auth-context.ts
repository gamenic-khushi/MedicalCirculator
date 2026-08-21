import { createContext } from 'react'

import type { AppwriteUser } from '@/services/appwrite'

export interface AuthContextValue {
  user: AppwriteUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  updateEmail: (newEmail: string, password: string) => Promise<void>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
