export type UserCategory =
  'system_admin' | 'hospital_admin' | 'hospital_user' | 'learning_admin' | 'learning_user'

export function isAdminCategory(category?: UserCategory): boolean {
  return (
    category === 'system_admin' || category === 'hospital_admin' || category === 'learning_admin'
  )
}

export interface AppUser {
  id: string
  date: string
  category: UserCategory
  organization: string
  name: string
  email?: string
}
