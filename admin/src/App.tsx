import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import AdminLayout   from '@/components/layout/AdminLayout'
import LoginPage     from '@/pages/LoginPage'
import ClientsPage   from '@/pages/ClientsPage'
import SiteDetailPage from '@/pages/SiteDetailPage'
import LeadsPage     from '@/pages/LeadsPage'
import SessionsPage  from '@/pages/SessionsPage'
import DashboardPage from '@/pages/DashboardPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/clients" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
      <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/clients" replace />} />
        <Route path="clients"     element={<ClientsPage />} />
        <Route path="clients/:id" element={<SiteDetailPage />} />
        <Route path="leads"       element={<LeadsPage />} />
        <Route path="sessions"    element={<SessionsPage />} />
        <Route path="dashboard"   element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/clients" replace />} />
    </Routes>
  )
}
