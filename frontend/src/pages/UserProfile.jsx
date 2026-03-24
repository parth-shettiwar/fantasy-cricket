import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'

const STATUS_BADGE = {
  upcoming: 'bg-pink-900/40 text-pink-400 border-pink-800',
  live: 'bg-red-900/50 text-red-400 border-red-800',
  completed: 'bg-gray-800/50 text-gray-400 border-gray-700',
}

export default function UserProfile() {
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/points/user/${userId}/profile`)
      .then(res => setProfile(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
      </div>
    )
  }

  if (!profile) return <p className="text-red-400">User not found</p>

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {profile.matches_played} match{profile.matches_played !== 1 ? 'es' : ''} played
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-pink-400">{profile.total_points.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">Total Points</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Match History</h2>

        {profile.teams.length === 0 ? (
          <p className="text-gray-500 text-sm">No teams created yet.</p>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_120px_1fr_80px_80px] gap-3 px-5 py-3 text-xs text-gray-500 font-medium border-b border-gray-800">
              <span>Match</span>
              <span>Date</span>
              <span>Captain / VC</span>
              <span className="text-right">Points</span>
              <span className="text-right">Status</span>
            </div>

            {profile.teams.map(team => {
              if (!team.locked) {
                return (
                  <div
                    key={team.user_team_id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_80px_80px] gap-1 sm:gap-3 px-5 py-4 items-center border-b border-gray-800/50"
                  >
                    <span className="font-medium text-sm">{team.match_name}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(team.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-xs text-gray-500 italic">Hidden until match starts</span>
                    <span className="text-right text-gray-600 text-sm">-</span>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[team.match_status] || STATUS_BADGE.upcoming}`}>
                        {team.match_status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )
              }
              return (
                <Link
                  key={team.user_team_id}
                  to={`/team/${team.user_team_id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_80px_80px] gap-1 sm:gap-3 px-5 py-4 items-center border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-sm">{team.match_name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(team.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="text-xs">
                    <span className="text-orange-400">{team.captain}</span>
                    <span className="text-gray-600 mx-1">/</span>
                    <span className="text-cyan-400">{team.vice_captain}</span>
                  </div>
                  <span className="text-right font-semibold text-pink-400 text-sm">
                    {team.total_points.toFixed(1)}
                  </span>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[team.match_status] || STATUS_BADGE.upcoming}`}>
                      {team.match_status.toUpperCase()}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex justify-center">
        <Link to="/leaderboard" className="text-sm text-gray-400 hover:text-white transition-colors">
          &larr; Back to leaderboard
        </Link>
      </div>
    </div>
  )
}
