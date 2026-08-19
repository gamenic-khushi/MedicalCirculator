import { Link } from 'react-router-dom'

import logo from '@/assets/image/logo.png'

export function Logo() {
  return (
    <Link to="/" className="shrink-0">
      <img src={logo} alt="Medical Circulator" className="h-9 w-9 object-contain" />
    </Link>
  )
}
