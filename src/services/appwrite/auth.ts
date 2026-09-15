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

async function lookupCategory(accountId: string, email: string): Promise<UserCategory | undefined> {
  try {
    type UserRow = Models.Row & { category?: UserCategory }
    const byAccountId = await databaseService.list<UserRow>('users', [
      Query.equal('accountId', accountId),
      Query.limit(1),
    ])
    if (byAccountId.rows[0]) return byAccountId.rows[0].category

    // Rows created before accountId linkage existed only match by email.
    const byEmail = await databaseService.list<UserRow>('users', [
      Query.equal('email', email),
      Query.limit(1),
    ])
    return byEmail.rows[0]?.category
  } catch {
    return undefined
  }
}

async function toAppwriteUser(me: Models.User<Models.Preferences>): Promise<AppwriteUser> {
  return {
    $id: me.$id,
    email: me.email,
    name: me.name,
    category: await lookupCategory(me.$id, me.email),
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
   * logged in as themselves. Returns the created account so the caller can
   * link its $id onto the corresponding `users` table row.
   */
  async createAccountWithoutSession(
    email: string,
    password: string,
    name?: string,
  ): Promise<Models.User<Models.Preferences>> {
    return account.create(ID.unique(), email, password, name)
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

  async createRecovery(email: string): Promise<void> {
    await account.createRecovery(email, `${window.location.origin}/reset-password`)
  },

  async confirmRecovery(userId: string, secret: string, newPassword: string): Promise<void> {
    await account.updateRecovery(userId, secret, newPassword)
  },
}
