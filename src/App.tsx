import { AuthProvider } from '@/context/AuthContext'
import { Model3DProvider } from '@/context/Model3DContext'
import { ViewerStateProvider } from '@/context/ViewerStateContext'
import { AppRouter } from '@/routes/AppRouter'

function App() {
  return (
    <AuthProvider>
      <Model3DProvider>
        <ViewerStateProvider>
          <AppRouter />
        </ViewerStateProvider>
      </Model3DProvider>
    </AuthProvider>
  )
}

export default App
