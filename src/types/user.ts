export type UserCategory = 'system_admin' | 'admin' | 'user'

export function isAdminCategory(category?: UserCategory): boolean {
  return category === 'system_admin' || category === 'admin'
}

export interface AppUser {
  id: string
  date: string
  category: UserCategory
  organization: string
  name: string
  email?: string
}
