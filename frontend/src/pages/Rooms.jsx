import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchRooms = () => {
    api.get('/rooms/')
      .then(res => setRooms(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRooms() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.post('/rooms/', { name: newName.trim() })
      setNewName('')
      setShowCreate(false)
      fetchRooms()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create room')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Rooms</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500 transition-colors font-medium text-sm"
        >
          + Create Room
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Room Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Office IPL League"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-pink-500"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500 transition-colors font-medium text-sm disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {rooms.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🏠</p>
          <p className="text-gray-400 text-lg">No rooms yet</p>
          <p className="text-gray-500 text-sm mt-1">Create a room and share the link with your friends!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rooms.map(room => (
            <Link
              key={room.id}
              to={`/rooms/${room.id}`}
              className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-pink-800/50 transition-colors block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{room.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {room.member_count} member{room.member_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full font-mono">
                    {room.invite_code}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
