import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [goalWidget, setGoalWidget] = useState({ active: 0, overdue: 0, next: [] })

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      const [profileResult, goalsResult] = await Promise.all([
        supabase.from('profiles').select('full_name, timezone').eq('id', user.id).maybeSingle(),
        supabase
          .from('goals')
          .select('id, title, status, milestones(id, title, due_date, done)')
          .eq('user_id', user.id),
      ])

      if (!mounted) return

      setProfile(profileResult.data)

      const goals = goalsResult.data || []
      const active = goals.filter((goal) => goal.status === 'active').length
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const openMilestones = goals.flatMap((goal) =>
        (goal.milestones || [])
          .filter((m) => !m.done)
          .map((m) => ({ ...m, goalTitle: goal.title })),
      )

      const overdue = openMilestones.filter((m) => {
        if (!m.due_date) return false
        const due = new Date(m.due_date)
        due.setHours(0, 0, 0, 0)
        return due < today
      }).length

      const next = openMilestones
        .filter((m) => m.due_date)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 3)

      setGoalWidget({ active, overdue, next })
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
        <Link className="module-card link-card" to="/goals">
          Open goals planner
        </Link>
        <Link className="module-card link-card" to="/finance">
          Open finance tracker
        </Link>
        <Link className="module-card link-card" to="/fitness">
          Open fitness tracker
        </Link>
      </section>

      <section className="goal-widget">
        <div className="goal-widget-head">
          <p className="eyebrow">Goals Snapshot</p>
          <Link to="/goals" className="ghost-link">
            Open goals
          </Link>
        </div>
        <div className="goal-widget-stats">
          <p className="muted small-text">Active goals: {goalWidget.active}</p>
          <p className="muted small-text">Overdue milestones: {goalWidget.overdue}</p>
        </div>
        <div className="goal-widget-list">
          {goalWidget.next.length === 0 ? (
            <p className="muted small-text">No upcoming milestones.</p>
          ) : (
            goalWidget.next.map((item) => (
              <article key={item.id} className="goal-widget-item">
                <p className="task-title milestone-title">{item.title}</p>
                <p className="muted small-text">
                  {item.goalTitle} - Due {new Date(item.due_date).toLocaleDateString()}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
