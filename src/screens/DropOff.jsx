import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../lib/supabase'
import { getCurrentPosition, reverseGeocode } from '../lib/geocode'

export default function DropOff({ trip, driver, onNext, onBack }) {
  const sigRef = useRef(null)
  const [sigEmpty, setSigEmpty] = useState(true)
  const [odometerEnd, setOdometerEnd] = useState('')
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [gpsData, setGpsData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState({})

  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['rate_standard', 'rate_long_distance', 'long_distance_threshold_miles', 'rate_additional_rider'])
      .then(({ data }) => {
        const s = {}
        ;(data || []).forEach((r) => (s[r.key] = parseFloat(r.value)))
        setSettings(s)
      })
  }, [])

  async function handleDropOff() {
    setError(null)
    setGpsStatus('locating')

    let position
    try {
      position = await getCurrentPosition()
      setGpsStatus('ok')
    } catch {
      setGpsStatus('error')
      setError('GPS unavailable — please enable location and try again.')
      return
    }

    const address = await reverseGeocode(position.lat, position.lon)
    setGpsData({ ...position, address })
  }

  async function handleComplete() {
    if (!gpsData || sigEmpty || !odometerEnd) return
    setSaving(true)
    setError(null)

    // Upload signature
    let signatureUrl = null
    try {
      const dataUrl = sigRef.current.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const fileName = `trip-${trip.id}-${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage
        .from('signatures')
        .upload(fileName, bytes, { contentType: 'image/png' })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(fileName)
      signatureUrl = urlData.publicUrl
    } catch (e) {
      setError(`Signature upload failed: ${e.message}`)
      setSaving(false)
      return
    }

    // Calculate rate
    const odoEnd = parseInt(odometerEnd, 10)
    const miles = odoEnd - trip.odometer_start
    const threshold = settings.long_distance_threshold_miles ?? 20
    const rate =
      miles > threshold
        ? (settings.rate_long_distance ?? 21.0)
        : (settings.rate_standard ?? 17.66)
    const additionalRate = settings.rate_additional_rider ?? 0
    const tripTotal = rate + (additionalRate * (trip.rider_count - 1))

    const { data, error: dbErr } = await supabase
      .from('trips')
      .update({
        dropoff_lat: gpsData.lat,
        dropoff_lon: gpsData.lon,
        dropoff_address: gpsData.address,
        dropoff_timestamp: new Date().toISOString(),
        odometer_end: odoEnd,
        miles_traveled: miles,
        signature_url: signatureUrl,
        rate_applied: rate,
        trip_total: tripTotal,
        status: 'completed',
      })
      .eq('id', trip.id)
      .select()
      .single()

    setSaving(false)

    if (dbErr) {
      setError(dbErr.message)
      return
    }

    onNext(data)
  }

  const canComplete = gpsData && !sigEmpty && odometerEnd

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Drop Off</h1>
        <p>Trip #{trip.trip_number} · Driver: {driver.name}</p>
      </div>

      <div className="screen-body">
        {error && <p className="error-msg">{error}</p>}

        {/* Step 1: GPS */}
        {!gpsData ? (
          <>
            <div className={`gps-status${gpsStatus === 'error' ? ' error' : ''}`}>
              {gpsStatus === 'idle' && '📍 Tap the button to capture drop-off location'}
              {gpsStatus === 'locating' && <><div className="spinner spinner-dark" /> Getting GPS…</>}
              {gpsStatus === 'error' && '✗ GPS failed — try again'}
            </div>

            <button
              className="btn btn-primary"
              disabled={gpsStatus === 'locating'}
              onClick={handleDropOff}
            >
              {gpsStatus === 'locating'
                ? <><div className="spinner" /> Getting location…</>
                : '📍 We Have Arrived'}
            </button>
          </>
        ) : (
          <div className="gps-status ok">✓ Drop-off: {gpsData.address}</div>
        )}

        {/* Odometer */}
        <div className="field">
          <label>Odometer End (miles)</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder={`Started at ${trip.odometer_start}`}
            value={odometerEnd}
            onChange={(e) => setOdometerEnd(e.target.value)}
          />
          {odometerEnd && parseInt(odometerEnd) > trip.odometer_start && (
            <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)' }}>
              {parseInt(odometerEnd) - trip.odometer_start} miles
            </p>
          )}
        </div>

        {/* Signature */}
        <div className="field">
          <label>Rider Signature</label>
          <div className="sig-wrap">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1f2937"
              canvasProps={{ width: 400, height: 160, style: { width: '100%' } }}
              onEnd={() => setSigEmpty(false)}
            />
            {sigEmpty && <span className="sig-placeholder">Rider signs here</span>}
            <button
              className="sig-clear"
              onClick={() => {
                sigRef.current.clear()
                setSigEmpty(true)
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <button className="btn btn-outline" onClick={onBack}>
          ← Back to Trips
        </button>

        <button
          className="btn btn-green"
          disabled={!canComplete || saving}
          onClick={handleComplete}
          style={{ marginTop: 'auto' }}
        >
          {saving ? <><div className="spinner" /> Saving…</> : '✓ Complete Trip'}
        </button>
      </div>
    </div>
  )
}
