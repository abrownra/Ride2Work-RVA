import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toLocalDatetimeInput(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY_FORM = {
  driver_id: '',
  rider_id: '',
  rider_count: 1,
  status: 'completed',
  created_at: '',
  pickup_address: '',
  dropoff_address: '',
  odometer_start: '',
  odometer_end: '',
  miles_traveled: '',
  rate_applied: '',
  trip_total: '',
}

export default function Trips() {
  const [trips, setTrips] = useState([])
  const [drivers, setDrivers] = useState([])
  const [riders, setRiders] = useState([])
  const [loading, setLoading] = useState(true)
  const [sigUrl, setSigUrl] = useState(null)

  // Add/edit modal
  const [modal, setModal] = useState(null) // null | { mode: 'add' | 'edit', id?: string }
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Filters
  const [filterDriver, setFilterDriver] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  useEffect(() => {
    supabase.from('drivers').select('id, name').order('name').then(({ data }) => setDrivers(data || []))
    supabase.from('riders').select('id, name').order('name').then(({ data }) => setRiders(data || []))
  }, [])

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

  useEffect(() => { load() }, [filterDriver, filterStatus, filterFrom, filterTo])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleOdomChange(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      const start = parseFloat(field === 'odometer_start' ? value : prev.odometer_start)
      const end = parseFloat(field === 'odometer_end' ? value : prev.odometer_end)
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        next.miles_traveled = (end - start).toFixed(1)
      }
      return next
    })
  }

  function handleRateOrCountChange(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      const rate = parseFloat(field === 'rate_applied' ? value : prev.rate_applied)
      const count = parseInt(field === 'rider_count' ? value : prev.rider_count)
      if (!isNaN(rate) && !isNaN(count) && count > 0) {
        next.trip_total = (rate * count).toFixed(2)
      }
      return next
    })
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, created_at: toLocalDatetimeInput(new Date().toISOString()) })
    setFormError(null)
    setModal({ mode: 'add' })
  }

  function openEdit(t) {
    setForm({
      driver_id: t.driver_id || '',
      rider_id: t.rider_id || '',
      rider_count: t.rider_count ?? 1,
      status: t.status || 'completed',
      created_at: toLocalDatetimeInput(t.created_at),
      pickup_address: t.pickup_address || t.start_address || '',
      dropoff_address: t.dropoff_address || '',
      odometer_start: t.odometer_start ?? '',
      odometer_end: t.odometer_end ?? '',
      miles_traveled: t.miles_traveled != null ? Number(t.miles_traveled).toFixed(1) : '',
      rate_applied: t.rate_applied != null ? Number(t.rate_applied).toFixed(2) : '',
      trip_total: t.trip_total != null ? Number(t.trip_total).toFixed(2) : '',
    })
    setFormError(null)
    setModal({ mode: 'edit', id: t.id })
  }

  async function handleSave() {
    if (!form.driver_id) { setFormError('Driver is required'); return }
    if (!form.rider_id) { setFormError('Rider is required'); return }
    setSaving(true)
    setFormError(null)

    const payload = {
      driver_id: form.driver_id,
      rider_id: form.rider_id,
      rider_count: parseInt(form.rider_count) || 1,
      status: form.status,
      pickup_address: form.pickup_address.trim() || null,
      dropoff_address: form.dropoff_address.trim() || null,
      odometer_start: form.odometer_start !== '' ? parseInt(form.odometer_start) : null,
      odometer_end: form.odometer_end !== '' ? parseInt(form.odometer_end) : null,
      miles_traveled: form.miles_traveled !== '' ? parseFloat(form.miles_traveled) : null,
      rate_applied: form.rate_applied !== '' ? parseFloat(form.rate_applied) : null,
      trip_total: form.trip_total !== '' ? parseFloat(form.trip_total) : null,
    }
    if (form.created_at) payload.created_at = new Date(form.created_at).toISOString()

    const { error } = modal.mode === 'add'
      ? await supabase.from('trips').insert(payload)
      : await supabase.from('trips').update(payload).eq('id', modal.id)

    if (error) { setFormError(error.message); setSaving(false); return }
    await load()
    setSaving(false)
    setModal(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('trips').delete().eq('id', deleteTarget.id)
    await load()
    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div>
      <div className="a-page-header">
        <h1>Trips</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{trips.length} results</span>
          <button className="a-btn a-btn-primary" onClick={openAdd}>+ Add Trip</button>
        </div>
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
                  <th></th>
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
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="a-btn a-btn-ghost a-btn-sm" onClick={() => openEdit(t)}>Edit</button>
                        <button className="a-btn a-btn-danger a-btn-sm" onClick={() => setDeleteTarget(t)}>Delete</button>
                      </div>
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

      {/* Add / Edit modal */}
      {modal && (
        <div className="a-modal-backdrop" onClick={() => setModal(null)}>
          <div className="a-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-header">
              {modal.mode === 'add' ? 'Add Trip' : 'Edit Trip'}
              <button className="a-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="a-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {formError && <p className="a-error">{formError}</p>}

              <div className="a-field-row">
                <div className="a-field">
                  <label>Driver *</label>
                  <select value={form.driver_id} onChange={(e) => setField('driver_id', e.target.value)}>
                    <option value="">Select driver…</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="a-field">
                  <label>Rider *</label>
                  <select value={form.rider_id} onChange={(e) => setField('rider_id', e.target.value)}>
                    <option value="">Select rider…</option>
                    {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="a-field-row">
                <div className="a-field">
                  <label>Rider Count</label>
                  <input
                    type="number"
                    min="1"
                    value={form.rider_count}
                    onChange={(e) => handleRateOrCountChange('rider_count', e.target.value)}
                  />
                </div>
                <div className="a-field">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>
              </div>

              <div className="a-field">
                <label>Trip Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={form.created_at}
                  onChange={(e) => setField('created_at', e.target.value)}
                />
              </div>

              <div className="a-field">
                <label>Pickup Address</label>
                <input
                  value={form.pickup_address}
                  onChange={(e) => setField('pickup_address', e.target.value)}
                  placeholder="123 Main St, Richmond, VA"
                />
              </div>

              <div className="a-field">
                <label>Drop-off Address</label>
                <input
                  value={form.dropoff_address}
                  onChange={(e) => setField('dropoff_address', e.target.value)}
                  placeholder="456 Work Ave, Richmond, VA"
                />
              </div>

              <div className="a-field-row">
                <div className="a-field">
                  <label>Odometer Start</label>
                  <input
                    type="number"
                    value={form.odometer_start}
                    onChange={(e) => handleOdomChange('odometer_start', e.target.value)}
                  />
                </div>
                <div className="a-field">
                  <label>Odometer End</label>
                  <input
                    type="number"
                    value={form.odometer_end}
                    onChange={(e) => handleOdomChange('odometer_end', e.target.value)}
                  />
                </div>
              </div>

              <div className="a-field-row">
                <div className="a-field">
                  <label>Miles Traveled</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.miles_traveled}
                    onChange={(e) => setField('miles_traveled', e.target.value)}
                    placeholder="Auto-calc from odometer"
                  />
                </div>
                <div className="a-field">
                  <label>Rate Applied ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.rate_applied}
                    onChange={(e) => handleRateOrCountChange('rate_applied', e.target.value)}
                  />
                </div>
              </div>

              <div className="a-field">
                <label>Trip Total ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.trip_total}
                  onChange={(e) => setField('trip_total', e.target.value)}
                  placeholder="Auto-calc from rate × rider count"
                />
              </div>
            </div>
            <div className="a-modal-footer">
              <button className="a-btn a-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="a-btn a-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="a-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="a-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-header">
              Delete Trip
              <button className="a-modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              <p style={{ color: '#475569', lineHeight: 1.5 }}>
                Are you sure you want to delete trip <strong>#{deleteTarget.trip_number}</strong>?
                This cannot be undone and will remove the record from invoices and reports.
              </p>
            </div>
            <div className="a-modal-footer">
              <button className="a-btn a-btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="a-btn a-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete Trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
