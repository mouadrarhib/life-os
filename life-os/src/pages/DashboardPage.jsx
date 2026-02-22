import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, timezone')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      setProfile(data)
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [user.id])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <main className="dashboard-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Hello, {profile?.full_name || 'there'}</h1>
          <p className="muted">Timezone: {profile?.timezone || 'UTC'}</p>
        </div>

        <button type="button" className="primary-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </section>

      <section className="module-grid">
        <Link className="module-card link-card" to="/tasks">
          Open tasks board
        </Link>
        <article className="module-card">Goals module coming next</article>
        <article className="module-card">Finance module coming next</article>
        <Link className="module-card link-card" to="/fitness">
          Open fitness tracker
        </Link>
      </section>
    </main>
  )
}
