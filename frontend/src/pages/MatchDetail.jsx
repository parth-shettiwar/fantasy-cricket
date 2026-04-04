import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'

const ROLE_COLORS = {
  WK: 'text-yellow-400',
  BAT: 'text-blue-400',
  AR: 'text-purple-400',
  BOWL: 'text-emerald-400',
}

export default function MatchDetail() {
  const { matchId } = useParams()
  const [match, setMatch] = useState(null)
  const [performances, setPerformances] = useState([])
  const [players, setPlayers] = useState({})
  const [matchTeams, setMatchTeams] = useState([])
  const [bestXI, setBestXI] = useState([])
  const [bestXIMeta, setBestXIMeta] = useState(null)
  const [expandedTeam, setExpandedTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const mountedRef = useRef(true)

  const fetchMatchData = useCallback(async (isManual = false) => {
    if (isManual && mountedRef.current) {
      setRefreshing(true)
    }

    try {
      const [matchRes, perfRes, playersRes, teamsRes, bestXIRes] = await Promise.all([
        api.get(`/matches/${matchId}`),
        api.get(`/points/match/${matchId}/performances`),
        api.get(`/matches/${matchId}/players`),
        api.get(`/points/match/${matchId}/leaderboard`),
        api.get(`/points/match/${matchId}/best-xi`).catch(() => ({ data: { players: [] } })),
      ])

      if (!mountedRef.current) return

      setMatch(matchRes.data)
      setPerformances(perfRes.data)
      const pmap = {}
      playersRes.data.forEach(p => { pmap[p.id] = p })
      setPlayers(pmap)
      setMatchTeams(teamsRes.data)
      setBestXI(bestXIRes.data?.players || [])
      setBestXIMeta(bestXIRes.data || null)
    } catch (err) {
      console.error(err)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        if (isManual) {
          setRefreshing(false)
        }
      }
    }
  }, [matchId])

  useEffect(() => {
    mountedRef.current = true
    fetchMatchData()
    const intervalId = setInterval(fetchMatchData, 10000)

    return () => {
      mountedRef.current = false
      clearInterval(intervalId)
    }
  }, [fetchMatchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
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
              <span className={`text-right ${perf.runs >= 50 ? 'text-pink-400 font-semibold' : 'text-gray-300'}`}>
                {perf.runs}{perf.runs >= 100 ? '*' : ''}
              </span>
              <span className="text-right text-gray-300">{perf.fours}</span>
              <span className="text-right text-gray-300">{perf.sixes}</span>
              <span className={`text-right ${perf.wickets >= 3 ? 'text-pink-400 font-semibold' : 'text-gray-300'}`}>
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
            {new Date(match.date.endsWith?.('Z') || match.date.includes?.('+') ? match.date : match.date + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {match.status === 'upcoming' && (
            <Link
              to={`/match/${matchId}/select-team`}
              className="text-sm px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500 transition-colors font-medium"
            >
              Create Team
            </Link>
          )}
          <button
            onClick={() => fetchMatchData(true)}
            disabled={refreshing}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            match.status === 'completed' ? 'bg-gray-800/50 text-gray-400 border-gray-700' :
            match.status === 'live' ? 'bg-red-900/50 text-red-400 border-red-800 animate-pulse' :
            'bg-pink-900/40 text-pink-400 border-pink-800'
          }`}>
            {match.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Match Leaderboard */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">
            Fantasy Teams ({matchTeams.length} submitted)
          </h2>
        </div>

        {matchTeams.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-6 text-center">
            No teams submitted yet. Be the first!
          </p>
        ) : (
          <div>
            {matchTeams[0]?.locked ? (
              <div className="grid grid-cols-[40px_1fr_1fr_1fr_80px] gap-3 px-5 py-2 text-xs text-gray-500 font-medium border-b border-gray-800">
                <span>#</span>
                <span>User</span>
                <span>Captain</span>
                <span>Vice Captain</span>
                <span className="text-right">Points</span>
              </div>
            ) : (
              <div className="grid grid-cols-[40px_1fr] gap-3 px-5 py-2 text-xs text-gray-500 font-medium border-b border-gray-800">
                <span>#</span>
                <span>User</span>
              </div>
            )}
            {matchTeams.map((entry, i) => {
              const rank = i + 1
              const isExpanded = expandedTeam === entry.user_team_id

              if (!entry.locked) {
                return (
                  <div key={entry.user_team_id} className="grid grid-cols-[40px_1fr] gap-3 px-5 py-3 items-center border-b border-gray-800/50">
                    <span className="font-bold text-gray-500">{rank}</span>
                    <div className="flex items-center gap-2">
                      <Link to={`/user/${entry.user_id}`} className="font-medium text-sm hover:text-pink-400 transition-colors">{entry.username}</Link>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-900/30 text-pink-400 border border-pink-800">Team Submitted</span>
                    </div>
                  </div>
                )
              }

              return (
                <div key={entry.user_team_id}>
                  <div
                    onClick={() => setExpandedTeam(isExpanded ? null : entry.user_team_id)}
                    className={`grid grid-cols-[40px_1fr_1fr_1fr_80px] gap-3 px-5 py-3 items-center border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/30 transition-colors ${
                      rank <= 3 ? 'bg-pink-900/10' : ''
                    }`}
                  >
                    <span className={`font-bold ${
                      rank === 1 ? 'text-yellow-400' :
                      rank === 2 ? 'text-gray-300' :
                      rank === 3 ? 'text-amber-600' :
                      'text-gray-500'
                    }`}>
                      {rank}
                    </span>
                    <Link to={`/user/${entry.user_id}`} onClick={e => e.stopPropagation()} className="font-medium text-sm hover:text-pink-400 transition-colors">{entry.username}</Link>
                    <span className="text-sm text-orange-400">{entry.captain}</span>
                    <span className="text-sm text-cyan-400">{entry.vice_captain}</span>
                    <Link to={`/team/${entry.user_team_id}`} onClick={e => e.stopPropagation()} className="text-right font-semibold text-pink-400 text-sm hover:text-pink-300 transition-colors">
                      {entry.total_points.toFixed(1)}
                    </Link>
                  </div>

                  {isExpanded && (
                    <div className="px-5 py-3 bg-gray-800/40 border-b border-gray-800/50">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {entry.players.map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-xs py-1">
                            <span className={`${ROLE_COLORS[p.role] || 'text-gray-400'} font-medium w-7`}>
                              {p.role}
                            </span>
                            <span className="text-gray-300 truncate">{p.name}</span>
                            <span className="text-gray-600 text-[10px]">{p.team_short}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {bestXI.length > 0 && (
        <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-300">Best Playing XI (By Match Points)</h2>
            <div className="text-right">
              <p className="text-xs text-gray-500">Best XI Total (with C/VC)</p>
              <p className="text-sm font-bold text-pink-400">{Number(bestXIMeta?.best_xi_total_points || 0).toFixed(1)}</p>
            </div>
          </div>
          <div className="grid grid-cols-[40px_1fr_70px] gap-3 px-5 py-2 text-xs text-gray-500 font-medium border-b border-gray-800">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Points</span>
          </div>
          {bestXI.map((p, idx) => (
            <div key={p.player_id} className="grid grid-cols-[40px_1fr_70px] gap-3 px-5 py-3 items-center border-b border-gray-800/50">
              <span className="font-bold text-gray-500">{idx + 1}</span>
              <div className="min-w-0 flex items-center gap-2">
                <span className="truncate text-sm">{p.name}</span>
                <span className={`text-[10px] ${ROLE_COLORS[p.role] || 'text-gray-500'}`}>{p.role}</span>
                <span className="text-[10px] text-gray-600">{p.team_short}</span>
                {p.player_id === bestXIMeta?.captain_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 border border-orange-800 font-bold">C</span>
                )}
                {p.player_id === bestXIMeta?.vice_captain_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-400 border border-cyan-800 font-bold">VC</span>
                )}
              </div>
              <span className="text-right font-semibold text-pink-400">{Number(p.points || 0).toFixed(1)}</span>
            </div>
          ))}
        </section>
      )}

      {playingPerfs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-300">Scorecard</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderPerformanceTable(team1Perfs, match.team1.name)}
            {renderPerformanceTable(team2Perfs, match.team2.name)}
          </div>
        </section>
      )}

      <div className="flex justify-center">
        <Link to="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          &larr; Back to matches
        </Link>
      </div>
    </div>
  )
}
