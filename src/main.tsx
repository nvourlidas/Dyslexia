// src/main.tsx
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { applyTheme, getInitialTheme } from './theme/theme'
import { applyAppearance, loadAppearance } from './theme/appearance'

import { AuthProvider } from '@/auth/AuthProvider'
import ProtectedRoute from '@/auth/ProtectedRoute'
import AppShell from '@/layout/AppShell'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const StudentsPage = lazy(() => import('@/pages/StudentsPage'))
const TeachersPage = lazy(() => import('@/pages/TeachersPage'))
const ThemeSettingsPage = lazy(() => import('@/pages/ThemeSettingsPage'))
const SessionsPage = lazy(() => import('@/pages/SessionsPage'))
const AttendancePage = lazy(() => import('@/pages/AttendancePage'))
const ParapemptikaPage = lazy(() => import('@/pages/ParapemptikaPage'))
const DocOpinionPage = lazy(() => import('@/pages/DocOpinionPage'))
const PendingPage = lazy(() => import('@/pages/PendingPage'))

applyTheme(getInitialTheme())
applyAppearance(loadAppearance())

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'teachers', element: <TeachersPage /> },
      { path: 'parapeptika', element: <ParapemptikaPage /> },
      { path: 'doc-opinion', element: <DocOpinionPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'themesettings', element: <ThemeSettingsPage /> },
      { path: 'pending', element: <PendingPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen" />}>
        <RouterProvider router={router} />
      </Suspense>
    </AuthProvider>
  </React.StrictMode>,
)
