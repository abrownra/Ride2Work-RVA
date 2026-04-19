import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { forwardGeocode } from '../lib/geocode'

function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function toLocalDatetimeInput(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_STYLES = {
  pending:   { bg: '#fef3c7', color: '#92400e', label: 'Pending — Waiting for a driver' },
  claimed:   { bg: '#f0fdf4', color: '#15803d', label: 'Driver Assigned' },
  completed: { bg: '#f1f5f9', color: '#64748b', label: 'Completed' },
  cancelled: { bg: '#fef2f2', color: '#b91c1c', label: 'Cancelled' },
}

export default function RiderRideDetail({ ride, onBack, onCancelled }) {
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'cancel'

  // Edit form state
  const [editTime,    setEditTime]    = useState(toLocalDatetimeInput(ride.pickup_time))
  const [editPickup,  setEditPickup]  = useState(ride.pickup_address)
  const [editDropoff, setEditDropoff] = useState(ride.dropoff_address)

  const [saving,     setSaving]     = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error,      setError]      = useState(null)

  const s = STATUS_STYLES[ride.status] || STATUS_STYLES.pending
  const canModify = ['pending', 'claimed'].includes(ride.status) && new Date(ride.pickup_time) > new Date()
  const withinTwoHours = (new Date(ride.pickup_time) - Date.now()) < 2 * 60 * 60 * 1000 && new Date(ride.pickup_time) > new Date()

  async function handleSaveEdit() {
    setError(null)
    if (!editTime)    { setError('Pickup time is required.'); return }
    if (!editPickup)  { setError('Pickup address is required.'); return }
    if (!editDropoff) { setError('Drop-off address is required.'); return }

    const newPickupDate = new Date(editTime)
    if ((newPickupDate - Date.now()) < 2 * 60 * 60 * 1000) {
      setError('Rides must be at least 2 hours from now.')
      return
    }

    setSaving(true)

    // Geocode if addresses changed
    const pickupGeo  = editPickup  !== ride.pickup_address  ? await forwardGeocode(editPickup)  : null
    const dropoffGeo = editDropoff !== ride.dropoff_address ? await forwardGeocode(editDropoff) : null

    const updates = {
      pickup_time:     newPickupDate.toISOString(),
      pickup_address:  editPickup,
      dropoff_address: editDropoff,
      ...(pickupGeo  ? { pickup_lat:  pickupGeo.lat,  pickup_lon:  pickupGeo.lon  } : {}),
      ...(dropoffGeo ? { dropoff_lat: dropoffGeo.lat, dropoff_lon: dropoffGeo.lon } : {}),
    }

    const { error: err } = await supabase
      .from('ride_requests')
      .update(updates)
      .eq('id', ride.id)

    if (err) { setError('Could not save. Please try again.'); setSaving(false); return }

    // Notify driver + admin if ride was claimed
    if (ride.status === 'claimed') {
      supabase.functions.invoke('notify-ride-edit', {
        body: { ride_request_id: ride.id, change_type: 'edited' },
      }).catch(() => {})
    }

    setSaving(false)
    onBack() // return to dashboard to see updated ride
  }

  async function handleCancel() {
    setCancelling(true)
    setError(null)

    const { error: err } = await supabase
      .from('ride_requests')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', ride.id)

    if (err) { setError('Could not cancel. Please try again.'); setCancelling(false); return }

    // Notify driver + admin if ride was claimed
    if (ride.status === 'claimed') {
      supabase.functions.invoke('notify-ride-edit', {
        body: { ride_request_id: ride.id, change_type: 'cancelled' },
      }).catch(() => {})
    }

    setCancelling(false)
    onCancelled()
  }

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#111111' }}>
        <h1>{mode === 'edit' ? 'Edit Ride' : 'Ride Details'}</h1>
        <p>{fmtDateTime(ride.pickup_time)}</p>
      </div>

      <div className="screen-body">
        {/* Status badge */}
        <div style={{ background: s.bg, color: s.color, borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' }}>
          {s.label}
          {ride.status === 'claimed' && mode === 'edit' && (
            <div style={{ fontSize: '0.78rem', marginTop: 4, fontWeight: 500 }}>
              Your driver will be notified of any changes
            </div>
          )}
        </div>

        {/* View mode */}
        {mode === 'view' && (
          <div className="card">
            <div className="card-row">
              <span className="card-label">Pickup Time</span>
              <span className="card-value">{fmtDateTime(ride.pickup_time)}</span>
            </div>
            <hr className="card-divider" />
            <div className="card-row">
              <span className="card-label">Pickup</span>
              <span className="card-value">{ride.pickup_address}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Drop-off</span>
              <span className="card-value">{ride.dropoff_address}</span>
            </div>
            {ride.notes && (
              <>
                <hr className="card-divider" />
                <div className="card-row">
                  <span className="card-label">Notes</span>
                  <span className="card-value">{ride.notes}</span>
                </div>
              </>
            )}
            {ride.from_template && (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', paddingTop: 4 }}>
                Auto-generated from your weekly schedule
              </div>
            )}
          </div>
        )}

        {/* Edit mode */}
        {mode === 'edit' && (
          <>
            <div className="field">
              <label>Pickup Date &amp; Time</label>
              <input
                type="datetime-local"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Pickup Address</label>
              <input type="text" value={editPickup} onChange={(e) => setEditPickup(e.target.value)} />
            </div>
            <div className="field">
              <label>Drop-off Address</label>
              <input type="text" value={editDropoff} onChange={(e) => setEditDropoff(e.target.value)} />
            </div>
          </>
        )}

        {error && <p className="error-msg">{error}</p>}

        {/* Cancel confirm */}
        {mode === 'cancel' && (
          <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {withinTwoHours ? (
              <>
                <p style={{ fontWeight: 700, color: '#b91c1c', fontSize: '1rem' }}>⚠️ Last-Minute Cancellation</p>
                <p style={{ color: '#7f1d1d', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Your driver may already be on their way. Cancelling within 2 hours makes it hard for drivers to plan and affects the program for everyone.
                </p>
                <p style={{ color: '#7f1d1d', fontSize: '0.9rem', fontWeight: 600 }}>Are you absolutely sure?</p>
              </>
            ) : (
              <p style={{ color: '#b91c1c', fontSize: '0.95rem', fontWeight: 600 }}>Are you sure you want to cancel this ride?</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1, padding: '14px' }} onClick={() => setMode('view')}>Keep Ride</button>
              <button
                className="btn"
                style={{ flex: 1, padding: '14px', background: '#ef4444', color: '#fff' }}
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? <span className="spinner" /> : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {mode === 'view' && canModify && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button className="btn btn-outline" onClick={() => setMode('edit')}>✏️ Edit Ride</button>
            <button
              className="btn btn-outline"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
              onClick={() => setMode('cancel')}
            >
              Cancel This Ride
            </button>
          </div>
        )}

        {mode === 'edit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
            <button className="btn btn-outline" onClick={() => setMode('view')}>Cancel Edit</button>
          </div>
        )}

        {mode !== 'cancel' && (
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        )}
      </div>
    </div>
  )
}
