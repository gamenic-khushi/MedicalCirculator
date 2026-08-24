import type { UserCategory } from '@/types/user'

export const CATEGORY_CONFIG: Record<UserCategory, { label: string; className: string }> = {
  system_admin: { label: 'システム管理者', className: 'bg-red-100 text-red-700' },
  hospital_admin: { label: '病院管理者', className: 'bg-blue-50 text-blue-600' },
  hospital_user: { label: '病院一般ユーザー', className: 'bg-sky-50 text-sky-600' },
  learning_admin: { label: '学習管理者', className: 'bg-violet-50 text-violet-600' },
  learning_user: { label: '学習一般ユーザー', className: 'bg-teal-50 text-teal-600' },
}

export const CATEGORY_PILL_CLASSES: Record<UserCategory, string> = {
  system_admin: 'bg-red-500',
  hospital_admin: 'bg-blue-500',
  hospital_user: 'bg-sky-400',
  learning_admin: 'bg-violet-500',
  learning_user: 'bg-teal-400',
}
