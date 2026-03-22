import { useState, useEffect } from 'react'
import api from '../api/client'

export default function Leaderboard() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/points/leaderboard')
      .then(res => setEntries(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      {entries.length === 0 ? (
        <p className="text-gray-400">No players on the leaderboard yet. Create a team to get started!</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_100px_80px] gap-4 px-5 py-3 text-xs text-gray-500 font-medium border-b border-gray-800">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Points</span>
            <span className="text-right">Teams</span>
          </div>

          {entries.map((entry, i) => {
            const rank = i + 1
            return (
              <div
                key={entry.user_id}
                className={`grid grid-cols-[60px_1fr_100px_80px] gap-4 px-5 py-4 items-center border-b border-gray-800/50 ${
                  rank <= 3 ? 'bg-gray-800/30' : ''
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
                <span className="font-medium">{entry.username}</span>
                <span className="text-right font-semibold text-green-400">{entry.total_points.toFixed(1)}</span>
                <span className="text-right text-gray-400">{entry.teams_count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
