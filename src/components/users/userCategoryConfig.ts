import type { UserCategory } from '@/types/user'

export const CATEGORY_CONFIG: Record<UserCategory, { label: string; className: string }> = {
  system_admin: { label: 'システム管理者', className: 'bg-red-100 text-red-700' },
  learning_admin: { label: '学習管理者', className: 'bg-rose-50 text-rose-600' },
  learning_user: { label: '学習一般ユーザー', className: 'bg-pink-50 text-pink-600' },
  hospital_admin: { label: '病院管理者', className: 'bg-blue-50 text-blue-600' },
  hospital_user: { label: '病院一般ユーザー', className: 'bg-sky-50 text-sky-600' },
}

export const CATEGORY_PILL_CLASSES: Record<UserCategory, string> = {
  system_admin: 'bg-red-500',
  learning_admin: 'bg-rose-400',
  learning_user: 'bg-pink-400',
  hospital_admin: 'bg-blue-500',
  hospital_user: 'bg-sky-400',
}
