export type UserCategory =
  'system_admin' | 'learning_admin' | 'learning_user' | 'hospital_admin' | 'hospital_user'

const ADMIN_CATEGORIES: UserCategory[] = ['system_admin', 'hospital_admin', 'learning_admin']

export function isAdminCategory(category?: UserCategory): boolean {
  return !!category && ADMIN_CATEGORIES.includes(category)
}

export interface AppUser {
  id: string
  date: string
  category: UserCategory
  organization: string
  name: string
  email?: string
}
