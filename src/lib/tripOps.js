/**
 * Trip operation wrappers.
 *
 * When FEATURES.offlineMode is true, these functions transparently queue
 * operations to localStorage if the device is offline and flush on reconnect.
 * When false, they are pure pass-throughs to Supabase — zero offline overhead.
 *
 * Trip screens (StartTrip, PickUp, DropOff) call these instead of supabase
 * directly, so they stay unaware of whether offline mode is active.
 */
import { supabase } from './supabase'
import { FEATURES } from './features'
import { enqueue } from './offlineQueue'

export async function insertTrip(payload) {
  if (FEATURES.offlineMode && !navigator.onLine) {
    enqueue({ type: 'trip_start', tripId: payload.id, data: payload })
    return {
      data: { ...payload, trip_number: '(sync pending)', created_at: new Date().toISOString() },
      error: null,
      offline: true,
    }
  }
  const { data, error } = await supabase.from('trips').insert(payload).select().single()
  return { data, error, offline: false }
}

export async function updatePickup(tripId, updateData) {
  if (FEATURES.offlineMode && !navigator.onLine) {
    enqueue({ type: 'pickup_update', tripId, data: updateData })
    return { error: null, offline: true }
  }
  const { error } = await supabase.from('trips').update(updateData).eq('id', tripId)
  return { error, offline: false }
}

/**
 * Returns the total differential surcharge per rider for a given timestamp.
 * Checks all active differential_rules and sums surcharges for matching rules.
 * Handles overnight time windows (e.g. 19:00–06:00 spanning midnight).
 */
async function calcDifferential(timestamp) {
  if (!FEATURES.differential) return 0
  const { data: rules } = await supabase
    .from('differential_rules')
    .select('*')
    .eq('active', true)
  if (!rules?.length) return 0

  const dt = new Date(timestamp)
  // Day of week in local time: 0=Sun, 6=Sat
  const dow = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })
  const dayNum = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dow)
  // Minutes since midnight in local time
  const localStr = dt.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })
  const [hh, mm] = localStr.split(':').map(Number)
  const minsNow = hh * 60 + mm

  let total = 0
  for (const rule of rules) {
    let matches = false
    // Day-of-week check
    if (rule.days?.length) {
      matches = rule.days.includes(dayNum)
    }
    // Time window check
    if (!matches && rule.time_start && rule.time_end) {
      const [sh, sm] = rule.time_start.split(':').map(Number)
      const [eh, em] = rule.time_end.split(':').map(Number)
      const start = sh * 60 + sm
      const end   = eh * 60 + em
      // Overnight window (e.g. 19:00–06:00): spans midnight
      if (start > end) {
        matches = minsNow >= start || minsNow < end
      } else {
        matches = minsNow >= start && minsNow < end
      }
    }
    if (matches) total += Number(rule.surcharge) || 0
  }
  return total
}

export async function completeTrip(tripId, updateData, sigBase64, sigFileName) {
  if (FEATURES.offlineMode && !navigator.onLine) {
    enqueue({ type: 'complete_trip', tripId, data: updateData, sigBase64, sigFileName })
    return {
      data: { ...updateData, signature_url: `data:image/png;base64,${sigBase64}` },
      error: null,
      offline: true,
    }
  }

  // Upload signature
  try {
    const bytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0))
    const { error: upErr } = await supabase.storage
      .from('signatures')
      .upload(sigFileName, bytes, { contentType: 'image/png' })
    if (upErr) return { data: null, error: upErr, offline: false }
    const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(sigFileName)

    // Apply differential driver bonus if module is active
    // rate_differential is extra driver pay only — does NOT affect trip_total (invoice amount)
    const tripTimestamp = updateData.start_timestamp || new Date().toISOString()
    const differential = await calcDifferential(tripTimestamp)
    if (differential > 0) {
      updateData = { ...updateData, rate_differential: differential }
    }

    const { data, error } = await supabase
      .from('trips')
      .update({ ...updateData, signature_url: urlData.publicUrl })
      .eq('id', tripId)
      .select()
      .single()

    if (!error && data?.ride_request_id) {
      await supabase
        .from('ride_requests')
        .update({ status: 'completed' })
        .eq('id', data.ride_request_id)
    }

    return { data, error, offline: false }
  } catch (e) {
    return { data: null, error: e, offline: false }
  }
}
