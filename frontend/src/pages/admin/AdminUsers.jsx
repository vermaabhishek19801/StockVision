import { useEffect, useState } from 'react'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { FiSearch, FiEdit2, FiUser, FiShield } from 'react-icons/fi'
import clsx from 'clsx'

const PLAN_COLORS = { free: 'text-gray-400 bg-gray-800', basic: 'text-blue-400 bg-blue-400/10', pro: 'text-purple-400 bg-purple-400/10', enterprise: 'text-green-400 bg-green-400/10' }
const ROLE_COLORS = { user: 'text-gray-300', admin: 'text-purple-400', superadmin: 'text-red-400' }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetchUsers = async (p = 1, s = search, pf = planFilter) => {
    setLoading(true)
    try {
      const res = await adminAPI.getUsers({ page: p, limit: 20, search: s, plan: pf })
      setUsers(res.data.users || [])
      setTotal(res.data.total || 0)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchUsers(1, search, planFilter)
  }

  const handleEdit = (user) => {
    setEditUser(user)
    setEditForm({ role: user.role, isActive: user.isActive, 'subscription.plan': user.subscription?.plan })
  }

  const handleSave = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      const updates = {
        role: editForm.role,
        isActive: editForm.isActive,
        subscription: { ...editUser.subscription, plan: editForm['subscription.plan'] }
      }
      await adminAPI.updateUser(editUser._id, updates)
      toast.success('User updated')
      setEditUser(null)
      fetchUsers(page)
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed') }
    finally { setSaving(false) }
  }

  const pages = Math.ceil(total / 20)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FiUser /> User Management</h1>
        <span className="text-gray-400 text-sm">{total} total users</span>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="input pl-9 h-9 text-sm" />
        </div>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); fetchUsers(1, search, e.target.value) }} className="input h-9 text-sm w-32">
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <button type="submit" className="btn-primary text-sm h-9 px-4">Search</button>
      </form>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800">
              {['Name', 'Email', 'Role', 'Plan', 'Status', 'Last Login', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : users.map(u => (
                <tr key={u._id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('flex items-center gap-1 text-xs font-medium', ROLE_COLORS[u.role])}>
                      {u.role === 'admin' && <FiShield size={11} />}{u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', PLAN_COLORS[u.subscription?.plan])}>{u.subscription?.plan}</span></td>
                  <td className="px-4 py-3"><span className={clsx('text-xs font-medium', u.isActive ? 'text-green-400' : 'text-red-400')}>{u.isActive ? 'Active' : 'Suspended'}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-IN') : '–'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleEdit(u)} className="text-gray-400 hover:text-blue-400 transition-colors"><FiEdit2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => { setPage(p => p - 1); fetchUsers(page - 1) }} className="btn-secondary text-xs px-3 h-7 disabled:opacity-50">Prev</button>
              <button disabled={page === pages} onClick={() => { setPage(p => p + 1); fetchUsers(page + 1) }} className="btn-secondary text-xs px-3 h-7 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditUser(null)}>
          <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-4">Edit User: {editUser.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} className="input text-sm">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Plan</label>
                <select value={editForm['subscription.plan']} onChange={e => setEditForm(p => ({ ...p, 'subscription.plan': e.target.value }))} className="input text-sm">
                  {['free', 'basic', 'pro', 'enterprise'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={editForm.isActive} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded bg-gray-800" />
                <label htmlFor="active" className="text-sm text-gray-300">Account Active</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditUser(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
