import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'

export default function RoomDetail() {
  const { roomId } = useParams()
  const [room, setRoom] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/rooms/${roomId}`),
      api.get(`/rooms/${roomId}/leaderboard`),
    ])
      .then(([roomRes, lbRes]) => {
        setRoom(roomRes.data)
        setLeaderboard(lbRes.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [roomId])

  const shareLink = room ? `${window.location.origin}/join/${room.invite_code}` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this room?')) return
    setLeaving(true)
    try {
      await api.delete(`/rooms/${roomId}/leave`)
      window.location.href = '/rooms'
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to leave room')
      setLeaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
      </div>
    )
  }

  if (!room) {
    return <p className="text-gray-400 text-center mt-12">Room not found</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            Created by {room.creator_username} · {room.member_count} member{room.member_count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleLeave}
          disabled={leaving}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors text-sm"
        >
          Leave Room
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <p className="text-sm text-gray-400 mb-2">Share this link with friends to invite them:</p>
        <div className="flex items-center gap-3">
          <input
            readOnly
            value={shareLink}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm font-mono"
          />
          <button
            onClick={copyLink}
            className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500 transition-colors text-sm font-medium whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Room Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-gray-400">No scores yet. Create teams for upcoming matches!</p>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="grid grid-cols-[60px_1fr_100px_80px] gap-4 px-5 py-3 text-xs text-gray-500 font-medium border-b border-gray-800">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-right">Points</span>
              <span className="text-right">Teams</span>
            </div>

            {leaderboard.map((entry, i) => {
              const rank = i + 1
              return (
                <div
                  key={entry.user_id}
                  className={`grid grid-cols-[60px_1fr_100px_80px] gap-4 px-5 py-4 items-center border-b border-gray-800/50 ${
                    rank <= 3 ? 'bg-pink-900/10' : ''
                  }`}
                >
                  <span className={`font-bold ${
                    rank === 1 ? 'text-yellow-400 text-lg' :
                    rank === 2 ? 'text-gray-300 text-lg' :
                    rank === 3 ? 'text-amber-600 text-lg' :
                    'text-gray-500'
                  }`}>
                    #{rank}
                  </span>
                  <Link to={`/user/${entry.user_id}`} className="font-medium hover:text-pink-400 transition-colors">{entry.username}</Link>
                  <span className="text-right font-semibold text-pink-400">{entry.total_points.toFixed(1)}</span>
                  <span className="text-right text-gray-400">{entry.teams_count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Members</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {room.members.map(member => (
            <div key={member.user_id} className="px-5 py-3 flex items-center justify-between">
              <Link to={`/user/${member.user_id}`} className="font-medium hover:text-pink-400 transition-colors">{member.username}</Link>
              {member.user_id === room.created_by && (
                <span className="text-xs bg-pink-900/30 text-pink-400 px-2 py-0.5 rounded-full">Admin</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
