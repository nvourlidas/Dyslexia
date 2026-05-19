// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { applyTheme, getInitialTheme } from './theme/theme'
import { applyAppearance, loadAppearance } from './theme/appearance'

import { AuthProvider } from '@/auth/AuthProvider'
import ProtectedRoute from '@/auth/ProtectedRoute'

import AppShell from '@/layout/AppShell'

// pages
import LoginPage from '@/pages/LoginPage'
import Dashboard from '@/pages/Dashboard'
import StudentsPage from '@/pages/StudentsPage'
import TeachersPage from '@/pages/TeachersPage'
import ThemeSettingsPage from '@/pages/ThemeSettingsPage'
import SessionsPage from '@/pages/SessionsPage'
import AttendancePage from '@/pages/AttendancePage'
import ParapemptikaPage from '@/pages/ParapemptikaPage'
import DocOpinionPage from '@/pages/DocOpinionPage'
import PendingPage from '@/pages/PendingPage'

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
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
)
