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
