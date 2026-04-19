import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { forwardGeocode } from '../lib/geocode'

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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

function fmtDay(d) {
  return `${DAY_LABELS[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
}

function toISOPickupTime(dateObj, timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(dateObj)
  dt.setHours(h, m, 0, 0)
  return dt.toISOString()
}

function isWithin2Hrs(dateObj, timeStr) {
  if (!timeStr) return false
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(dateObj)
  dt.setHours(h, m, 0, 0)
  return (dt - Date.now()) < 2 * 60 * 60 * 1000
}

function isPast(dateObj, timeStr) {
  if (!timeStr) return false
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(dateObj)
  dt.setHours(h, m, 0, 0)
  return dt <= new Date()
}

const DEFAULT_DAY_STATE = {
  morning_enabled: false, morning_time: '',
  evening_enabled: false, evening_time: '',
}

export default function RiderMyRides({ rider, onSuccess, onBack }) {
  const upcomingDays = useMemo(() => getUpcomingDays(), [])

  // Shared addresses
  const [homeAddress, setHomeAddress] = useState(rider.home_address || '')
  const [workAddress, setWorkAddress] = useState(rider.work_address || '')

  // Per-day state (keyed by dateString)
  const [dayState, setDayState] = useState(() =>
    Object.fromEntries(upcomingDays.map((d) => [d.toDateString(), { ...DEFAULT_DAY_STATE }]))
  )

  // Recurring schedule (keyed by day-of-week 0–6)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [recurringDays, setRecurringDays] = useState(() => {
    const DAYS = [1,2,3,4,5,6,0]
    return Object.fromEntries(DAYS.map((dow) => [dow, { ...DEFAULT_DAY_STATE }]))
  })

  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [savingRec,    setSavingRec]    = useState(false)
  const [submitError,  setSubmitError]  = useState(null)
  const [recError,     setRecError]     = useState(null)
  const [recSaved,     setRecSaved]     = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [genResult,    setGenResult]    = useState(null)

  useEffect(() => { loadTemplate() }, [])

  async function loadTemplate() {
    setLoading(true)
    const { data } = await supabase
      .from('rider_schedule_templates')
      .select('*')
      .eq('rider_id', rider.id)

    if (data?.length) {
      // Pre-fill addresses from first row
      const first = data[0]
      if (first.pickup_address)  setHomeAddress(first.pickup_address)
      if (first.dropoff_address) setWorkAddress(first.dropoff_address)

      // Build recurring day state
      const rec = {}
      data.forEach((row) => {
        rec[row.day_of_week] = {
          morning_enabled: row.morning_enabled ?? false,
          morning_time:    row.morning_time    ?? '',
          evening_enabled: row.evening_enabled ?? false,
          evening_time:    row.evening_time    ?? '',
        }
      })

      // Pre-fill THIS WEEK based on template
      setDayState((prev) => {
        const next = { ...prev }
        upcomingDays.forEach((d) => {
          const dow = d.getDay()
          const template = rec[dow]
          if (template) {
            next[d.toDateString()] = {
              morning_enabled: template.morning_enabled,
              morning_time:    template.morning_time,
              evening_enabled: template.evening_enabled,
              evening_time:    template.evening_time,
            }
          }
        })
        return next
      })

      // Set recurring panel state
      setRecurringDays((prev) => ({ ...prev, ...rec }))
    }

    setLoading(false)
  }

  function setDay(dateStr, field, value) {
    setDayState((prev) => ({ ...prev, [dateStr]: { ...prev[dateStr], [field]: value } }))
  }

  function setRec(dow, field, value) {
    setRecurringDays((prev) => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }))
  }

  // Collect all rides the rider has toggled on this week
  function collectRides() {
    const rides = []
    upcomingDays.forEach((d) => {
      const s = dayState[d.toDateString()]
      if (s.morning_enabled && s.morning_time) {
        rides.push({ day: d, direction: 'morning', time: s.morning_time })
      }
      if (s.evening_enabled && s.evening_time) {
        rides.push({ day: d, direction: 'evening', time: s.evening_time })
      }
    })
    return rides
  }

  const rides = collectRides()

  async function handleSubmit() {
    setSubmitError(null)

    // Check for toggled days missing a time
    for (const d of upcomingDays) {
      const s = dayState[d.toDateString()]
      if (s.morning_enabled && !s.morning_time) {
        setSubmitError(`Set a morning pickup time for ${fmtDay(d)}.`); return
      }
      if (s.evening_enabled && !s.evening_time) {
        setSubmitError(`Set an evening pickup time for ${fmtDay(d)}.`); return
      }
    }

    if (!rides.length) { setSubmitError('Select at least one ride.'); return }
    if (!homeAddress.trim()) { setSubmitError('Enter your home / pickup address.'); return }
    if (!workAddress.trim()) { setSubmitError('Enter your work / drop-off address.'); return }

    for (const r of rides) {
      if (isWithin2Hrs(r.day, r.time) || isPast(r.day, r.time)) {
        setSubmitError(`${fmtDay(r.day)} ${r.direction} is too soon — must be at least 2 hours from now.`)
        return
      }
    }

    setSubmitting(true)

    // Geocode both addresses once
    const [homeGeo, workGeo] = await Promise.all([
      forwardGeocode(homeAddress),
      forwardGeocode(workAddress),
    ])

    const inserts = rides.map((r) => {
      const isMorning = r.direction === 'morning'
      return {
        rider_id:        rider.id,
        pickup_address:  isMorning ? homeAddress : workAddress,
        pickup_lat:      isMorning ? (homeGeo?.lat ?? null) : (workGeo?.lat ?? null),
        pickup_lon:      isMorning ? (homeGeo?.lon ?? null) : (workGeo?.lon ?? null),
        dropoff_address: isMorning ? workAddress : homeAddress,
        dropoff_lat:     isMorning ? (workGeo?.lat ?? null) : (homeGeo?.lat ?? null),
        dropoff_lon:     isMorning ? (workGeo?.lon ?? null) : (homeGeo?.lon ?? null),
        pickup_time:     toISOPickupTime(r.day, r.time),
        status:          'pending',
      }
    })

    const { data: inserted, error: insertErr } = await supabase
      .from('ride_requests')
      .insert(inserts)
      .select()

    if (insertErr) {
      setSubmitError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    ;(inserted || []).forEach((req) => {
      supabase.functions.invoke('notify-drivers', { body: { ride_request_id: req.id } }).catch(() => {})
    })

    setSubmitting(false)
    onSuccess()
  }

  async function handleSaveRecurring() {
    setSavingRec(true)
    setRecError(null)
    setRecSaved(false)

    const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]
    const upserts = DAYS_ORDER.map((dow) => ({
      rider_id:        rider.id,
      day_of_week:     dow,
      morning_enabled: recurringDays[dow].morning_enabled,
      morning_time:    recurringDays[dow].morning_time || null,
      evening_enabled: recurringDays[dow].evening_enabled,
      evening_time:    recurringDays[dow].evening_time || null,
      pickup_address:  homeAddress.trim() || null,
      dropoff_address: workAddress.trim() || null,
      active:          recurringDays[dow].morning_enabled || recurringDays[dow].evening_enabled,
    }))

    const { error: err } = await supabase
      .from('rider_schedule_templates')
      .upsert(upserts, { onConflict: 'rider_id,day_of_week' })

    setSavingRec(false)
    if (err) { setRecError('Could not save. Please try again.'); return }
    setRecSaved(true)
    setTimeout(() => setRecSaved(false), 3000)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)

    const resp = await supabase.functions.invoke('generate-weekly-rides', {
      body: { rider_id: rider.id },
    })

    setGenerating(false)
    if (resp.error) {
      setRecError('Could not generate rides. Save your recurring schedule first.')
      return
    }
    const count = resp.data?.generated ?? 0
    setGenResult(count === 0
      ? 'Rides for this week are already scheduled.'
      : `${count} ride${count !== 1 ? 's' : ''} added to the pool!`
    )
  }

  const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]
  const DOW_LABELS = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday' }

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#111111' }}>
        <h1>My Rides</h1>
        <p>Schedule your week · Set your routine</p>
      </div>

      <div className="screen-body">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</p>
        ) : (
          <>
            {/* Addresses */}
            <div className="card" style={{ gap: 14 }}>
              <p className="section-title">Your Addresses</p>
              <div className="field">
                <label>Home Address (Pickup)</label>
                <input
                  type="text"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  placeholder="Your home address"
                />
              </div>
              <div className="field">
                <label>Work Address (Drop-off)</label>
                <input
                  type="text"
                  value={workAddress}
                  onChange={(e) => setWorkAddress(e.target.value)}
                  placeholder="Your work address"
                />
              </div>
            </div>

            {/* This Week */}
            <div>
              <p className="section-title" style={{ marginBottom: 10 }}>This Week</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingDays.map((d) => {
                  const key = d.toDateString()
                  const s   = dayState[key]
                  const mTooSoon = s.morning_enabled && s.morning_time && (isWithin2Hrs(d, s.morning_time) || isPast(d, s.morning_time))
                  const eTooSoon = s.evening_enabled && s.evening_time && (isWithin2Hrs(d, s.evening_time) || isPast(d, s.evening_time))
                  const anyActive = s.morning_enabled || s.evening_enabled
                  const hasWarning = mTooSoon || eTooSoon

                  return (
                    <div
                      key={key}
                      style={{
                        background: '#fff',
                        border: `2px solid ${hasWarning ? '#fca5a5' : anyActive ? '#111111' : '#e5e7eb'}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Day label */}
                      <div style={{
                        padding: '10px 16px',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: '#1f2937',
                        borderBottom: anyActive ? '1px solid #f1f5f9' : 'none',
                        background: anyActive ? '#fafafa' : 'transparent',
                      }}>
                        {fmtDay(d)}
                      </div>

                      {/* Morning */}
                      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f9fafb' }}>
                        <button
                          onClick={() => setDay(key, 'morning_enabled', !s.morning_enabled)}
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: '2px solid',
                            borderColor: s.morning_enabled ? '#cc1111' : '#d1d5db',
                            background: s.morning_enabled ? '#cc1111' : '#fff',
                            color: '#fff', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {s.morning_enabled ? '✓' : ''}
                        </button>
                        <span style={{ fontSize: '0.88rem', color: '#374151', flex: 1 }}>
                          🌅 Morning — Home to Work
                        </span>
                        {s.morning_enabled && (
                          <input
                            type="time"
                            value={s.morning_time}
                            onChange={(e) => setDay(key, 'morning_time', e.target.value)}
                            style={{ width: '160px', borderColor: mTooSoon ? '#fca5a5' : undefined }}
                          />
                        )}
                      </div>
                      {mTooSoon && (
                        <div style={{ padding: '4px 16px 8px', fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>
                          Must be at least 2 hours from now
                        </div>
                      )}

                      {/* Evening */}
                      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          onClick={() => setDay(key, 'evening_enabled', !s.evening_enabled)}
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: '2px solid',
                            borderColor: s.evening_enabled ? '#cc1111' : '#d1d5db',
                            background: s.evening_enabled ? '#cc1111' : '#fff',
                            color: '#fff', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {s.evening_enabled ? '✓' : ''}
                        </button>
                        <span style={{ fontSize: '0.88rem', color: '#374151', flex: 1 }}>
                          🌆 Evening — Work to Home
                        </span>
                        {s.evening_enabled && (
                          <input
                            type="time"
                            value={s.evening_time}
                            onChange={(e) => setDay(key, 'evening_time', e.target.value)}
                            style={{ width: '160px', borderColor: eTooSoon ? '#fca5a5' : undefined }}
                          />
                        )}
                      </div>
                      {eTooSoon && (
                        <div style={{ padding: '4px 16px 8px', fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>
                          Must be at least 2 hours from now
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {submitError && <p className="error-msg">{submitError}</p>}

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || rides.length === 0}
            >
              {submitting
                ? <><span className="spinner" /> Submitting…</>
                : rides.length === 0
                  ? 'Select Rides to Schedule'
                  : `Schedule ${rides.length} Ride${rides.length !== 1 ? 's' : ''} →`}
            </button>

            {/* Recurring Schedule section */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setRecurringOpen((v) => !v)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: recurringOpen ? '#f9fafb' : '#fff',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>
                    ⚙️ My Recurring Schedule
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                    Auto-generates every Monday at 6 am
                  </div>
                </div>
                <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                  {recurringOpen ? '▲' : '▼'}
                </span>
              </button>

              {recurringOpen && (
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fafafa' }}>
                  <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 8px' }}>
                    Set your usual weekly pattern. Each Monday morning, rides are auto-submitted to the pool for the coming week.
                  </p>

                  {DAYS_ORDER.map((dow) => {
                    const r = recurringDays[dow]
                    const isActive = r.morning_enabled || r.evening_enabled
                    return (
                      <div
                        key={dow}
                        style={{
                          background: '#fff',
                          border: `2px solid ${isActive ? '#111111' : '#e5e7eb'}`,
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.9rem', color: '#1f2937', borderBottom: isActive ? '1px solid #f1f5f9' : 'none' }}>
                          {DOW_LABELS[dow]}
                        </div>

                        {/* Morning */}
                        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f9fafb' }}>
                          <button
                            onClick={() => setRec(dow, 'morning_enabled', !r.morning_enabled)}
                            style={{
                              width: 26, height: 26, borderRadius: 6, border: '2px solid',
                              borderColor: r.morning_enabled ? '#cc1111' : '#d1d5db',
                              background: r.morning_enabled ? '#cc1111' : '#fff',
                              color: '#fff', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {r.morning_enabled ? '✓' : ''}
                          </button>
                          <span style={{ fontSize: '0.88rem', color: '#374151', flex: 1 }}>🌅 Morning</span>
                          {r.morning_enabled && (
                            <input
                              type="time"
                              value={r.morning_time}
                              onChange={(e) => setRec(dow, 'morning_time', e.target.value)}
                              style={{ width: '160px' }}
                            />
                          )}
                        </div>

                        {/* Evening */}
                        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button
                            onClick={() => setRec(dow, 'evening_enabled', !r.evening_enabled)}
                            style={{
                              width: 26, height: 26, borderRadius: 6, border: '2px solid',
                              borderColor: r.evening_enabled ? '#cc1111' : '#d1d5db',
                              background: r.evening_enabled ? '#cc1111' : '#fff',
                              color: '#fff', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {r.evening_enabled ? '✓' : ''}
                          </button>
                          <span style={{ fontSize: '0.88rem', color: '#374151', flex: 1 }}>🌆 Evening</span>
                          {r.evening_enabled && (
                            <input
                              type="time"
                              value={r.evening_time}
                              onChange={(e) => setRec(dow, 'evening_time', e.target.value)}
                              style={{ width: '160px' }}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {recError && <p className="error-msg">{recError}</p>}

                  {recSaved && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#15803d', fontWeight: 600, fontSize: '0.88rem' }}>
                      ✓ Recurring schedule saved!
                    </div>
                  )}

                  {genResult && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#15803d', fontWeight: 600, fontSize: '0.88rem' }}>
                      ✓ {genResult}
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    onClick={handleSaveRecurring}
                    disabled={savingRec}
                    style={{ marginTop: 4 }}
                  >
                    {savingRec ? <><span className="spinner" /> Saving…</> : 'Save Recurring Schedule'}
                  </button>

                  <button
                    className="btn btn-outline"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    {generating ? <><span className="spinner" /> Generating…</> : '⚡ Generate This Week Now'}
                  </button>
                </div>
              )}
            </div>

            <button className="btn btn-outline" onClick={onBack}>← Back</button>
          </>
        )}
      </div>
    </div>
  )
}
