import { MotionConfig } from 'motion/react'

import { UpdateBanner } from '@/components/common/UpdateBanner'
import { AuthProvider } from '@/context/AuthContext'
import { Model3DProvider } from '@/context/Model3DContext'
import { ViewerStateProvider } from '@/context/ViewerStateContext'
import { AppRouter } from '@/routes/AppRouter'

function App() {
  return (
    // "user": screens set to reduce motion keep the fades but lose all movement and scaling.
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <Model3DProvider>
          <ViewerStateProvider>
            <AppRouter />
            <UpdateBanner />
          </ViewerStateProvider>
        </Model3DProvider>
      </AuthProvider>
    </MotionConfig>
  )
}

export default App
