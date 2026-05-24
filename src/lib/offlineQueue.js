import { supabase } from './supabase'

const QUEUE_KEY = 'r2w_offline_queue'

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') }
  catch { return [] }
}

export function queueSize() {
  return getQueue().length
}

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function enqueue(op) {
  // op types:
  //   { type: 'trip_start',     tripId, data }
  //   { type: 'pickup_update',  tripId, data }
  //   { type: 'complete_trip',  tripId, data, sigBase64, sigFileName }
  const q = getQueue()
  q.push({ ...op, _qId: crypto.randomUUID(), _qAt: Date.now() })
  saveQueue(q)
}

export async function flushQueue() {
  const q = getQueue()
  if (!q.length) return { flushed: 0, remaining: 0 }

  const failed = []

  for (const op of q) {
    try {
      if (op.type === 'trip_start') {
        const { error } = await supabase.from('trips').insert(op.data)
        if (error) throw error

      } else if (op.type === 'pickup_update') {
        const { error } = await supabase.from('trips').update(op.data).eq('id', op.tripId)
        if (error) throw error

      } else if (op.type === 'complete_trip') {
        // 1. Upload signature
        let signatureUrl = null
        if (op.sigBase64 && op.sigFileName) {
          const bytes = Uint8Array.from(atob(op.sigBase64), (c) => c.charCodeAt(0))
          const { error: upErr } = await supabase.storage
            .from('signatures')
            .upload(op.sigFileName, bytes, { contentType: 'image/png' })
          if (upErr) throw upErr
          const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(op.sigFileName)
          signatureUrl = urlData.publicUrl
        }
        // 2. Update trip
        const { error } = await supabase
          .from('trips')
          .update({ ...op.data, signature_url: signatureUrl })
          .eq('id', op.tripId)
        if (error) throw error
      }
    } catch {
      failed.push(op)
    }
  }

  saveQueue(failed)
  return { flushed: q.length - failed.length, remaining: failed.length }
}

// Session persistence — saves driver app state across refreshes
const SESSION_KEY = 'r2w_session'

export function saveSession(state) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)) }
  catch {}
}

export function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}
