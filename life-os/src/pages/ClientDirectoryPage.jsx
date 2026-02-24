import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

function formatDate(value) {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString()
}

function formatStatus(value) {
  if (!value) return 'unknown'
  return value.replace(/_/g, ' ')
}

const CLIENT_STATUS_OPTIONS = ['lead', 'active', 'inactive']

export function ClientDirectoryPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [industry, setIndustry] = useState('')
  const [newClientStatus, setNewClientStatus] = useState('lead')
  const [note, setNote] = useState('')

  const loadClients = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('clients')
      .select('id, name, phone, city, industry, status, note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setClients([])
      setLoading(false)
      return
    }

    setClients(data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadClients()
  }, [user.id])

  const availableStatuses = useMemo(() => {
    const statuses = Array.from(new Set(clients.map((client) => client.status).filter(Boolean)))
    return statuses.sort((a, b) => a.localeCompare(b))
  }, [clients])

  const filteredClients = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return clients.filter((client) => {
      const matchesSearch =
        !keyword ||
        client.name.toLowerCase().includes(keyword) ||
        (client.industry || '').toLowerCase().includes(keyword) ||
        (client.city || '').toLowerCase().includes(keyword) ||
        (client.phone || '').toLowerCase().includes(keyword)

      const matchesStatus = statusFilter === 'all' || client.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [clients, search, statusFilter])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  const handleCreateClient = async (event) => {
    event.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    const payload = {
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      industry: industry.trim() || null,
      status: newClientStatus,
      note: note.trim() || null,
    }

    const { error } = await supabase.from('clients').insert(payload)
    setSaving(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setName('')
    setPhone('')
    setCity('')
    setIndustry('')
    setNewClientStatus('lead')
    setNote('')
    setErrorMessage('')
    await loadClients()
  }

  const handleStatusChange = async (clientId, nextStatus) => {
    const { error } = await supabase.from('clients').update({ status: nextStatus }).eq('id', clientId)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setClients((prev) =>
      prev.map((client) => (client.id === clientId ? { ...client, status: nextStatus } : client)),
    )
  }

  const handleDeleteClient = async (clientId) => {
    const { error } = await supabase.from('clients').delete().eq('id', clientId)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setClients((prev) => prev.filter((client) => client.id !== clientId))
  }

  return (
    <main className="dashboard-layout clients-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Clients</p>
          <h1>Client Directory</h1>
          <p className="muted">Browse every client in your account from one clean directory view.</p>
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

      <section className="panel clients-panel">
        <form onSubmit={handleCreateClient} className="form-grid compact-form client-create-form">
          <h2 className="fitness-title">Add Client</h2>
          <label>
            Client name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Corp"
                required
              />
            </label>

          <div className="client-create-row">
            <label>
              Phone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 123 4567"
              />
            </label>

            <label>
              City
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="New York"
              />
            </label>
          </div>

          <div className="client-create-row">
            <label>
              Industry
              <input
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder="Software"
              />
            </label>

            <label>
              Status
              <select
                value={newClientStatus}
                onChange={(event) => setNewClientStatus(event.target.value)}
              >
                {CLIENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Warm introduction from conference"
            />
          </label>

          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add client'}
          </button>
        </form>

        <div className="clients-toolbar">
          <label>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, city, or industry"
            />
          </label>

          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-footer">
          <p className="muted small-text">
            Showing {filteredClients.length} of {clients.length} clients
          </p>
        </div>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading clients...</p> : null}

        {!loading && filteredClients.length === 0 ? (
          <p className="muted">No clients found for this filter.</p>
        ) : null}

        <div className="clients-list">
          {filteredClients.map((client) => (
            <article key={client.id} className="client-item">
              <div>
                <p className="task-title">{client.name}</p>
                <p className="muted small-text">Phone: {client.phone || 'Not set'}</p>
                <p className="muted small-text">City: {client.city || 'Not set'}</p>
                <p className="muted small-text">Industry: {client.industry || 'Unspecified'}</p>
                <p className="muted small-text">Added: {formatDate(client.created_at)}</p>
                <Link to={`/clients/${client.id}`} className="ghost-link client-open-link">
                  Open client details
                </Link>
              </div>

              <div className="client-right">
                <div className="client-actions-row">
                  <select
                    value={client.status || 'lead'}
                    onChange={(event) => handleStatusChange(client.id, event.target.value)}
                  >
                    {CLIENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => handleDeleteClient(client.id)}
                  >
                    Delete
                  </button>
                </div>
                <span className="client-status">{formatStatus(client.status)}</span>
                {client.note ? <p className="muted small-text client-note">{client.note}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
