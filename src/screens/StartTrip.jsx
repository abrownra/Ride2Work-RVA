import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentPosition, reverseGeocode } from '../lib/geocode'

export default function StartTrip({ driver, onNext, onBack }) {
  const [riders, setRiders] = useState([])
  const [riderId, setRiderId] = useState('')
  const [riderCount, setRiderCount] = useState(1)
  const [odometerStart, setOdometerStart] = useState('')
  const [gpsStatus, setGpsStatus] = useState('idle') // idle | locating | ok | error
  const [gpsData, setGpsData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('riders')
      .select('id, name')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setRiders(data || []))
  }, [])

  async function handleOnMyWay() {
    if (!riderId || !odometerStart) return
    setError(null)
    setGpsStatus('locating')
    setSaving(true)

    let position
    try {
      position = await getCurrentPosition()
      setGpsStatus('ok')
    } catch (e) {
      setGpsStatus('error')
      setError('GPS unavailable — please enable location and try again.')
      setSaving(false)
      return
    }

    const address = await reverseGeocode(position.lat, position.lon)
    setGpsData({ ...position, address })

    const { data, error: dbErr } = await supabase
      .from('trips')
      .insert({
        driver_id: driver.id,
        rider_id: riderId,
        rider_count: riderCount,
        odometer_start: parseInt(odometerStart, 10),
        start_lat: position.lat,
        start_lon: position.lon,
        start_address: address,
        start_timestamp: new Date().toISOString(),
        status: 'in_progress',
      })
      .select()
      .single()

    setSaving(false)

    if (dbErr) {
      setError(dbErr.message)
      return
    }

    onNext(data)
  }

  const canProceed = riderId && odometerStart && gpsStatus !== 'locating' && !saving

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Start Trip</h1>
        <p>Driver: {driver.name}</p>
      </div>

      <div className="screen-body">
        {error && <p className="error-msg">{error}</p>}

        <div className="field">
          <label>Rider</label>
          <select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
            <option value="">— Select rider —</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Number of Riders</label>
          <div className="stepper">
            <button onClick={() => setRiderCount((c) => Math.max(1, c - 1))}>−</button>
            <span className="stepper-val">{riderCount}</span>
            <button onClick={() => setRiderCount((c) => c + 1)}>+</button>
          </div>
        </div>

        <div className="field">
          <label>Odometer Start (miles)</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 45230"
            value={odometerStart}
            onChange={(e) => setOdometerStart(e.target.value)}
          />
        </div>

        {gpsStatus !== 'idle' && (
          <div className={`gps-status${gpsStatus === 'ok' ? ' ok' : gpsStatus === 'error' ? ' error' : ''}`}>
            {gpsStatus === 'locating' && <><div className="spinner spinner-dark" /> Getting GPS location…</>}
            {gpsStatus === 'ok' && <>✓ {gpsData?.address}</>}
            {gpsStatus === 'error' && <>✗ GPS failed</>}
          </div>
        )}

        <button
          className="btn btn-primary"
          disabled={!canProceed}
          onClick={handleOnMyWay}
          style={{ marginTop: 'auto' }}
        >
          {saving ? <><div className="spinner" /> Saving…</> : "I'm On My Way →"}
        </button>

        <button className="btn btn-outline" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}
