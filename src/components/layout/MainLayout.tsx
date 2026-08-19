import { Outlet } from 'react-router-dom'

import { Header } from './Header'

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
