import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { useModel3D } from '@/hooks/useModel3D'

export function LogoutPage() {
  const { logout } = useAuth()
  const { setModel } = useModel3D()
  const navigate = useNavigate()

  useEffect(() => {
    void (async () => {
      await logout()
      setModel(null)
      navigate('/login', { replace: true })
    })()
  }, [logout, setModel, navigate])

  return null
}
