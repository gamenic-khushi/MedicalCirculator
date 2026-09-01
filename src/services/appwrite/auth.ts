import { ID, Query, type Models } from 'appwrite'

import type { UserCategory } from '@/types/user'

import { account } from './client'
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

async function toAppwriteUser(me: Models.User<Models.Preferences>): Promise<AppwriteUser> {
  return {
    $id: me.$id,
    email: me.email,
    name: me.name,
    category: await lookupCategory(me.email),
  }
}

export const authService = {
  /**
   * Self-registration: creates the account and logs in as it, replacing
   * whatever session is currently active.
   */
  async createAccount(email: string, password: string, name?: string): Promise<AppwriteUser> {
    await account.create(ID.unique(), email, password, name)
    return authService.login(email, password)
  },

  /**
   * Admin-driven creation: creates the account without touching the
   * caller's own session, so an admin can add a new user while staying
   * logged in as themselves.
   */
  async createAccountWithoutSession(
    email: string,
    password: string,
    name?: string,
  ): Promise<void> {
    await account.create(ID.unique(), email, password, name)
  },

  async login(email: string, password: string): Promise<AppwriteUser> {
    try {
      await account.deleteSession('current')
    } catch {
      // No active session to delete — that's fine
    }
    await account.createEmailPasswordSession(email, password)
    return toAppwriteUser(await account.get())
  },

  async logout(): Promise<void> {
    await account.deleteSession('current')
  },

  async getCurrentUser(): Promise<AppwriteUser | null> {
    try {
      return await toAppwriteUser(await account.get())
    } catch {
      return null
    }
  },

  async updateEmail(newEmail: string, password: string): Promise<AppwriteUser> {
    return toAppwriteUser(await account.updateEmail(newEmail, password))
  },

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await account.updatePassword(newPassword, currentPassword)
  },
}
