import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function JoinRoom() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState(null)

  const isLoggedIn = !!localStorage.getItem('token')

  useEffect(() => {
    api.get(`/rooms/join/${inviteCode}`)
      .then(res => setRoom(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Room not found'))
      .finally(() => setLoading(false))
  }, [inviteCode])

  const handleJoin = async () => {
    if (!isLoggedIn) {
      localStorage.setItem('pendingJoin', inviteCode)
      navigate('/login')
      return
    }

    setJoining(true)
    try {
      const res = await api.post(`/rooms/join/${inviteCode}`)
      navigate(`/rooms/${res.data.room_id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to join room')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">😕</p>
        <p className="text-gray-400 text-lg">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center space-y-6">
        <p className="text-5xl">🏏</p>

        <div>
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <p className="text-gray-400 mt-2">
            Created by <span className="text-white font-medium">{room.creator_username}</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {room.member_count} member{room.member_count !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="border-t border-gray-800 pt-6">
          <p className="text-gray-400 text-sm mb-4">You've been invited to join this fantasy cricket room!</p>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full px-6 py-3 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors font-medium disabled:opacity-50"
          >
            {joining ? 'Joining...' : isLoggedIn ? 'Join Room' : 'Login & Join'}
          </button>
        </div>
      </div>
    </div>
  )
}
