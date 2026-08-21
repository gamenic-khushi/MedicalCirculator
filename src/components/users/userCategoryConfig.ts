import type { UserCategory } from '@/types/user'

export const CATEGORY_CONFIG: Record<UserCategory, { label: string; className: string }> = {
  system_admin: { label: 'システム管理者', className: 'bg-red-100 text-red-700' },
  admin: { label: '管理者', className: 'bg-blue-50 text-blue-600' },
  user: { label: '一般ユーザー', className: 'bg-sky-50 text-sky-600' },
}

export const CATEGORY_PILL_CLASSES: Record<UserCategory, string> = {
  system_admin: 'bg-red-500',
  admin: 'bg-blue-500',
  user: 'bg-sky-400',
}
