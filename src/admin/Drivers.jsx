import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { name: '', phone: '', email: '', active: true }

export default function Drivers() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', data }
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    const { data } = await supabase.from('drivers').select('*').order('name')
    setDrivers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY)
    setError(null)
    setModal({ mode: 'add' })
  }

  function openEdit(d) {
    setForm({ name: d.name, phone: d.phone || '', email: d.email || '', active: d.active })
    setError(null)
    setModal({ mode: 'edit', id: d.id })
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)

    if (modal.mode === 'add') {
      const { error } = await supabase.from('drivers').insert({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        active: form.active,
      })
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('drivers').update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        active: form.active,
      }).eq('id', modal.id)
      if (error) { setError(error.message); setSaving(false); return }
    }

    await load()
    setSaving(false)
    setModal(null)
  }

  async function toggleActive(d) {
    await supabase.from('drivers').update({ active: !d.active }).eq('id', d.id)
    load()
  }

  return (
    <div>
      <div className="a-page-header">
        <h1>Drivers</h1>
        <button className="a-btn a-btn-primary" onClick={openAdd}>+ Add Driver</button>
      </div>

      <div className="a-card">
        <div className="a-table-wrap">
          {loading ? (
            <p className="a-empty">Loading…</p>
          ) : drivers.length === 0 ? (
            <p className="a-empty">No drivers yet</p>
          ) : (
            <table className="a-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td>{d.phone || '—'}</td>
                    <td>{d.email || '—'}</td>
                    <td>
                      <span className={`a-badge ${d.active ? 'a-badge-green' : 'a-badge-gray'}`}>
                        {d.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="a-btn a-btn-ghost a-btn-sm" onClick={() => openEdit(d)}>Edit</button>
                        <button className="a-btn a-btn-ghost a-btn-sm" onClick={() => toggleActive(d)}>
                          {d.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="a-modal-backdrop" onClick={() => setModal(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-header">
              {modal.mode === 'add' ? 'Add Driver' : 'Edit Driver'}
              <button className="a-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              {error && <p className="a-error">{error}</p>}
              <div className="a-field">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="a-field-row">
                <div className="a-field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="a-field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <label className="a-toggle">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="a-modal-footer">
              <button className="a-btn a-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="a-btn a-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
