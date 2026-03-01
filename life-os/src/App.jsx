import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './context/AuthContext.jsx'
import { getNextLevelXp } from './lib/gamification.js'
import { supabase } from './lib/supabase.js'
import { AuthPage } from './pages/AuthPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { ProfileSetupPage } from './pages/ProfileSetupPage.jsx'
import { TasksPage } from './pages/TasksPage.jsx'
import { FitnessPage } from './pages/FitnessPage.jsx'
import { GoalsPage } from './pages/GoalsPage.jsx'
import { FinancePage } from './pages/FinancePage.jsx'
import { ClientDirectoryPage } from './pages/ClientDirectoryPage.jsx'
import { ClientDetailPage } from './pages/ClientDetailPage.jsx'
import { DealsBoardPage } from './pages/DealsBoardPage.jsx'
import { FocusHistoryPage } from './pages/FocusHistoryPage.jsx'

function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="screen-center">Checking session...</div>
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}

function RequireProfile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        setHasProfile(false)
        setLoading(false)
        return
      }

      const fullName = data?.full_name?.trim()
      setHasProfile(Boolean(fullName))
      setLoading(false)
    }

    checkProfile()

    return () => {
      mounted = false
    }
  }, [user.id])

  if (loading) {
    return <div className="screen-center">Loading profile...</div>
  }

  if (!hasProfile) {
    return <Navigate to="/onboarding/profile" replace />
  }

  return <Outlet />
}

function HomeRedirect() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    let mounted = true

    const goToRightPage = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      const fullName = data?.full_name?.trim()
      navigate(fullName ? '/dashboard' : '/onboarding/profile', { replace: true })
    }

    goToRightPage()

    return () => {
      mounted = false
    }
  }, [navigate, user.id])

  return <div className="screen-center">Preparing your workspace...</div>
}

export default function App() {
  const [levelUpData, setLevelUpData] = useState(null)

  useEffect(() => {
    const onLevelUp = (event) => {
      setLevelUpData(event.detail || null)
    }

    window.addEventListener('lifeos:levelup', onLevelUp)
    return () => {
      window.removeEventListener('lifeos:levelup', onLevelUp)
    }
  }, [])

  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/onboarding/profile" element={<ProfileSetupPage />} />

          <Route element={<RequireProfile />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/fitness" element={<FitnessPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/focus-history" element={<FocusHistoryPage />} />
            <Route path="/clients" element={<ClientDirectoryPage />} />
            <Route path="/clients/:clientId" element={<ClientDetailPage />} />
            <Route path="/deals" element={<DealsBoardPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {levelUpData ? (
        <div className="levelup-backdrop" role="presentation" onClick={() => setLevelUpData(null)}>
          <section
            className="levelup-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Level Up</p>
            <h2>Nice work, you reached Level {levelUpData.level}!</h2>
            <p className="muted">
              Total XP: {levelUpData.xp}
              {getNextLevelXp(levelUpData.level)
                ? ` - Next level at ${getNextLevelXp(levelUpData.level)} XP`
                : ''}
            </p>
            <button type="button" className="primary-btn" onClick={() => setLevelUpData(null)}>
              Keep Grinding
            </button>
          </section>
        </div>
      ) : null}
    </>
  )
}
