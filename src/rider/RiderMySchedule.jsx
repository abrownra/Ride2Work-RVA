import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
]

const DEFAULT_DAY = {
  morning_enabled: false,
  morning_time: '',
  evening_enabled: false,
  evening_time: '',
}

export default function RiderMySchedule({ rider, onBack }) {
  const [pickupAddress,  setPickupAddress]  = useState(rider.home_address || '')
  const [dropoffAddress, setDropoffAddress] = useState(rider.work_address || '')
  const [days, setDays] = useState(
    Object.fromEntries(DAYS.map((d) => [d.dow, { ...DEFAULT_DAY }]))
  )
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [error,     setError]     = useState(null)

  useEffect(() => { loadTemplate() }, [])

  async function loadTemplate() {
    setLoading(true)
    const { data } = await supabase
      .from('rider_schedule_templates')
      .select('*')
      .eq('rider_id', rider.id)

    if (data?.length) {
      const first = data[0]
      setPickupAddress(first.pickup_address || rider.home_address || '')
      setDropoffAddress(first.dropoff_address || rider.work_address || '')

      const loaded = Object.fromEntries(DAYS.map((d) => [d.dow, { ...DEFAULT_DAY }]))
      data.forEach((row) => {
        loaded[row.day_of_week] = {
          morning_enabled: row.morning_enabled,
          morning_time:    row.morning_time || '',
          evening_enabled: row.evening_enabled,
          evening_time:    row.evening_time || '',
        }
      })
      setDays(loaded)
    }
    setLoading(false)
  }

  function setDayField(dow, field, value) {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const upserts = DAYS.map((d) => ({
      rider_id:        rider.id,
      day_of_week:     d.dow,
      morning_enabled: days[d.dow].morning_enabled,
      morning_time:    days[d.dow].morning_time || null,
      evening_enabled: days[d.dow].evening_enabled,
      evening_time:    days[d.dow].evening_time || null,
      pickup_address:  pickupAddress.trim() || null,
      dropoff_address: dropoffAddress.trim() || null,
      active:          days[d.dow].morning_enabled || days[d.dow].evening_enabled,
    }))

    const { error: err } = await supabase
      .from('rider_schedule_templates')
      .upsert(upserts, { onConflict: 'rider_id,day_of_week' })

    if (err) { setError('Could not save. Please try again.'); setSaving(false); return }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    setError(null)

    const resp = await supabase.functions.invoke('generate-weekly-rides', {
      body: { rider_id: rider.id },
    })

    setGenerating(false)
    if (resp.error) {
      setError('Could not generate rides. Make sure your schedule is saved first.')
      return
    }
    const count = resp.data?.generated ?? 0
    setGenResult(count === 0
      ? "Your rides for this week are already scheduled."
      : `${count} ride${count !== 1 ? 's' : ''} added to the pool for this week!`
    )
  }

  const anyActive = DAYS.some((d) => days[d.dow].morning_enabled || days[d.dow].evening_enabled)

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#111111' }}>
        <h1>My Schedule</h1>
        <p>Auto-generates every Monday at 6am</p>
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
                <label>Home / Pickup Address</label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Your home address"
                />
              </div>
              <div className="field">
                <label>Work / Drop-off Address</label>
                <input
                  type="text"
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  placeholder="Your work address"
                />
              </div>
            </div>

            {/* Days */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="section-title">Weekly Rides</p>
              {DAYS.map(({ dow, label }) => {
                const d = days[dow]
                const isActive = d.morning_enabled || d.evening_enabled
                return (
                  <div key={dow} style={{
                    background: '#fff',
                    border: `2px solid ${isActive ? '#111111' : '#e5e7eb'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}>
                    {/* Day label */}
                    <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.95rem', color: '#1f2937', borderBottom: isActive ? '1px solid #f1f5f9' : 'none' }}>
                      {label}
                    </div>

                    {/* Morning + Evening toggles */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {/* Morning */}
                      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f9fafb' }}>
                        <button
                          onClick={() => setDayField(dow, 'morning_enabled', !d.morning_enabled)}
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: '2px solid',
                            borderColor: d.morning_enabled ? '#cc1111' : '#d1d5db',
                            background: d.morning_enabled ? '#cc1111' : '#fff',
                            color: '#fff', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {d.morning_enabled ? '✓' : ''}
                        </button>
                        <span style={{ fontSize: '0.88rem', color: '#374151', flex: 1 }}>🌅 Morning (Home → Work)</span>
                        {d.morning_enabled && (
                          <input
                            type="time"
                            value={d.morning_time}
                            onChange={(e) => setDayField(dow, 'morning_time', e.target.value)}
                            style={{ width: 120, padding: '6px 8px', fontSize: '0.88rem', border: '1px solid #e5e7eb', borderRadius: 8 }}
                          />
                        )}
                      </div>

                      {/* Evening */}
                      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          onClick={() => setDayField(dow, 'evening_enabled', !d.evening_enabled)}
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: '2px solid',
                            borderColor: d.evening_enabled ? '#cc1111' : '#d1d5db',
                            background: d.evening_enabled ? '#cc1111' : '#fff',
                            color: '#fff', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {d.evening_enabled ? '✓' : ''}
                        </button>
                        <span style={{ fontSize: '0.88rem', color: '#374151', flex: 1 }}>🌆 Evening (Work → Home)</span>
                        {d.evening_enabled && (
                          <input
                            type="time"
                            value={d.evening_time}
                            onChange={(e) => setDayField(dow, 'evening_time', e.target.value)}
                            style={{ width: 120, padding: '6px 8px', fontSize: '0.88rem', border: '1px solid #e5e7eb', borderRadius: 8 }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && <p className="error-msg">{error}</p>}

            {saved && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#15803d', fontWeight: 600, fontSize: '0.9rem' }}>
                ✓ Schedule saved!
              </div>
            )}

            {genResult && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#15803d', fontWeight: 600, fontSize: '0.9rem' }}>
                ✓ {genResult}
              </div>
            )}

            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 'auto' }}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Save Schedule'}
            </button>

            <button
              className="btn btn-outline"
              onClick={handleGenerate}
              disabled={generating || !anyActive}
            >
              {generating ? <><span className="spinner" /> Generating…</> : '⚡ Generate This Week\'s Rides Now'}
            </button>

            <button className="btn btn-outline" onClick={onBack}>← Back</button>
          </>
        )}
      </div>
    </div>
  )
}
