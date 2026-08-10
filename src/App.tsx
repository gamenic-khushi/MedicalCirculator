import { AuthProvider } from '@/context/AuthContext'
import { Model3DProvider } from '@/context/Model3DContext'
import { AppRouter } from '@/routes/AppRouter'

function App() {
  return (
    <AuthProvider>
      <Model3DProvider>
        <AppRouter />
      </Model3DProvider>
    </AuthProvider>
  )
}

export default App
