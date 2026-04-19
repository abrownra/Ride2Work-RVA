import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { forwardGeocode } from '../lib/geocode'

function toMinLocalDatetime() {
  const d = new Date()
  d.setHours(d.getHours() + 2, d.getMinutes(), 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function RiderRequestRide({ rider, onSuccess, onBack }) {
  const minDt = toMinLocalDatetime()

  const [pickupTime, setPickupTime]       = useState('')
  const [pickupAddress, setPickupAddress] = useState(rider.home_address || '')
  const [dropoffAddress, setDropoffAddress] = useState(rider.work_address || '')
  const [notes, setNotes]                 = useState('')
  const [error, setError]                 = useState(null)
  const [submitting, setSubmitting]       = useState(false)

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

    // Geocode both addresses (best effort — don't block on failure)
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

    // Notify drivers via edge function (fire and forget)
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

        <div className="field">
          <label>Pickup Address</label>
          <input
            type="text"
            placeholder="Where should the driver pick you up?"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Drop-off Address</label>
          <input
            type="text"
            placeholder="Where are you going?"
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
          />
        </div>

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
