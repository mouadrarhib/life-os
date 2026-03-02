import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { ensureNotificationPermission, notifyFocusEvent, playFocusChime } from '../lib/focusNotifications.js'
import { calculateTaskXp, getLevelFromXp } from '../lib/gamification.js'
import { supabase } from '../lib/supabase.js'

const STATUS_OPTIONS = ['todo', 'doing', 'done']

const STATUS_LABELS = {
  todo: 'To Do',
  doing: 'In Progress',
  done: 'Done',
}

const DUE_FILTERS = ['all', 'overdue', 'today', 'upcoming', 'no-date']

const DUE_FILTER_LABELS = {
  all: 'All due dates',
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  'no-date': 'No due date',
}

const TIMER_MODES = {
  pomodoro: 'pomodoro',
  manual: 'manual',
}

function toStartOfDay(input) {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDueDate(dateValue) {
  if (!dateValue) return 'No due date'
  return new Date(dateValue).toLocaleDateString()
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getTodayStartIso() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

function getWeekStart(input) {
  const date = new Date(input)
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

function toWeekKey(input) {
  return getWeekStart(input).toISOString().slice(0, 10)
}

function formatWeekLabel(weekKey) {
  return new Date(weekKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function TasksPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState(0)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_desc')
  const [focusMode, setFocusMode] = useState(TIMER_MODES.pomodoro)
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [focusFeatureReady, setFocusFeatureReady] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState('default')
  const [timerAlertedSessionId, setTimerAlertedSessionId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [focusStats, setFocusStats] = useState({ minutesToday: 0, blocksToday: 0 })
  const [focusByTaskId, setFocusByTaskId] = useState({})
  const [nowMs, setNowMs] = useState(Date.now())
  const [errorMessage, setErrorMessage] = useState('')

  const loadTasks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_at, done_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setTasks([])
      setLoading(false)
      return
    }

    setTasks(data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadTasks()
    loadFocusData()
  }, [user.id])

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return undefined

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeSession])

  const loadFocusData = async () => {
    const [activeResult, completedTodayResult, completedAllResult] = await Promise.all([
      supabase
        .from('task_focus_sessions')
        .select('id, user_id, task_id, mode, status, is_break, planned_minutes, actual_minutes, started_at')
        .eq('user_id', user.id)
        .in('status', ['running', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('task_focus_sessions')
        .select('id, actual_minutes, is_break')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('is_break', false)
        .gte('ended_at', getTodayStartIso()),
      supabase
        .from('task_focus_sessions')
        .select('task_id, actual_minutes, is_break')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('is_break', false),
    ])

    const firstError = [activeResult, completedTodayResult, completedAllResult].find((result) => result.error)
    if (firstError) {
      if (firstError.error.code === '42P01') {
        setFocusFeatureReady(false)
        setActiveSession(null)
        setFocusStats({ minutesToday: 0, blocksToday: 0 })
        setFocusByTaskId({})
        return
      }

      setErrorMessage(firstError.error.message)
      return
    }

    setFocusFeatureReady(true)
    setActiveSession((activeResult.data || [])[0] || null)

    const completedBlocks = completedTodayResult.data || []
    const minutesToday = completedBlocks.reduce((sum, item) => sum + Number(item.actual_minutes || 0), 0)
    setFocusStats({
      minutesToday,
      blocksToday: completedBlocks.length,
    })

    const totals = {}
    ;(completedAllResult.data || []).forEach((item) => {
      if (!item.task_id) return
      totals[item.task_id] = (totals[item.task_id] || 0) + Number(item.actual_minutes || 0)
    })
    setFocusByTaskId(totals)
  }

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const today = toStartOfDay(new Date())

    const result = tasks.filter((task) => {
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      const matchesSearch =
        !normalizedSearch || task.title.toLowerCase().includes(normalizedSearch)
      const matchesPriority =
        priorityFilter === 'all' || Number(task.priority || 0) === Number(priorityFilter)

      const taskDue = task.due_at ? toStartOfDay(task.due_at) : null
      const matchesDue =
        dueFilter === 'all' ||
        (dueFilter === 'no-date' && !taskDue) ||
        (dueFilter === 'today' && taskDue && taskDue.getTime() === today.getTime()) ||
        (dueFilter === 'overdue' && taskDue && taskDue < today) ||
        (dueFilter === 'upcoming' && taskDue && taskDue > today)

      return matchesStatus && matchesSearch && matchesPriority && matchesDue
    })

    result.sort((a, b) => {
      if (sortBy === 'priority_desc') {
        return Number(b.priority || 0) - Number(a.priority || 0)
      }

      if (sortBy === 'due_asc') {
        if (!a.due_at && !b.due_at) return 0
        if (!a.due_at) return 1
        if (!b.due_at) return -1
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return result
  }, [dueFilter, priorityFilter, search, sortBy, statusFilter, tasks])

  const stats = useMemo(() => {
    const total = tasks.length
    const todo = tasks.filter((task) => task.status === 'todo').length
    const doing = tasks.filter((task) => task.status === 'doing').length
    const done = tasks.filter((task) => task.status === 'done').length
    return { total, todo, doing, done }
  }, [tasks])

  const weeklyTaskStats = useMemo(() => {
    const weekCount = 8
    const bins = []
    const map = {}
    const cursor = getWeekStart(new Date())

    cursor.setDate(cursor.getDate() - (weekCount - 1) * 7)

    for (let i = 0; i < weekCount; i += 1) {
      const weekStart = new Date(cursor)
      weekStart.setDate(cursor.getDate() + i * 7)
      const key = weekStart.toISOString().slice(0, 10)
      const row = {
        weekKey: key,
        weekLabel: formatWeekLabel(key),
        created: 0,
        completed: 0,
      }
      bins.push(row)
      map[key] = row
    }

    tasks.forEach((task) => {
      const createdKey = toWeekKey(task.created_at)
      if (map[createdKey]) {
        map[createdKey].created += 1
      }

      if (task.done_at) {
        const doneKey = toWeekKey(task.done_at)
        if (map[doneKey]) {
          map[doneKey].completed += 1
        }
      }
    })

    return bins.map((row) => ({
      ...row,
      completionRate:
        row.created > 0 ? Math.round((row.completed / row.created) * 100) : row.completed > 0 ? 100 : 0,
    }))
  }, [tasks])

  const thisWeekProgress = useMemo(() => {
    if (weeklyTaskStats.length === 0) return { created: 0, completed: 0, completionRate: 0 }
    const current = weeklyTaskStats[weeklyTaskStats.length - 1]
    return {
      created: current.created,
      completed: current.completed,
      completionRate: current.completionRate,
    }
  }, [weeklyTaskStats])

  const bestWeek = useMemo(() => {
    const ranked = weeklyTaskStats
      .filter((week) => week.created > 0)
      .sort((a, b) => {
        if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate
        return b.completed - a.completed
      })

    if (ranked.length === 0) return null
    return ranked[0]
  }, [weeklyTaskStats])

  const groupedTasks = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = filteredTasks.filter((task) => task.status === status)
      return acc
    }, {})
  }, [filteredTasks])

  const activeTask = useMemo(() => {
    if (!activeSession?.task_id) return null
    return tasks.find((task) => task.id === activeSession.task_id) || null
  }, [activeSession, tasks])

  const activeElapsedSeconds = useMemo(() => {
    if (!activeSession?.started_at) return 0
    const baselineSeconds = Number(activeSession.actual_minutes || 0) * 60
    if (activeSession.status === 'paused') {
      return baselineSeconds
    }
    return baselineSeconds + Math.max(0, Math.floor((nowMs - new Date(activeSession.started_at).getTime()) / 1000))
  }, [activeSession, nowMs])

  const activeRemainingSeconds = useMemo(() => {
    if (!activeSession?.planned_minutes) return null
    return Math.max(0, Number(activeSession.planned_minutes) * 60 - activeElapsedSeconds)
  }, [activeElapsedSeconds, activeSession])

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return
    if (activeRemainingSeconds === null) return
    if (activeRemainingSeconds > 0) return
    if (timerAlertedSessionId === activeSession.id) return

    setTimerAlertedSessionId(activeSession.id)
    playFocusChime()
    notifyFocusEvent(
      activeSession.is_break ? 'Break complete' : 'Focus block complete',
      activeSession.is_break
        ? 'Great. Time to get back to work.'
        : 'Your timer reached zero. Complete block to log productivity.',
    )
  }, [activeRemainingSeconds, activeSession, timerAlertedSessionId])

  const handleCreateTask = async (event) => {
    event.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    const payload = {
      user_id: user.id,
      title: title.trim(),
      status: 'todo',
      priority: Number(priority) || 0,
      due_at: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : null,
    }

    const { error } = await supabase.from('tasks').insert(payload)
    setSaving(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setTitle('')
    setDueAt('')
    setPriority(0)
    setErrorMessage('')
    await loadTasks()
  }

  const handleStatusChange = async (taskId, nextStatus) => {
    const targetTask = tasks.find((task) => task.id === taskId)
    const isNewCompletion =
      nextStatus === 'done' && targetTask?.status !== 'done' && !targetTask?.done_at

    const updatePayload = { status: nextStatus }
    if (isNewCompletion) {
      updatePayload.done_at = new Date().toISOString()
    }

    const { error } = await supabase.from('tasks').update(updatePayload).eq('id', taskId)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (isNewCompletion && targetTask) {
      const xpEarned = calculateTaskXp(targetTask.priority)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('xp_total, level')
        .eq('id', user.id)
        .maybeSingle()

      if (!profileError) {
        const previousXp = Number(profileData?.xp_total || 0)
        const previousLevel = Number(profileData?.level || getLevelFromXp(previousXp))
        const nextXp = previousXp + xpEarned
        const nextLevel = getLevelFromXp(nextXp)

        const profilePayload = {
          xp_total: nextXp,
          level: nextLevel,
        }

        if (nextLevel > previousLevel) {
          profilePayload.last_level_up_at = new Date().toISOString()
        }

        await supabase.from('profiles').update(profilePayload).eq('id', user.id)

        if (nextLevel > previousLevel) {
          window.dispatchEvent(
            new CustomEvent('lifeos:levelup', {
              detail: {
                level: nextLevel,
                xp: nextXp,
              },
            }),
          )
        }
      }
    }

    await loadTasks()
  }

  const awardFocusXp = async (actualMinutes, taskPriority) => {
    const baseXp = Math.max(4, Math.round((Number(actualMinutes || 0) / 25) * 8))
    const priorityBonus = Math.max(0, Math.min(5, Number(taskPriority || 0)))
    const xpEarned = baseXp + priorityBonus

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('xp_total, level')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) return

    const previousXp = Number(profileData?.xp_total || 0)
    const previousLevel = Number(profileData?.level || getLevelFromXp(previousXp))
    const nextXp = previousXp + xpEarned
    const nextLevel = getLevelFromXp(nextXp)

    const payload = {
      xp_total: nextXp,
      level: nextLevel,
    }

    if (nextLevel > previousLevel) {
      payload.last_level_up_at = new Date().toISOString()
    }

    await supabase.from('profiles').update(payload).eq('id', user.id)

    if (nextLevel > previousLevel) {
      window.dispatchEvent(
        new CustomEvent('lifeos:levelup', {
          detail: {
            level: nextLevel,
            xp: nextXp,
          },
        }),
      )
    }
  }

  const handleStartFocus = async (taskId) => {
    if (!focusFeatureReady) {
      setErrorMessage('Run SQL migration 014_task_focus.sql to enable timer tracking.')
      return
    }

    if (activeSession) {
      setErrorMessage('Finish or cancel the current timer before starting another one.')
      return
    }

    const payload = {
      user_id: user.id,
      task_id: taskId,
      mode: focusMode,
      status: 'running',
      is_break: false,
      planned_minutes: focusMode === TIMER_MODES.pomodoro ? Number(focusMinutes) : null,
      started_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('task_focus_sessions')
      .insert(payload)
      .select('id, user_id, task_id, mode, status, is_break, planned_minutes, started_at')
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setErrorMessage('')
    const permission = await ensureNotificationPermission()
    setNotificationPermission(permission)
    setActiveSession(data)
    setNowMs(Date.now())
    setTimerAlertedSessionId(null)
  }

  const handleCancelSession = async () => {
    if (!activeSession) return

    const { error } = await supabase
      .from('task_focus_sessions')
      .update({
        status: 'cancelled',
        ended_at: new Date().toISOString(),
      })
      .eq('id', activeSession.id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setActiveSession(null)
    await loadFocusData()
  }

  const handlePauseSession = async () => {
    if (!activeSession || activeSession.status !== 'running') return

    const elapsedMinutes = Math.max(1, Math.round(activeElapsedSeconds / 60))
    const { error } = await supabase
      .from('task_focus_sessions')
      .update({
        status: 'paused',
        actual_minutes: elapsedMinutes,
      })
      .eq('id', activeSession.id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setActiveSession((prev) => (prev ? { ...prev, status: 'paused', actual_minutes: elapsedMinutes } : prev))
  }

  const handleResumeSession = async () => {
    if (!activeSession || activeSession.status !== 'paused') return

    const { error } = await supabase
      .from('task_focus_sessions')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', activeSession.id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setActiveSession((prev) => (prev ? { ...prev, status: 'running', started_at: new Date().toISOString() } : prev))
    setNowMs(Date.now())
  }

  const handleCompleteSession = async () => {
    if (!activeSession) return

    const endedAtIso = new Date().toISOString()
    const minutes = Math.max(1, Math.round(activeElapsedSeconds / 60))

    const { error } = await supabase
      .from('task_focus_sessions')
      .update({
        status: 'completed',
        ended_at: endedAtIso,
        actual_minutes: minutes,
      })
      .eq('id', activeSession.id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    const finishedSession = activeSession
    setActiveSession(null)

    if (!finishedSession.is_break) {
      const linkedTask = tasks.find((task) => task.id === finishedSession.task_id)
      await awardFocusXp(minutes, linkedTask?.priority)

      if (finishedSession.mode === TIMER_MODES.pomodoro && Number(breakMinutes) > 0) {
        const { data: breakSession, error: breakError } = await supabase
          .from('task_focus_sessions')
          .insert({
            user_id: user.id,
            task_id: finishedSession.task_id,
            mode: TIMER_MODES.pomodoro,
            status: 'running',
            is_break: true,
            planned_minutes: Number(breakMinutes),
            started_at: new Date().toISOString(),
          })
          .select('id, user_id, task_id, mode, status, is_break, planned_minutes, started_at')
          .single()

        if (breakError) {
          setErrorMessage(breakError.message)
        } else {
          playFocusChime()
          notifyFocusEvent('Break started', `Take ${breakMinutes} minutes and recharge.`)
          setActiveSession(breakSession)
          setTimerAlertedSessionId(null)
        }
      }
    } else {
      playFocusChime()
      notifyFocusEvent('Break complete', 'Ready for your next focus block.')
    }

    await loadFocusData()
  }

  const handleDeleteTask = async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadTasks()
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <main className="dashboard-layout tasks-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>Your focus board</h1>
          <p className="muted">Plan, filter, and track tasks with a clean workflow view.</p>
        </div>

        <div className="header-actions">
          <Link to="/dashboard" className="ghost-link">
            Back to dashboard
          </Link>
          <button type="button" className="primary-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      <section className="stats-grid tasks-stats-grid">
        <article className="stat-card">
          <p className="muted small-text">Total</p>
          <p className="stat-value">{stats.total}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">To Do</p>
          <p className="stat-value">{stats.todo}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">In Progress</p>
          <p className="stat-value">{stats.doing}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Done</p>
          <p className="stat-value">{stats.done}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Focus Today</p>
          <p className="stat-value">{focusStats.minutesToday}m</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Completed Blocks</p>
          <p className="stat-value">{focusStats.blocksToday}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">This Week Completion</p>
          <p className="stat-value">{thisWeekProgress.completionRate}%</p>
        </article>
      </section>

      <section className="panel tasks-progress-panel">
        <div className="goal-widget-head">
          <p className="eyebrow">Weekly Task Progress</p>
          <p className="muted small-text">Created vs completed tasks in the last 8 weeks</p>
        </div>

        <div className="tasks-progress-summary">
          <p className="muted small-text">Created this week: {thisWeekProgress.created}</p>
          <p className="muted small-text">Completed this week: {thisWeekProgress.completed}</p>
          <p className="muted small-text">
            Best week:{' '}
            {bestWeek
              ? `${bestWeek.weekLabel} (${bestWeek.completionRate}% with ${bestWeek.completed}/${bestWeek.created})`
              : 'No completed week yet'}
          </p>
        </div>

        <div className="tasks-progress-grid">
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyTaskStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="weekLabel" stroke="#475569" />
                <YAxis stroke="#475569" />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" name="Created" fill="#0284c7" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={weeklyTaskStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="weekLabel" stroke="#475569" />
                <YAxis unit="%" domain={[0, 100]} stroke="#475569" />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="completionRate"
                  name="Completion Rate"
                  stroke="#ea580c"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="panel tasks-panel">
        {focusFeatureReady ? (
          <section className="focus-control-card">
            <div className="focus-control-head">
              <p className="eyebrow">Focus Timer</p>
              <p className="muted small-text">Notifications: {notificationPermission}</p>
              {activeSession ? (
                <p className="muted small-text">
                  {activeSession.is_break ? 'Break' : 'Focus'} {activeSession.status} on{' '}
                  {activeTask?.title || 'Selected task'}
                </p>
              ) : (
                <p className="muted small-text">No active timer</p>
              )}
            </div>

            <div className="focus-mode-row">
              <label>
                Mode
                <select value={focusMode} onChange={(event) => setFocusMode(event.target.value)}>
                  <option value={TIMER_MODES.pomodoro}>Pomodoro</option>
                  <option value={TIMER_MODES.manual}>Manual stopwatch</option>
                </select>
              </label>

              <label>
                Focus minutes
                <input
                  type="number"
                  min="10"
                  max="90"
                  value={focusMinutes}
                  onChange={(event) => setFocusMinutes(event.target.value)}
                  disabled={focusMode !== TIMER_MODES.pomodoro}
                />
              </label>

              <label>
                Break minutes
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(event.target.value)}
                  disabled={focusMode !== TIMER_MODES.pomodoro}
                />
              </label>
            </div>

            {activeSession ? (
              <div className="focus-active-bar">
                <p className="task-title">
                  {activeSession.is_break ? 'Break Timer' : 'Focus Timer'} ({activeSession.status}):{' '}
                  {activeRemainingSeconds !== null
                    ? formatDuration(activeRemainingSeconds)
                    : formatDuration(activeElapsedSeconds)}
                </p>
                <div className="task-actions">
                  {activeSession.status === 'running' ? (
                    <button type="button" className="ghost-action" onClick={handlePauseSession}>
                      Pause
                    </button>
                  ) : (
                    <button type="button" className="ghost-action" onClick={handleResumeSession}>
                      Resume
                    </button>
                  )}
                  <button type="button" className="ghost-action" onClick={handleCompleteSession}>
                    Complete block
                  </button>
                  <button type="button" className="danger-btn" onClick={handleCancelSession}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="focus-links-row">
              <Link to="/focus-history" className="ghost-link">
                View session history
              </Link>
            </div>
          </section>
        ) : (
          <p className="message error">Run `supabase/014_task_focus.sql` to enable timer tracking.</p>
        )}

        <form onSubmit={handleCreateTask} className="form-grid create-task-form">
          <label>
            Task title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Plan my week"
              required
            />
          </label>

          <div className="task-form-row">
            <label>
              Due date
              <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>

            <label>
              Priority
              <input
                type="number"
                min="0"
                max="5"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              />
            </label>
          </div>

          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add task'}
          </button>
        </form>

        <div className="filter-row top-filter-row">
          {['all', ...STATUS_OPTIONS].map((status) => (
            <button
              key={status}
              type="button"
              className={`chip ${statusFilter === status ? 'chip-active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        <div className="advanced-filters">
          <label>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title"
            />
          </label>

          <label>
            Priority
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="all">All priorities</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>

          <label>
            Due
            <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value)}>
              {DUE_FILTERS.map((item) => (
                <option key={item} value={item}>
                  {DUE_FILTER_LABELS[item]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sort
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="created_desc">Newest first</option>
              <option value="due_asc">Due date</option>
              <option value="priority_desc">Priority high to low</option>
            </select>
          </label>
        </div>

        <div className="filter-footer">
          <p className="muted small-text">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </p>
          <button
            type="button"
            className="ghost-action"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
              setPriorityFilter('all')
              setDueFilter('all')
              setSortBy('created_desc')
            }}
          >
            Reset Filters
          </button>
        </div>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}

        {loading ? <p className="muted">Loading tasks...</p> : null}

        {!loading && filteredTasks.length === 0 ? (
          <p className="muted">No tasks in this view yet.</p>
        ) : null}

        <div className="kanban-grid">
          {STATUS_OPTIONS.map((status) => (
            <section key={status} className="kanban-column">
              <header className="kanban-column-head">
                <p>{STATUS_LABELS[status]}</p>
                <span>{groupedTasks[status]?.length || 0}</span>
              </header>

              <div className="kanban-scroll">
                {(groupedTasks[status] || []).map((task) => (
                  <article key={task.id} className="task-item">
                    <div>
                      <p className="task-title">{task.title}</p>
                      <p className="muted small-text">Priority {task.priority || 0}</p>
                      <p className="muted small-text">{formatDueDate(task.due_at)}</p>
                      <p className="muted small-text">Focus logged: {focusByTaskId[task.id] || 0}m</p>
                      <button
                        type="button"
                        className="ghost-action focus-task-btn"
                        onClick={() => handleStartFocus(task.id)}
                        disabled={Boolean(activeSession)}
                      >
                        Start focus
                      </button>
                    </div>

                    <div className="task-actions">
                      <select
                        value={task.status}
                        onChange={(event) => handleStatusChange(task.id, event.target.value)}
                      >
                        {STATUS_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {STATUS_LABELS[item]}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
