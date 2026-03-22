import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'

const ROLE_COLORS = {
  WK: 'text-yellow-400 bg-yellow-400/10 border-yellow-800',
  BAT: 'text-blue-400 bg-blue-400/10 border-blue-800',
  AR: 'text-purple-400 bg-purple-400/10 border-purple-800',
  BOWL: 'text-green-400 bg-green-400/10 border-green-800',
}

export default function TeamDetail() {
  const { teamId } = useParams()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    api.get(`/points/user-team/${teamId}/detail`)
      .then(res => setTeam(res.data))
      .catch(err => {
        if (err.response?.status === 403) {
          setHidden(true)
        } else {
          console.error(err)
        }
      })
      .finally(() => setLoading(false))
  }, [teamId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    )
  }

  if (hidden) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-xl font-bold text-gray-300">Team Hidden</h2>
        <p className="text-gray-500">Team details will be revealed once the match starts.</p>
        <Link to="/" className="inline-block mt-4 text-sm text-green-400 hover:text-green-300 transition-colors">
          &larr; Back to matches
        </Link>
      </div>
    )
  }

  if (!team) return <p className="text-red-400">Team not found</p>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Link to={`/user/${team.user_id}`} className="text-lg font-bold hover:text-green-400 transition-colors">
              {team.username}
            </Link>
            <p className="text-sm text-gray-400 mt-1">
              <Link to={`/match/${team.match_id}`} className="hover:text-white transition-colors">
                {team.match_name}
              </Link>
              {' '}&middot;{' '}
              {new Date(team.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span>C: <span className="text-orange-400 font-medium">{team.captain}</span></span>
              <span>VC: <span className="text-cyan-400 font-medium">{team.vice_captain}</span></span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-green-400">{team.total_points.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">Total Points</p>
          </div>
        </div>
      </div>

      {/* Player Cards */}
      <section>
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Playing XI</h2>
        <div className="space-y-2">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[1fr_60px_60px_60px_60px_60px_70px] gap-2 px-4 py-2 text-xs text-gray-500 font-medium">
            <span>Player</span>
            <span className="text-right">Bat</span>
            <span className="text-right">Bowl</span>
            <span className="text-right">Field</span>
            <span className="text-right">Bonus</span>
            <span className="text-right">Base</span>
            <span className="text-right">Final</span>
          </div>

          {team.players.map(p => (
            <div
              key={p.player_id}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              <div className="grid grid-cols-[1fr_60px_60px_60px_60px_60px_70px] gap-2 px-4 py-3 items-center">
                {/* Name + badges */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROLE_COLORS[p.role] || ''}`}>
                    {p.role}
                  </span>
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  <span className="text-[10px] text-gray-600">{p.team_short}</span>
                  {p.is_captain && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 border border-orange-800 font-bold">C</span>
                  )}
                  {p.is_vice_captain && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-400 border border-cyan-800 font-bold">VC</span>
                  )}
                </div>

                {/* Points columns */}
                <span className="text-right text-sm text-blue-300">{p.points.batting || '-'}</span>
                <span className="text-right text-sm text-green-300">{p.points.bowling || '-'}</span>
                <span className="text-right text-sm text-yellow-300">{p.points.fielding || '-'}</span>
                <span className="text-right text-sm text-purple-300">{p.points.bonus || '-'}</span>
                <span className="text-right text-sm text-gray-400">{p.points.total || '-'}</span>
                <span className={`text-right text-sm font-bold ${p.points.final > 0 ? 'text-green-400' : p.points.final < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {p.points.final ? p.points.final.toFixed(1) : '-'}
                  {(p.is_captain || p.is_vice_captain) && p.points.total > 0 && (
                    <span className="text-[9px] text-gray-500 ml-0.5">
                      ({p.is_captain ? '2x' : '1.5x'})
                    </span>
                  )}
                </span>
              </div>

              {/* Stats row (if match has started) */}
              {p.stats && (
                <div className="px-4 py-2 bg-gray-800/30 border-t border-gray-800/50 flex gap-4 text-xs text-gray-500">
                  {p.stats.runs > 0 && <span>{p.stats.runs} runs ({p.stats.balls}b, {p.stats.fours}x4, {p.stats.sixes}x6)</span>}
                  {p.stats.wickets > 0 && <span>{p.stats.wickets}w ({p.stats.overs} ov)</span>}
                  {p.stats.catches > 0 && <span>{p.stats.catches} catch{p.stats.catches > 1 ? 'es' : ''}</span>}
                  {!p.stats.runs && !p.stats.wickets && !p.stats.catches && <span>Yet to contribute</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Navigation */}
      <div className="flex justify-center gap-6">
        <Link to={`/user/${team.user_id}`} className="text-sm text-gray-400 hover:text-white transition-colors">
          &larr; {team.username}'s profile
        </Link>
        <Link to={`/match/${team.match_id}`} className="text-sm text-gray-400 hover:text-white transition-colors">
          View match &rarr;
        </Link>
      </div>
    </div>
  )
}
