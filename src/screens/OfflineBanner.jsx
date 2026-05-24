import { useEffect, useState } from 'react'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { flushQueue, queueSize } from '../lib/offlineQueue'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  const [pending, setPending] = useState(queueSize())
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [visible, setVisible] = useState(false)

  // Update pending count whenever queue might change
  useEffect(() => {
    setPending(queueSize())
  }, [online])

  // Auto-flush when back online
  useEffect(() => {
    if (!online) { setVisible(true); setSyncMsg(null); return }

    const p = queueSize()
    setPending(p)

    if (p > 0) {
      setVisible(true)
      setSyncing(true)
      flushQueue().then(({ flushed, remaining }) => {
        setSyncing(false)
        setPending(remaining)
        if (flushed > 0) {
          setSyncMsg(`${flushed} trip${flushed !== 1 ? 's' : ''} synced`)
          setTimeout(() => { setSyncMsg(null); setVisible(false) }, 4000)
        } else {
          setVisible(false)
        }
      })
    } else {
      // briefly show "back online"
      setVisible(true)
      setSyncMsg('Back online')
      setTimeout(() => { setSyncMsg(null); setVisible(false) }, 3000)
    }
  }, [online])

  if (!visible) return null

  const isOffline = !online
  const bg    = isOffline ? '#1e3a8a' : syncing ? '#92400e' : '#166534'
  const label = isOffline
    ? pending > 0
      ? `Offline — ${pending} trip${pending !== 1 ? 's' : ''} queued locally`
      : 'No connection — trips will be queued'
    : syncing
      ? `Syncing ${pending} queued trip${pending !== 1 ? 's' : ''}…`
      : syncMsg || 'Back online'

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 2000,
      background: bg,
      color: '#fff',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      fontSize: '0.85rem',
      fontWeight: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isOffline && (
          <span style={{ fontSize: '1rem' }}>📵</span>
        )}
        {syncing && (
          <div style={{
            width: 14, height: 14,
            border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'offlineSpin 0.7s linear infinite',
            flexShrink: 0,
          }} />
        )}
        {!isOffline && !syncing && <span style={{ fontSize: '1rem' }}>✓</span>}
        <span>{label}</span>
      </div>

      {isOffline && pending > 0 && (
        <span style={{ fontSize: '0.75rem', opacity: 0.75, fontWeight: 500 }}>
          Will sync automatically
        </span>
      )}

      <style>{`
        @keyframes offlineSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
