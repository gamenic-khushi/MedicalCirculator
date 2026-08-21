import { Query, type Models } from 'appwrite'

import type { UserCategory } from '@/types/user'

import { databaseService } from './database'

export interface AppwriteUser {
  $id: string
  email: string
  name?: string
  category?: UserCategory
}

async function lookupCategory(email: string): Promise<UserCategory | undefined> {
  try {
    const { rows } = await databaseService.list<Models.Row & { category?: UserCategory }>('users', [
      Query.equal('email', email),
      Query.limit(1),
    ])
    return rows[0]?.category
  } catch {
    return undefined
  }
}

const USERS_KEY = 'testAuthUsers'
const CURRENT_USER_KEY = 'testAuthCurrentUser'

const DEFAULT_TEST_USERS = [
  { $id: 'test-user', email: 'test@example.com', name: 'Test User', password: 'password' },
  { $id: 'test-admin', email: 'admin@example.com', name: 'Admin', password: 'password' },
  { $id: 'test-staff', email: 'staff@example.com', name: 'Staff', password: 'password' },
]

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return DEFAULT_TEST_USERS
    return JSON.parse(raw) as Array<(typeof DEFAULT_TEST_USERS)[number]>
  } catch {
    return DEFAULT_TEST_USERS
  }
}

function saveStoredUsers(users: Array<(typeof DEFAULT_TEST_USERS)[number]>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function setCurrentUser(user: AppwriteUser | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(CURRENT_USER_KEY)
  }
}

function getCurrentUserFromStorage(): AppwriteUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppwriteUser
  } catch {
    return null
  }
}

export const authService = {
  async createAccount(email: string, password: string, name?: string): Promise<AppwriteUser> {
    const users = getStoredUsers()
    const existing = users.find((user) => user.email === email)
    if (existing) {
      throw new Error('既に同じメールアドレスのアカウントが存在します。')
    }

    const newUser = {
      $id: `user-${Date.now()}`,
      email,
      name: name ?? email,
      password,
    }

    saveStoredUsers([...users, newUser])
    return authService.login(email, password)
  },

  async login(email: string, password: string): Promise<AppwriteUser> {
    const users = getStoredUsers()
    const found = users.find((user) => user.email === email && user.password === password)
    if (!found) {
      throw new Error('認証に失敗しました。')
    }

    const currentUser: AppwriteUser = {
      $id: found.$id,
      email: found.email,
      name: found.name,
      category: await lookupCategory(found.email),
    }

    setCurrentUser(currentUser)
    return currentUser
  },

  async logout(): Promise<void> {
    setCurrentUser(null)
  },

  async getCurrentUser(): Promise<AppwriteUser | null> {
    const stored = getCurrentUserFromStorage()
    if (!stored) return null
    return { ...stored, category: await lookupCategory(stored.email) }
  },
}
