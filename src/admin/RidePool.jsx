import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function timeUntil(ts) {
  const diff = new Date(ts) - Date.now()
  if (diff < 0) return 'Past'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h >= 48) return `${Math.floor(h / 24)}d`
  if (h >= 1)  return `${h}h ${m}m`
  return `${m}m`
}

const STATUS_META = {
  pending:   { label: 'Unclaimed',        bg: '#fef3c7', color: '#92400e' },
  claimed:   { label: 'Driver Assigned',  bg: '#f0fdf4', color: '#15803d' },
  completed: { label: 'Completed',        bg: '#f1f5f9', color: '#64748b' },
  cancelled: { label: 'Cancelled',        bg: '#fef2f2', color: '#b91c1c' },
}

const FILTERS = ['all', 'pending', 'claimed', 'completed', 'cancelled']

export default function RidePool() {
  const [requests, setRequests] = useState([])
  const [riders,   setRiders]   = useState({})   // id → name
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('pending')
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const [{ data: reqs }, { data: riderRows }] = await Promise.all([
      supabase
        .from('ride_requests')
        .select('*, drivers(name)')
        .order('pickup_time', { ascending: true }),
      supabase.from('riders').select('id, name'),
    ])

    const riderMap = {}
    ;(riderRows || []).forEach((r) => { riderMap[r.id] = r.name })

    setRequests(reqs || [])
    setRiders(riderMap)
    setLoading(false)
  }

  async function handleCancel(id) {
    setCancelling(id)
    // Cancel the request and clean up any linked trip so it leaves the driver's active trips
    await Promise.all([
      supabase
        .from('ride_requests')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id),
      supabase
        .from('trips')
        .delete()
        .eq('ride_request_id', id),
    ])
    setCancelling(null)
    load()
  }

  const filtered = filter === 'all'
    ? requests
    : requests.filter((r) => r.status === filter)

  // Summary counts
  const pending   = requests.filter((r) => r.status === 'pending'   && new Date(r.pickup_time) > new Date()).length
  const claimed   = requests.filter((r) => r.status === 'claimed'   && new Date(r.pickup_time) > new Date()).length
  const completed = requests.filter((r) => r.status === 'completed').length
  const cancelled = requests.filter((r) => r.status === 'cancelled').length

  return (
    <div className="a-page">
      <div className="a-page-header">
        <h1 className="a-page-title">Ride Pool</h1>
        <button className="a-btn a-btn-outline" onClick={load}>↻ Refresh</button>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Unclaimed',       count: pending,   bg: '#fef3c7', color: '#92400e' },
          { label: 'Driver Assigned', count: claimed,   bg: '#f0fdf4', color: '#15803d' },
          { label: 'Completed',       count: completed, bg: '#f1f5f9', color: '#64748b' },
          { label: 'Cancelled',       count: cancelled, bg: '#fef2f2', color: '#b91c1c' },
        ].map((t) => (
          <div key={t.label} style={{ background: t.bg, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: t.color }}>{t.count}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: t.color, marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid',
              borderColor: filter === f ? '#cc1111' : '#e5e7eb',
              background: filter === f ? '#cc1111' : '#fff',
              color: filter === f ? '#fff' : '#374151',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f === 'pending' ? 'Unclaimed' : f === 'all' ? 'All' : STATUS_META[f]?.label ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#f9fafb', border: '2px dashed #e5e7eb', borderRadius: 12, padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
          No ride requests found
        </div>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Pickup Time</th>
                <th>Rider</th>
                <th>Pickup Address</th>
                <th>Drop-off Address</th>
                <th>Status</th>
                <th>Driver</th>
                <th>In</th>
                <th>Template</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta    = STATUS_META[r.status] || STATUS_META.pending
                const isPast  = new Date(r.pickup_time) < new Date()
                const urgent  = r.status === 'pending' && !isPast && (new Date(r.pickup_time) - Date.now()) < 4 * 3_600_000

                return (
                  <tr key={r.id} style={{ background: urgent ? '#fffbeb' : 'transparent' }}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDateTime(r.pickup_time)}</td>
                    <td>{riders[r.rider_id] || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pickup_address}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dropoff_address}</td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
                        {urgent && '⚠️ '}{meta.label}
                      </span>
                    </td>
                    <td>{r.status === 'claimed' ? (r.drivers?.name || '—') : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: isPast ? '#9ca3af' : '#374151' }}>
                      {isPast ? '—' : timeUntil(r.pickup_time)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
                      {r.from_template ? '✓' : ''}
                    </td>
                    <td>
                      {['pending', 'claimed'].includes(r.status) && (
                        <button
                          className="a-btn a-btn-danger-sm"
                          onClick={() => handleCancel(r.id)}
                          disabled={cancelling === r.id}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {cancelling === r.id ? '…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
