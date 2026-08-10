export type UserCategory =
  'system_admin' | 'learning_admin' | 'learning_user' | 'hospital_admin' | 'hospital_user'

export interface AppUser {
  id: string
  date: string
  category: UserCategory
  organization: string
  name: string
  email?: string
}
