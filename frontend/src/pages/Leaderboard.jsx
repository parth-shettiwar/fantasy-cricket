import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

function asUTC(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr)
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

export default function Leaderboard() {
  const [matches, setMatches] = useState([])
  const [leaderboards, setLeaderboards] = useState({})
  const [podium, setPodium] = useState([])
  const [expandedMatch, setExpandedMatch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchData = async () => {
      try {
        const matchRes = await api.get('/matches/')
        if (!mounted) return

        const completed = matchRes.data
          .filter(m => m.status === 'completed' || m.status === 'live')
          .sort((a, b) => new Date(b.date) - new Date(a.date))

        setMatches(completed)

        const lbPromises = completed.map(m =>
          api.get(`/points/match/${m.id}/leaderboard`).then(res => [m.id, res.data]).catch(() => [m.id, []])
        )
        const results = await Promise.all(lbPromises)
        if (!mounted) return

        const lbMap = {}
        results.forEach(([mid, data]) => { lbMap[mid] = data })
        setLeaderboards(lbMap)

        const podiumRes = await api.get('/points/podium').catch(() => ({ data: [] }))
        if (!mounted) return
        setPodium(podiumRes.data || [])

        if (completed.length > 0 && !expandedMatch) {
          setExpandedMatch(completed[0].id)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    const intervalId = setInterval(fetchData, 30000)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-gray-400">No completed or live matches yet. Check back once a match starts!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Podium Medal Table (Olympic Ranking)</h2>
          <span className="text-[11px] text-gray-500">Completed matches only</span>
        </div>
        {podium.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-4">No podium finishes yet.</p>
        ) : (
          <div>
            <div className="hidden md:grid grid-cols-[40px_1fr_70px_70px_70px_70px] gap-2 px-5 py-2 text-xs text-gray-500 font-medium border-b border-gray-800">
              <span>#</span>
              <span>User</span>
              <span className="text-right">Gold</span>
              <span className="text-right">Silver</span>
              <span className="text-right">Bronze</span>
              <span className="text-right">Total</span>
            </div>
            {podium.map(row => (
              <div key={row.user_id} className="border-b border-gray-800/50">
                <div className="hidden md:grid grid-cols-[40px_1fr_70px_70px_70px_70px] gap-2 px-5 py-3 items-center">
                  <span className={`font-bold ${row.rank === 1 ? 'text-yellow-400' : row.rank === 2 ? 'text-gray-300' : row.rank === 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {row.rank}
                  </span>
                  <Link to={`/user/${row.user_id}`} className="font-medium hover:text-pink-400 transition-colors">
                    {row.username}
                  </Link>
                  <span className="text-right text-yellow-400">{row.gold}</span>
                  <span className="text-right text-gray-300">{row.silver}</span>
                  <span className="text-right text-amber-600">{row.bronze}</span>
                  <span className="text-right font-semibold text-pink-400">{row.podiums}</span>
                </div>
                <div className="md:hidden px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link to={`/user/${row.user_id}`} className="font-medium hover:text-pink-400 transition-colors truncate">
                      #{row.rank} {row.username}
                    </Link>
                    <span className="text-xs text-pink-400 font-semibold">Total: {row.podiums}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="text-yellow-400">G: {row.gold}</span>
                    <span className="text-gray-300">S: {row.silver}</span>
                    <span className="text-amber-600">B: {row.bronze}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {matches.map(match => {
        const entries = (leaderboards[match.id] || []).filter(e => e.locked)
        const isExpanded = expandedMatch === match.id
        const matchDate = asUTC(match.date)

        return (
          <div key={match.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  match.status === 'live'
                    ? 'bg-red-900/50 text-red-400 border-red-800'
                    : 'bg-gray-800/50 text-gray-400 border-gray-700'
                }`}>
                  {match.status === 'live' && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse"></span>}
                  {match.status.toUpperCase()}
                </span>
                <span className="font-semibold">
                  {match.team1.short_name} vs {match.team2.short_name}
                </span>
                <span className="text-xs text-gray-500">
                  {matchDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{entries.length} team{entries.length !== 1 ? 's' : ''}</span>
                <span className="text-gray-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>

            {isExpanded && (
              <div>
                {entries.length === 0 ? (
                  <p className="text-gray-500 text-sm px-5 py-4 text-center border-t border-gray-800">
                    No teams submitted for this match.
                  </p>
                ) : (
                  <>
                    <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
                      <Link
                        to={`/compare?match_id=${match.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 transition-colors"
                      >
                        Compare two users
                      </Link>
                    </div>
                    <div className="grid grid-cols-[50px_1fr_100px] gap-4 px-5 py-2 text-xs text-gray-500 font-medium border-t border-gray-800">
                      <span>Rank</span>
                      <span>Player</span>
                      <span className="text-right">Points</span>
                    </div>
                    {entries
                      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
                      .map((entry, i) => {
                        const rank = i + 1
                        return (
                          <Link
                            key={entry.user_team_id}
                            to={`/team/${entry.user_team_id}`}
                            className={`grid grid-cols-[50px_1fr_100px] gap-4 px-5 py-3 items-center border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entry.username}</span>
                              {entry.captain && (
                                <span className="text-[10px] text-orange-400">C: {entry.captain}</span>
                              )}
                            </div>
                            <span className="text-right font-semibold text-pink-400">
                              {(entry.total_points || 0).toFixed(1)}
                            </span>
                          </Link>
                        )
                      })}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
