import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

function toLocalDateString(date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function calculateStreak(activityDateValues) {
  const dateSet = new Set(activityDateValues.filter(Boolean))
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const key = toLocalDateString(cursor)
    if (!dateSet.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [agendaTasks, setAgendaTasks] = useState([])
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [todayWorkoutExercises, setTodayWorkoutExercises] = useState([])
  const [sevenDaySpending, setSevenDaySpending] = useState(0)
  const [streakDays, setStreakDays] = useState(0)
  const [xpTotal, setXpTotal] = useState(0)
  const [level, setLevel] = useState(1)
  const [loadingWidgets, setLoadingWidgets] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let mounted = true

    const loadDashboard = async () => {
      setLoadingWidgets(true)

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)
      const sevenDaysAgo = new Date(todayStart)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

      const [
        profileResult,
        tasksResult,
        workoutsResult,
        transactionsResult,
        streakWorkoutsResult,
        streakTransactionsResult,
      ] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, timezone, xp_total, level')
            .eq('id', user.id)
            .maybeSingle(),
        supabase
          .from('tasks')
          .select('id, title, status, due_at, done_at')
          .eq('user_id', user.id),
        supabase
          .from('workouts')
          .select('id, title, workout_date, note')
          .eq('user_id', user.id)
          .eq('workout_date', toLocalDateString(todayStart))
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('transactions')
          .select('id, amount, date, categories(type)')
          .eq('user_id', user.id)
          .gte('date', toLocalDateString(sevenDaysAgo))
          .lte('date', toLocalDateString(todayStart))
          .order('date', { ascending: false }),
          supabase
            .from('workouts')
            .select('workout_date')
            .eq('user_id', user.id),
          supabase
            .from('transactions')
            .select('date')
            .eq('user_id', user.id),
        ])

      if (!mounted) return

      const firstError = [
        profileResult,
        tasksResult,
        workoutsResult,
        transactionsResult,
        streakWorkoutsResult,
        streakTransactionsResult,
      ].find(
        (result) => result.error,
      )

      if (firstError) {
        setErrorMessage(firstError.error.message)
        setLoadingWidgets(false)
        return
      }

      setProfile(profileResult.data)
      setXpTotal(Number(profileResult.data?.xp_total || 0))
      setLevel(Number(profileResult.data?.level || 1))

      const allTasks = tasksResult.data || []
      const todaysAgenda = allTasks
        .filter((task) => {
          if (task.status && task.status !== 'todo') return false
          if (!task.due_at) return false
          const due = new Date(task.due_at)
          return due >= todayStart && due < tomorrowStart
        })
        .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      setAgendaTasks(todaysAgenda)

      const todaysWorkout = (workoutsResult.data || [])[0] || null
      setTodayWorkout(todaysWorkout)

      if (todaysWorkout) {
        const { data: exercisesData, error: exercisesError } = await supabase
          .from('workout_exercises')
          .select('exercise:exercises(name)')
          .eq('workout_id', todaysWorkout.id)
          .order('order_index', { ascending: true })

        if (mounted) {
          if (exercisesError) {
            setErrorMessage(exercisesError.message)
            setTodayWorkoutExercises([])
          } else {
            setTodayWorkoutExercises((exercisesData || []).map((row) => row.exercise?.name).filter(Boolean))
          }
        }
      } else {
        setTodayWorkoutExercises([])
      }

      const expenseTotal = (transactionsResult.data || [])
        .filter((item) => item.categories?.type === 'expense')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)
      setSevenDaySpending(expenseTotal)

      const activityDates = [
        ...(allTasks || []).map((task) => (task.done_at ? toLocalDateString(new Date(task.done_at)) : null)),
        ...((streakWorkoutsResult.data || []).map((item) => item.workout_date) || []),
        ...((streakTransactionsResult.data || []).map((item) => item.date) || []),
      ]

      setStreakDays(calculateStreak(activityDates))

      setErrorMessage('')
      setLoadingWidgets(false)
    }

    loadDashboard()

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
          <div className="title-row">
            <h1>Hello, {profile?.full_name || 'there'}</h1>
            <p className="streak-pill">🔥 {streakDays} day streak</p>
          </div>
          <p className="muted">Timezone: {profile?.timezone || 'UTC'}</p>
          <p className="muted small-text">Level {level} • XP {xpTotal}</p>
        </div>

        <button type="button" className="primary-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </section>

      {errorMessage ? <p className="message error">{errorMessage}</p> : null}

      {loadingWidgets ? <p className="muted">Loading command center...</p> : null}

      {!loadingWidgets ? (
        <section className="command-grid">
          <article className="panel command-widget">
            <div className="goal-widget-head">
              <p className="eyebrow">Today's Agenda</p>
              <Link to="/tasks" className="ghost-link">
                Open tasks
              </Link>
            </div>
            <p className="muted small-text">To do today: {agendaTasks.length}</p>
            <div className="widget-list">
              {agendaTasks.length === 0 ? (
                <p className="muted">No tasks due today.</p>
              ) : (
                agendaTasks.slice(0, 5).map((task) => (
                  <article key={task.id} className="goal-widget-item">
                    <p className="task-title">{task.title}</p>
                    <p className="muted small-text">
                      Due {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </article>
                ))
              )}
            </div>
          </article>

          <article className="panel command-widget">
            <div className="goal-widget-head">
              <p className="eyebrow">Daily Training</p>
              <Link to="/fitness" className="ghost-link">
                Open fitness
              </Link>
            </div>
            {todayWorkout ? (
              <>
                <p className="task-title">{todayWorkout.title || 'Workout Session'}</p>
                <p className="muted small-text">Routine for {new Date().toLocaleDateString()}</p>
                <div className="widget-list">
                  {todayWorkoutExercises.length === 0 ? (
                    <p className="muted">No exercises added yet.</p>
                  ) : (
                    todayWorkoutExercises.slice(0, 6).map((exerciseName) => (
                      <p key={exerciseName} className="muted small-text">
                        - {exerciseName}
                      </p>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="widget-list">
                <p className="muted">No workout planned for today.</p>
                <Link to="/fitness" className="primary-link-btn">
                  Plan workout
                </Link>
              </div>
            )}
          </article>

          <article className="panel command-widget">
            <div className="goal-widget-head">
              <p className="eyebrow">Finance Snapshot</p>
              <Link to="/finance" className="ghost-link">
                Open finance
              </Link>
            </div>
            <p className="stat-value">{formatMoney(sevenDaySpending)}</p>
            <p className="muted small-text">Spent in the last 7 days</p>
            <div className="widget-list">
              <Link to="/clients" className="ghost-link">
                Client management
              </Link>
              <Link to="/deals" className="ghost-link">
                Deals pipeline
              </Link>
              <Link to="/goals" className="ghost-link">
                Goals planner
              </Link>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  )
}
