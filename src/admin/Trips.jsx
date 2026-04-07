import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Trips() {
  const [trips, setTrips] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sigUrl, setSigUrl] = useState(null)

  // Filters
  const [filterDriver, setFilterDriver] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  useEffect(() => {
    supabase.from('drivers').select('id, name').order('name').then(({ data }) => setDrivers(data || []))
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase
        .from('trips')
        .select('*, drivers(name), riders(name)')
        .order('created_at', { ascending: false })

      if (filterDriver) q = q.eq('driver_id', filterDriver)
      if (filterStatus) q = q.eq('status', filterStatus)
      if (filterFrom) q = q.gte('created_at', new Date(filterFrom).toISOString())
      if (filterTo) {
        const to = new Date(filterTo)
        to.setHours(23, 59, 59, 999)
        q = q.lte('created_at', to.toISOString())
      }

      const { data } = await q
      setTrips(data || [])
      setLoading(false)
    }
    load()
  }, [filterDriver, filterStatus, filterFrom, filterTo])

  return (
    <div>
      <div className="a-page-header">
        <h1>Trips</h1>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{trips.length} results</span>
      </div>

      <div className="a-card">
        <div className="a-filters">
          <select
            className="a-filter-select"
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
          >
            <option value="">All Drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            className="a-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
          </select>

          <input
            type="date"
            className="a-filter-input"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="a-filter-input"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            placeholder="To"
          />
        </div>

        <div className="a-table-wrap">
          {loading ? (
            <p className="a-empty">Loading…</p>
          ) : trips.length === 0 ? (
            <p className="a-empty">No trips found</p>
          ) : (
            <table className="a-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Driver</th>
                  <th>Rider</th>
                  <th>Pickup</th>
                  <th>Drop-off</th>
                  <th>Miles</th>
                  <th>Riders</th>
                  <th>Rate</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Sig</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.trip_number}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.created_at)}</td>
                    <td>{t.drivers?.name || '—'}</td>
                    <td>{t.riders?.name || '—'}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.pickup_address || t.start_address || '—'}
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.dropoff_address || '—'}
                    </td>
                    <td>{t.miles_traveled != null ? Number(t.miles_traveled).toFixed(1) : '—'}</td>
                    <td>{t.rider_count}</td>
                    <td>{t.rate_applied != null ? `$${Number(t.rate_applied).toFixed(2)}` : '—'}</td>
                    <td style={{ fontWeight: 700 }}>
                      {t.trip_total != null ? `$${Number(t.trip_total).toFixed(2)}` : '—'}
                    </td>
                    <td>
                      <span className={`a-badge ${t.status === 'completed' ? 'a-badge-green' : 'a-badge-blue'}`}>
                        {t.status === 'completed' ? 'Done' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {t.signature_url ? (
                        <button
                          className="a-btn a-btn-ghost a-btn-sm"
                          onClick={() => setSigUrl(t.signature_url)}
                        >
                          View
                        </button>
                      ) : (
                        <span className="a-badge a-badge-red">Missing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Signature modal */}
      {sigUrl && (
        <div className="a-modal-backdrop" onClick={() => setSigUrl(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-header">
              Rider Signature
              <button className="a-modal-close" onClick={() => setSigUrl(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              <img src={sigUrl} alt="Rider signature" className="a-sig-img" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
