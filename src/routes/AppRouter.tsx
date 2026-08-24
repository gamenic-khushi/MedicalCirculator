import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AdminRoute } from '@/components/layout/AdminRoute'
import { MainLayout } from '@/components/layout/MainLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { ConferencePage } from '@/pages/ConferencePage'
import { DataManagementPage } from '@/pages/DataManagementPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { FormulaSettingsPage } from '@/pages/FormulaSettingsPage'
import { LearningContentPage } from '@/pages/LearningContentPage'
import { LesionAnalysisPage } from '@/pages/LesionAnalysisPage'
import { LesionMeasurementPage } from '@/pages/LesionMeasurementPage'
import { LoginPage } from '@/pages/LoginPage'
import { LogoutPage } from '@/pages/LogoutPage'
import { ModelViewerErrorPage } from '@/pages/ModelViewerErrorPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { ThreeDAnalysisPage } from '@/pages/ThreeDAnalysisPage'
import { UserManagementPage } from '@/pages/UserManagementPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <NotificationsPage /> },
      { path: '3d-analysis', element: <ThreeDAnalysisPage /> },
      { path: 'conference', element: <ConferencePage /> },
      { path: 'documents', element: <DocumentsPage /> },
      {
        path: 'users',
        element: (
          <AdminRoute>
            <UserManagementPage />
          </AdminRoute>
        ),
      },
      {
        path: 'settings/formula',
        element: (
          <AdminRoute>
            <FormulaSettingsPage />
          </AdminRoute>
        ),
      },
      {
        path: 'data',
        element: (
          <AdminRoute>
            <DataManagementPage />
          </AdminRoute>
        ),
      },
      {
        path: 'data/learning-content',
        element: (
          <AdminRoute>
            <LearningContentPage />
          </AdminRoute>
        ),
      },
      {
        path: 'data/lesion-measurement',
        element: (
          <AdminRoute>
            <LesionMeasurementPage />
          </AdminRoute>
        ),
      },
      {
        path: 'data/lesion-measurement/analysis',
        element: (
          <AdminRoute>
            <LesionAnalysisPage />
          </AdminRoute>
        ),
      },
      {
        path: '3d-analysis/viewer',
        lazy: () =>
          import('@/pages/ModelViewerPage').then((module) => ({
            Component: module.ModelViewerPage,
          })),
        errorElement: <ModelViewerErrorPage />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/logout', element: <LogoutPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
