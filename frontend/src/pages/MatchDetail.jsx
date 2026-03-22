import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'

const ROLE_COLORS = {
  WK: 'text-yellow-400',
  BAT: 'text-blue-400',
  AR: 'text-purple-400',
  BOWL: 'text-green-400',
}

export default function MatchDetail() {
  const { matchId } = useParams()
  const [match, setMatch] = useState(null)
  const [performances, setPerformances] = useState([])
  const [players, setPlayers] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/matches/${matchId}`),
      api.get(`/points/match/${matchId}/performances`),
      api.get(`/matches/${matchId}/players`),
    ]).then(([matchRes, perfRes, playersRes]) => {
      setMatch(matchRes.data)
      setPerformances(perfRes.data)
      const pmap = {}
      playersRes.data.forEach(p => { pmap[p.id] = p })
      setPlayers(pmap)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [matchId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    )
  }

  if (!match) return <p className="text-red-400">Match not found</p>

  const playingPerfs = performances.filter(p => p.is_playing)
  const team1Perfs = playingPerfs.filter(p => players[p.player_id]?.team_id === match.team1_id)
  const team2Perfs = playingPerfs.filter(p => players[p.player_id]?.team_id === match.team2_id)

  const renderPerformanceTable = (perfs, teamName) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{teamName}</h3>
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_50px_50px_50px_50px_50px_50px] gap-1 text-xs text-gray-500 font-medium px-2">
          <span>Player</span>
          <span className="text-right">Runs</span>
          <span className="text-right">4s</span>
          <span className="text-right">6s</span>
          <span className="text-right">Wkts</span>
          <span className="text-right">Overs</span>
          <span className="text-right">Ct/St</span>
        </div>
        {perfs.map(perf => {
          const player = players[perf.player_id]
          return (
            <div key={perf.id} className="grid grid-cols-[1fr_50px_50px_50px_50px_50px_50px] gap-1 text-sm px-2 py-2 rounded-lg bg-gray-800/50 items-center">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{player?.name || '?'}</span>
                <span className={`text-xs ${ROLE_COLORS[player?.role] || ''}`}>{player?.role}</span>
              </div>
              <span className={`text-right ${perf.runs >= 50 ? 'text-green-400 font-semibold' : 'text-gray-300'}`}>
                {perf.runs}{perf.runs >= 100 ? '*' : ''}
              </span>
              <span className="text-right text-gray-300">{perf.fours}</span>
              <span className="text-right text-gray-300">{perf.sixes}</span>
              <span className={`text-right ${perf.wickets >= 3 ? 'text-green-400 font-semibold' : 'text-gray-300'}`}>
                {perf.wickets}
              </span>
              <span className="text-right text-gray-300">{perf.overs_bowled}</span>
              <span className="text-right text-gray-300">{perf.catches + perf.stumpings}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {match.team1.short_name} vs {match.team2.short_name}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {match.venue} &middot;{' '}
            {new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${
          match.status === 'completed' ? 'bg-gray-800/50 text-gray-400 border-gray-700' : 'bg-green-900/50 text-green-400 border-green-800'
        }`}>
          {match.status.toUpperCase()}
        </span>
      </div>

      {playingPerfs.length === 0 ? (
        <p className="text-gray-400">No performance data available for this match yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderPerformanceTable(team1Perfs, match.team1.name)}
          {renderPerformanceTable(team2Perfs, match.team2.name)}
        </div>
      )}

      <div className="flex justify-center">
        <Link to="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          &larr; Back to matches
        </Link>
      </div>
    </div>
  )
}
