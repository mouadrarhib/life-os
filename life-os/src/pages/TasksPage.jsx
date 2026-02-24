import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
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

function toStartOfDay(input) {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDueDate(dateValue) {
  if (!dateValue) return 'No due date'
  return new Date(dateValue).toLocaleDateString()
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
  }, [user.id])

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

  const groupedTasks = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = filteredTasks.filter((task) => task.status === status)
      return acc
    }, {})
  }, [filteredTasks])

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

      <section className="stats-grid">
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
      </section>

      <section className="panel tasks-panel">
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
