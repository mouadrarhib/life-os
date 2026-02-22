import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './context/AuthContext.jsx'
import { supabase } from './lib/supabase.js'
import { AuthPage } from './pages/AuthPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { ProfileSetupPage } from './pages/ProfileSetupPage.jsx'
import { TasksPage } from './pages/TasksPage.jsx'
import { FitnessPage } from './pages/FitnessPage.jsx'
import { GoalsPage } from './pages/GoalsPage.jsx'

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
  return (
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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
