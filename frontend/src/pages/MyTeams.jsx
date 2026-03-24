import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import TeamSummary from '../components/TeamSummary'

export default function MyTeams() {
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState({})
  const [breakdowns, setBreakdowns] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedTeam, setExpandedTeam] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/teams/my'),
      api.get('/matches/'),
    ]).then(([teamsRes, matchesRes]) => {
      setTeams(teamsRes.data)
      const matchMap = {}
      matchesRes.data.forEach(m => { matchMap[m.id] = m })
      setMatches(matchMap)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const loadBreakdown = async (teamId) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null)
      return
    }
    setExpandedTeam(teamId)
    if (breakdowns[teamId]) return
    try {
      const { data } = await api.get(`/points/breakdown/${teamId}`)
      setBreakdowns(prev => ({ ...prev, [teamId]: data }))
    } catch (err) {
      console.error(err)
    }
  }

  const recalculate = async (teamId) => {
    try {
      const { data } = await api.post(`/points/calculate/${teamId}`)
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, total_points: data.total_points } : t))
      const bres = await api.get(`/points/breakdown/${teamId}`)
      setBreakdowns(prev => ({ ...prev, [teamId]: bres.data }))
    } catch (err) {
      console.error(err)
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
      <h1 className="text-2xl font-bold">My Teams</h1>

      {teams.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">You haven't created any teams yet.</p>
          <Link to="/" className="px-6 py-2 rounded-lg bg-pink-600 text-white font-medium hover:bg-pink-500 transition-colors">
            Browse Matches
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map(team => {
            const match = matches[team.match_id]
            const breakdown = breakdowns[team.id]
            const isExpanded = expandedTeam === team.id
            return (
              <div key={team.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <button
                  onClick={() => loadBreakdown(team.id)}
                  className="w-full p-5 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {match ? `${match.team1.short_name} vs ${match.team2.short_name}` : `Match #${team.match_id}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {match && new Date(match.date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                        {match && ` \u00B7 ${match.status.toUpperCase()}`}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="text-lg font-bold text-pink-400">{team.total_points.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">points</p>
                      {match?.status === 'upcoming' && (
                        <Link
                          to={`/match/${team.match_id}/select-team`}
                          className="text-[10px] px-3 py-1 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800 hover:bg-yellow-900/60 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          Edit Team
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 mt-3 flex-wrap">
                    {team.players.map(p => (
                      <span
                        key={p.id}
                        className={`text-xs px-2 py-1 rounded-full ${
                          p.id === team.captain_id
                            ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                            : p.id === team.vice_captain_id
                              ? 'bg-blue-900/50 text-blue-400 border border-blue-800'
                              : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {p.name.split(' ').pop()}
                        {p.id === team.captain_id && ' (C)'}
                        {p.id === team.vice_captain_id && ' (VC)'}
                      </span>
                    ))}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-800 p-4">
                    {match?.status === 'completed' && (
                      <button
                        onClick={() => recalculate(team.id)}
                        className="mb-3 text-xs px-3 py-1.5 rounded-lg bg-pink-900/40 text-pink-400 border border-pink-800 hover:bg-pink-900/60 transition-colors"
                      >
                        Recalculate Points
                      </button>
                    )}
                    {breakdown ? (
                      <TeamSummary breakdown={breakdown} captainId={team.captain_id} viceCaptainId={team.vice_captain_id} />
                    ) : (
                      <p className="text-sm text-gray-500">Loading breakdown...</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
