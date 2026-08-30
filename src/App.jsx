import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { supabase } from './lib/supabase'
import LoginOverlay from './components/ui/LoginOverlay'
import AdminLayout from './pages/admin/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import StudentsPage from './pages/admin/StudentsPage'
import AttendancePage from './pages/admin/AttendancePage'
import HistoryPage from './pages/admin/HistoryPage'
import ExamsPage from './pages/admin/ExamsPage'
import StudentPortalLayout from './pages/student/StudentPortalLayout'
import MyStatusPage from './pages/student/MyStatusPage'
import MyPaymentsPage from './pages/student/MyPaymentsPage'
import MyExamPage from './pages/student/MyExamPage'
import MyAttendancePage from './pages/student/MyAttendancePage'
import SchedulePage from './pages/student/SchedulePage'
import PaymentResultPage from './pages/student/PaymentResultPage'
import Toast from './components/ui/Toast'

function AuthWatcher() {
  const { setUser, setProfile } = useAppStore()
  const navigate = useNavigate()

  async function fetchAndSetProfile(userId, email) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      
      let currentRole = data?.role
      
      // Si es el creador/dueño o tiene rol admin en la DB
      if (email === 'aandres.moreno3@gmail.com' || currentRole === 'admin') {
        currentRole = 'admin'
        if (!data || data.role !== 'admin') {
          await supabase.from('profiles').upsert({ id: userId, role: 'admin' })
        }
      } else if (!data) {
        await supabase.from('profiles').upsert({ id: userId, role: 'alumno' })
        currentRole = 'alumno'
      }

      const activeProfile = { id: userId, role: currentRole, ...(data || {}) }
      setProfile(activeProfile)

      if (currentRole === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/portal/status', { replace: true })
      }
      return activeProfile
    } catch (e) {
      console.error('Error fetching profile:', e)
      if (email === 'aandres.moreno3@gmail.com') {
        setProfile({ id: userId, role: 'admin' })
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/portal/status', { replace: true })
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        await fetchAndSetProfile(session.user.id, session.user.email)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchAndSetProfile(session.user.id, session.user.email)
      } else {
        setUser(null)
        setProfile(null)
        navigate('/admin/dashboard', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [])
  return null
}

export default function App() {
  const { user } = useAppStore()

  return (
    <BrowserRouter>
      <AuthWatcher />
      <Toast />

      {/* Login overlay — siempre encima cuando no hay sesion, igual que el original */}
      {!user && <LoginOverlay />}

      {/* App siempre renderizada detras (se ve borrosa bajo el login) */}
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="exams" element={<ExamsPage />} />
        </Route>

        <Route path="/portal" element={user ? <StudentPortalLayout /> : <AdminLayout />}>
          <Route index element={<Navigate to="status" replace />} />
          <Route path="status" element={<MyStatusPage />} />
          <Route path="payments" element={<MyPaymentsPage />} />
          <Route path="exam" element={<MyExamPage />} />
          <Route path="attendance" element={<MyAttendancePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="payment-result" element={<PaymentResultPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
