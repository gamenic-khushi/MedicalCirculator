import type { UserCategory } from '@/types/user'

import { CATEGORY_CONFIG } from './userCategoryConfig'

export function UserCategoryBadge({ category }: { category: UserCategory }) {
  const { label, className } = CATEGORY_CONFIG[category]

  return (
    <span
      className={`inline-block w-fit shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
