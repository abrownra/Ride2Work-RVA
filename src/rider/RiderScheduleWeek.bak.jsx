import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { forwardGeocode } from '../lib/geocode'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getUpcomingDays() {
  const days = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    d.setHours(0, 0, 0, 0)
    days.push(d)
  }
  return days
}

function isWithinTwoHours(dateObj, timeStr) {
  if (!timeStr) return false
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(dateObj)
  dt.setHours(h, m, 0, 0)
  return (dt - Date.now()) < 2 * 60 * 60 * 1000
}

function fmt(dateObj) {
  return `${DAY_LABELS[dateObj.getDay()]} ${MONTH_LABELS[dateObj.getMonth()]} ${dateObj.getDate()}`
}

function toISOPickupTime(dateObj, timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(dateObj)
  dt.setHours(h, m, 0, 0)
  return dt.toISOString()
}

export default function RiderScheduleWeek({ rider, onSuccess, onBack }) {
  const upcomingDays = useMemo(() => getUpcomingDays(), [])

  // Defaults applied to all days unless overridden
  const [defaultTime,    setDefaultTime]    = useState('')
  const [defaultPickup,  setDefaultPickup]  = useState(rider.home_address || '')
  const [defaultDropoff, setDefaultDropoff] = useState(rider.work_address || '')

  // Per-day state: { enabled, expanded, time?, pickup?, dropoff? }
  const [dayState, setDayState] = useState(() =>
    Object.fromEntries(upcomingDays.map((d) => [
      d.toDateString(),
      { enabled: false, expanded: false, time: null, pickup: null, dropoff: null },
    ]))
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  function toggleDay(d) {
    const key = d.toDateString()
    setDayState((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled, expanded: !prev[key].enabled },
    }))
  }

  function toggleExpand(d) {
    const key = d.toDateString()
    setDayState((prev) => ({
      ...prev,
      [key]: { ...prev[key], expanded: !prev[key].expanded },
    }))
  }

  function setDayField(d, field, value) {
    const key = d.toDateString()
    setDayState((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  // Effective values for a day (own override or fall back to defaults)
  function effective(d) {
    const s = dayState[d.toDateString()]
    return {
      time:    s.time    ?? defaultTime,
      pickup:  s.pickup  ?? defaultPickup,
      dropoff: s.dropoff ?? defaultDropoff,
    }
  }

  const selectedDays = upcomingDays.filter((d) => dayState[d.toDateString()].enabled)

  async function handleSubmit() {
    setError(null)

    if (!selectedDays.length) { setError('Select at least one day.'); return }

    for (const d of selectedDays) {
      const { time, pickup, dropoff } = effective(d)
      if (!time)    { setError(`Set a pickup time for ${fmt(d)}.`); return }
      if (!pickup)  { setError(`Set a pickup address for ${fmt(d)}.`); return }
      if (!dropoff) { setError(`Set a drop-off address for ${fmt(d)}.`); return }
      if (isWithinTwoHours(d, time)) {
        setError(`${fmt(d)} is within 2 hours — please choose a later time.`)
        return
      }
    }

    setSubmitting(true)

    // Geocode unique addresses to avoid redundant calls
    const uniqueAddresses = [...new Set(selectedDays.flatMap((d) => {
      const e = effective(d)
      return [e.pickup, e.dropoff]
    }))]
    const geoCache = {}
    await Promise.all(uniqueAddresses.map(async (addr) => {
      geoCache[addr] = await forwardGeocode(addr)
    }))

    const inserts = selectedDays.map((d) => {
      const { time, pickup, dropoff } = effective(d)
      const pg = geoCache[pickup]
      const dg = geoCache[dropoff]
      return {
        rider_id:        rider.id,
        pickup_address:  pickup,
        pickup_lat:      pg?.lat ?? null,
        pickup_lon:      pg?.lon ?? null,
        dropoff_address: dropoff,
        dropoff_lat:     dg?.lat ?? null,
        dropoff_lon:     dg?.lon ?? null,
        pickup_time:     toISOPickupTime(d, time),
        status:          'pending',
      }
    })

    const { data: inserted, error: insertError } = await supabase
      .from('ride_requests')
      .insert(inserts)
      .select()

    if (insertError) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    // Notify drivers for each new request (fire and forget)
    ;(inserted || []).forEach((r) => {
      supabase.functions.invoke('notify-drivers', { body: { ride_request_id: r.id } }).catch(() => {})
    })

    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#111111' }}>
        <h1>Schedule My Week</h1>
        <p>Set defaults, then customize each day</p>
      </div>

      <div className="screen-body">
        {/* Defaults */}
        <div className="card" style={{ gap: 14 }}>
          <p className="section-title">Defaults — applied to all selected days</p>

          <div className="field">
            <label>Pickup Time</label>
            <input
              type="time"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Pickup Address</label>
            <input
              type="text"
              value={defaultPickup}
              onChange={(e) => setDefaultPickup(e.target.value)}
              placeholder="Where to pick you up"
            />
          </div>

          <div className="field">
            <label>Drop-off Address</label>
            <input
              type="text"
              value={defaultDropoff}
              onChange={(e) => setDefaultDropoff(e.target.value)}
              placeholder="Where you're going"
            />
          </div>
        </div>

        {/* Day toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="section-title">Select Days</p>

          {upcomingDays.map((d) => {
            const key   = d.toDateString()
            const s     = dayState[key]
            const ef    = effective(d)
            const tooSoon = s.enabled && ef.time && isWithinTwoHours(d, ef.time)
            const isCustomized = s.time !== null || s.pickup !== null || s.dropoff !== null

            return (
              <div
                key={key}
                style={{
                  background: '#fff',
                  border: `2px solid ${s.enabled ? (tooSoon ? '#fca5a5' : '#111111') : '#e5e7eb'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: 1,
                }}
              >
                {/* Day header row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
                  {/* Toggle checkbox */}
                  <button
                    onClick={() => toggleDay(d)}
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: '2px solid',
                      borderColor: s.enabled ? '#111111' : '#d1d5db',
                      background: s.enabled ? '#111111' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                      color: '#fff', fontSize: '0.9rem',
                    }}
                  >
                    {s.enabled ? '✓' : ''}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>
                      {fmt(d)}
                      {isCustomized && (
                        <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 600, color: '#cc1111', background: '#fee2e2', padding: '2px 6px', borderRadius: 999 }}>
                          Custom
                        </span>
                      )}
                    </div>
                    {s.enabled && ef.time && (
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                        {ef.time} · {ef.pickup || '—'}
                      </div>
                    )}
                    {tooSoon && (
                      <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: 2, fontWeight: 600 }}>
                        Within 2 hours — choose a later time
                      </div>
                    )}
                  </div>

                  {s.enabled && (
                    <button
                      onClick={() => toggleExpand(d)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#6b7280', fontSize: '0.82rem', fontWeight: 600,
                        padding: '4px 8px',
                      }}
                    >
                      {s.expanded ? 'Close ▲' : 'Edit ▼'}
                    </button>
                  )}
                </div>

                {/* Per-day edit panel */}
                {s.enabled && s.expanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#fafafa' }}>
                    <div className="field">
                      <label>Pickup Time</label>
                      <input
                        type="time"
                        value={s.time ?? defaultTime}
                        onChange={(e) => setDayField(d, 'time', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Pickup Address</label>
                      <input
                        type="text"
                        value={s.pickup ?? defaultPickup}
                        onChange={(e) => setDayField(d, 'pickup', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Drop-off Address</label>
                      <input
                        type="text"
                        value={s.dropoff ?? defaultDropoff}
                        onChange={(e) => setDayField(d, 'dropoff', e.target.value)}
                      />
                    </div>
                    <button
                      style={{
                        background: 'none', border: 'none', color: '#6b7280',
                        fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', padding: 0,
                      }}
                      onClick={() => setDayState((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], time: null, pickup: null, dropoff: null },
                      }))}
                    >
                      ↩ Reset to defaults
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button
          className="btn btn-primary"
          style={{ marginTop: 'auto' }}
          onClick={handleSubmit}
          disabled={submitting || selectedDays.length === 0}
        >
          {submitting
            ? <><span className="spinner" /> Scheduling…</>
            : `Schedule ${selectedDays.length} Ride${selectedDays.length !== 1 ? 's' : ''}`}
        </button>

        <button className="btn btn-outline" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
