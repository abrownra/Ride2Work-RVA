import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { forwardGeocode } from '../lib/geocode'

function toMinLocalDatetime() {
  const d = new Date()
  d.setHours(d.getHours() + 2, d.getMinutes(), 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AddressField({ label, value, onChange, homeAddress, workAddress }) {
  return (
    <div className="field">
      <label>{label}</label>
      {(homeAddress || workAddress) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {homeAddress && (
            <button
              type="button"
              onClick={() => onChange(homeAddress)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: '1.5px solid',
                borderColor: value === homeAddress ? '#111' : '#d1d5db',
                background: value === homeAddress ? '#111' : '#fff',
                color: value === homeAddress ? '#fff' : '#374151',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🏠 Home
            </button>
          )}
          {workAddress && (
            <button
              type="button"
              onClick={() => onChange(workAddress)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: '1.5px solid',
                borderColor: value === workAddress ? '#111' : '#d1d5db',
                background: value === workAddress ? '#111' : '#fff',
                color: value === workAddress ? '#fff' : '#374151',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🏢 Work
            </button>
          )}
        </div>
      )}
      <input
        type="text"
        placeholder="Or type a custom address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function RiderRequestRide({ rider, onSuccess, onBack }) {
  const minDt = toMinLocalDatetime()
  const homeAddress = rider.home_address || ''
  const workAddress = rider.work_address || ''

  const [pickupTime,     setPickupTime]     = useState('')
  const [pickupAddress,  setPickupAddress]  = useState(homeAddress)
  const [dropoffAddress, setDropoffAddress] = useState(workAddress)
  const [notes,          setNotes]          = useState('')
  const [error,          setError]          = useState(null)
  const [submitting,     setSubmitting]     = useState(false)

  async function handleSubmit() {
    setError(null)

    if (!pickupTime) { setError('Please select a pickup date and time.'); return }
    if (!pickupAddress.trim()) { setError('Please enter a pickup address.'); return }
    if (!dropoffAddress.trim()) { setError('Please enter a drop-off address.'); return }

    const pickupDate = new Date(pickupTime)
    const twoHrsFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    if (pickupDate < twoHrsFromNow) {
      setError('Rides must be requested at least 2 hours in advance.')
      return
    }

    setSubmitting(true)

    const [pickupGeo, dropoffGeo] = await Promise.all([
      forwardGeocode(pickupAddress),
      forwardGeocode(dropoffAddress),
    ])

    const payload = {
      rider_id:        rider.id,
      pickup_address:  pickupAddress.trim(),
      pickup_lat:      pickupGeo?.lat ?? null,
      pickup_lon:      pickupGeo?.lon ?? null,
      dropoff_address: dropoffAddress.trim(),
      dropoff_lat:     dropoffGeo?.lat ?? null,
      dropoff_lon:     dropoffGeo?.lon ?? null,
      pickup_time:     pickupDate.toISOString(),
      notes:           notes.trim() || null,
      status:          'pending',
    }

    const { data, error: insertError } = await supabase
      .from('ride_requests')
      .insert(payload)
      .select()
      .single()

    if (insertError) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    supabase.functions.invoke('notify-drivers', {
      body: { ride_request_id: data.id },
    }).catch(() => {})

    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#111111' }}>
        <h1>Request a Ride</h1>
        <p>Rides must be booked 2+ hours ahead</p>
      </div>

      <div className="screen-body">
        <div className="field">
          <label>Pickup Date &amp; Time</label>
          <input
            type="datetime-local"
            min={minDt}
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
          />
        </div>

        <AddressField
          label="Pickup Address"
          value={pickupAddress}
          onChange={setPickupAddress}
          homeAddress={homeAddress}
          workAddress={workAddress}
        />

        <AddressField
          label="Drop-off Address"
          value={dropoffAddress}
          onChange={setDropoffAddress}
          homeAddress={homeAddress}
          workAddress={workAddress}
        />

        <div className="field">
          <label>Notes (optional)</label>
          <input
            type="text"
            placeholder="Any special instructions for your driver"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button
          className="btn btn-primary"
          style={{ marginTop: 'auto' }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit Request'}
        </button>

        <button className="btn btn-outline" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
