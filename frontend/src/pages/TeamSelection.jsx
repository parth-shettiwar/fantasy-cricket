import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import PlayerCard from '../components/PlayerCard'

const ROLE_LABELS = { WK: 'Wicket-Keeper', BAT: 'Batsman', AR: 'All-Rounder', BOWL: 'Bowler' }
const ROLE_ORDER = ['WK', 'BAT', 'AR', 'BOWL']
const MAX_CREDITS = 100

export default function TeamSelection() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [captain, setCaptain] = useState(null)
  const [viceCaptain, setViceCaptain] = useState(null)
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [teamFilter, setTeamFilter] = useState('ALL')
  const [step, setStep] = useState('pick') // 'pick' or 'captain'
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [existingTeamId, setExistingTeamId] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/matches/${matchId}`),
      api.get(`/matches/${matchId}/players`),
      api.get(`/teams/my/match/${matchId}`).catch(() => ({ data: null })),
    ]).then(([matchRes, playersRes, existingRes]) => {
      setMatch(matchRes.data)
      setPlayers(playersRes.data)
      if (existingRes.data) {
        const et = existingRes.data
        setExistingTeamId(et.id)
        setSelected(new Set(et.players.map(p => p.id)))
        setCaptain(et.captain_id)
        setViceCaptain(et.vice_captain_id)
      }
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [matchId])

  const togglePlayer = (playerId) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
        if (captain === playerId) setCaptain(null)
        if (viceCaptain === playerId) setViceCaptain(null)
      } else {
        if (next.size >= 11) return prev
        next.add(playerId)
      }
      return next
    })
  }

  const usedCredits = useMemo(() => {
    return players.filter(p => selected.has(p.id)).reduce((sum, p) => sum + p.credits, 0)
  }, [selected, players])

  const selectedPlayers = players.filter(p => selected.has(p.id))
  const roleBreakdown = useMemo(() => {
    const counts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
    selectedPlayers.forEach(p => { counts[p.role]++ })
    return counts
  }, [selectedPlayers])

  const teamBreakdown = useMemo(() => {
    const counts = {}
    selectedPlayers.forEach(p => { counts[p.team_id] = (counts[p.team_id] || 0) + 1 })
    return counts
  }, [selectedPlayers])

  const canSelect = (player) => {
    if (selected.has(player.id)) return true
    if (selected.size >= 11) return false
    if (usedCredits + player.credits > MAX_CREDITS) return false
    if ((teamBreakdown[player.team_id] || 0) >= 7) return false
    return true
  }

  const filteredPlayers = players.filter(p => {
    if (roleFilter !== 'ALL' && p.role !== roleFilter) return false
    if (teamFilter !== 'ALL' && p.team_id !== parseInt(teamFilter)) return false
    return true
  })

  const isEditing = !!existingTeamId

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        match_id: parseInt(matchId),
        player_ids: [...selected],
        captain_id: captain,
        vice_captain_id: viceCaptain,
      }
      if (isEditing) {
        await api.put(`/teams/${existingTeamId}`, payload)
      } else {
        await api.post('/teams/', payload)
      }
      navigate('/my-teams')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save team')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    )
  }

  if (!match) return <p className="text-red-400">Match not found</p>

  if (match.status !== 'upcoming') {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-xl font-bold text-gray-300">Team Locked</h2>
        <p className="text-gray-500">You cannot create or edit teams after the match has started.</p>
        <button onClick={() => navigate(-1)} className="inline-block mt-4 text-sm text-green-400 hover:text-green-300 transition-colors">
          &larr; Go back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {match.team1.short_name} vs {match.team2.short_name}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {match.venue}
            {isEditing && <span className="ml-2 text-yellow-400 font-medium">· Editing Team</span>}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-4">
            {ROLE_ORDER.map(role => (
              <span key={role} className={`text-xs px-2 py-1 rounded ${
                roleBreakdown[role] > 0 ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {role}: {roleBreakdown[role]}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${usedCredits > MAX_CREDITS ? 'text-red-400' : 'text-gray-300'}`}>
              {usedCredits.toFixed(1)} / {MAX_CREDITS} credits
            </span>
            <span className={`text-sm font-medium ${selected.size === 11 ? 'text-green-400' : 'text-gray-300'}`}>
              {selected.size} / 11 players
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(selected.size / 11) * 100}%` }}
          ></div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/50 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {step === 'pick' ? (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              {['ALL', ...ROLE_ORDER].map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    roleFilter === role ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {role === 'ALL' ? 'All' : ROLE_LABELS[role]}
                </button>
              ))}
            </div>
            {match && (
              <div className="flex bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <button
                  onClick={() => setTeamFilter('ALL')}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    teamFilter === 'ALL' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Both
                </button>
                <button
                  onClick={() => setTeamFilter(String(match.team1.id))}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    teamFilter === String(match.team1.id) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {match.team1.short_name}
                </button>
                <button
                  onClick={() => setTeamFilter(String(match.team2.id))}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    teamFilter === String(match.team2.id) ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {match.team2.short_name}
                </button>
              </div>
            )}
          </div>

          {/* Player list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPlayers.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                selected={selected.has(player.id)}
                disabled={!canSelect(player)}
                teamName={player.team_id === match.team1.id ? match.team1.short_name : match.team2.short_name}
                onClick={() => togglePlayer(player.id)}
              />
            ))}
          </div>

          {/* Next step */}
          {selected.size === 11 && (
            <div className="sticky bottom-4">
              <button
                onClick={() => setStep('captain')}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors shadow-lg shadow-green-600/20"
              >
                Choose Captain &amp; Vice Captain &rarr;
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">
              {!captain ? 'Choose your Captain (2x points)' : 'Choose your Vice Captain (1.5x points)'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Tap a player to select</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedPlayers.map(player => {
              const isCap = captain === player.id
              const isVc = viceCaptain === player.id
              return (
                <button
                  key={player.id}
                  onClick={() => {
                    if (!captain) {
                      setCaptain(player.id)
                    } else if (!viceCaptain && player.id !== captain) {
                      setViceCaptain(player.id)
                    }
                  }}
                  disabled={isCap || isVc}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isCap ? 'border-yellow-500 bg-yellow-900/20' :
                    isVc ? 'border-blue-500 bg-blue-900/20' :
                    'border-gray-800 bg-gray-900 hover:border-gray-600'
                  } ${isCap || isVc ? '' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-xs text-gray-400">{ROLE_LABELS[player.role]}</p>
                    </div>
                    {isCap && <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-black rounded">C</span>}
                    {isVc && <span className="px-2 py-1 text-xs font-bold bg-blue-500 text-white rounded">VC</span>}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3 sticky bottom-4">
            <button
              onClick={() => { setStep('pick'); setCaptain(null); setViceCaptain(null) }}
              className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
            >
              &larr; Back
            </button>
            {captain && viceCaptain && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20"
              >
                {submitting ? 'Saving...' : isEditing ? 'Update Team' : 'Create Team'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
