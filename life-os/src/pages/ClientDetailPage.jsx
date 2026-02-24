import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

export function ClientDetailPage() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { user, signOut } = useAuth()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [client, setClient] = useState(null)
  const [contacts, setContacts] = useState([])
  const [deals, setDeals] = useState([])

  const loadClientDetail = async () => {
    setLoading(true)

    const [clientResult, contactsResult, dealsResult] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, phone, city, industry, status, note, created_at')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('client_contacts')
        .select('id, name, email, phone, role, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true }),
      supabase
        .from('deals')
        .select('id, title, stage, value_amount, currency, next_step_date, note, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ])

    const firstError = [clientResult, contactsResult, dealsResult].find((item) => item.error)
    if (firstError) {
      setErrorMessage(firstError.error.message)
      setLoading(false)
      return
    }

    setClient(clientResult.data)
    setContacts(contactsResult.data || [])
    setDeals(dealsResult.data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadClientDetail()
  }, [clientId, user.id])

  const dealNotes = useMemo(() => {
    return deals.filter((deal) => deal.note)
  }, [deals])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  if (loading) {
    return <div className="screen-center">Loading client details...</div>
  }

  if (!client) {
    return (
      <main className="dashboard-layout client-detail-layout">
        <section className="panel client-detail-panel">
          <p className="eyebrow">Clients</p>
          <h1>Client not found</h1>
          <p className="muted">This client does not exist or you do not have access.</p>
          <div className="header-actions">
            <Link to="/clients" className="ghost-link">
              Back to directory
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-layout client-detail-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Client Detail</p>
          <h1>{client.name}</h1>
          <p className="muted">
            {client.city || 'Unspecified city'} - Status {formatStatus(client.status)}
          </p>
        </div>

        <div className="header-actions">
          <Link to="/clients" className="ghost-link">
            Back to directory
          </Link>
          <Link to="/deals" className="ghost-link">
            Open pipeline
          </Link>
          <button type="button" className="primary-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      {errorMessage ? <p className="message error">{errorMessage}</p> : null}

      <section className="stats-grid client-detail-stats">
        <article className="stat-card">
          <p className="muted small-text">Contacts</p>
          <p className="stat-value">{contacts.length}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Deals</p>
          <p className="stat-value">{deals.length}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Notes</p>
          <p className="stat-value">{Number(Boolean(client.note)) + dealNotes.length}</p>
        </article>
      </section>

      <section className="client-detail-grid">
        <section className="panel client-card">
          <h2 className="fitness-title">Client Info</h2>
          <p className="muted small-text">Created {formatDate(client.created_at)}</p>
          <p className="muted small-text">Phone: {client.phone || 'Not set'}</p>
          <p className="muted small-text">City: {client.city || 'Not set'}</p>
          <p className="muted small-text">Industry: {client.industry || 'Unspecified'}</p>
          <p className="muted small-text">Status: {formatStatus(client.status)}</p>
          <h3 className="mini-heading">Primary Note</h3>
          <p className="muted">{client.note || 'No client note yet.'}</p>
        </section>

        <section className="panel client-card">
          <h2 className="fitness-title">Contacts</h2>
          <div className="client-sublist">
            {contacts.length === 0 ? (
              <p className="muted">No contacts yet.</p>
            ) : (
              contacts.map((contact) => (
                <article key={contact.id} className="client-subitem">
                  <p className="task-title">{contact.name}</p>
                  <p className="muted small-text">Role: {contact.role || 'Unknown'}</p>
                  <p className="muted small-text">Email: {contact.email || '-'}</p>
                  <p className="muted small-text">Phone: {contact.phone || '-'}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="panel client-card notes-card">
        <h2 className="fitness-title">Deal Notes</h2>
        <div className="client-sublist">
          {dealNotes.length === 0 ? (
            <p className="muted">No deal notes yet.</p>
          ) : (
            dealNotes.map((deal) => (
              <article key={deal.id} className="client-subitem">
                <p className="task-title">{deal.title}</p>
                <p className="muted small-text">
                  {formatStatus(deal.stage)} - Next step {formatDate(deal.next_step_date)}
                </p>
                <p className="muted">{deal.note}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
