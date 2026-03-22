import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import PlayerCard from '../components/PlayerCard'

const STEPS = [
  { role: 'BAT',  label: 'Batsmen',        min: 1, max: 6 },
  { role: 'BOWL', label: 'Bowlers',         min: 1, max: 6 },
  { role: 'AR',   label: 'All-Rounders',    min: 1, max: 4 },
  { role: 'WK',   label: 'Wicket-Keepers',  min: 1, max: 4 },
]
const ROLE_LABELS = { WK: 'WK', BAT: 'BAT', AR: 'AR', BOWL: 'BOWL' }
const MAX_CREDITS = 100

export default function TeamSelection() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [captain, setCaptain] = useState(null)
  const [viceCaptain, setViceCaptain] = useState(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [teamFilter, setTeamFilter] = useState('ALL')
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

  const isEditing = !!existingTeamId
  const isCaptainStep = stepIdx >= STEPS.length
  const currentStep = STEPS[stepIdx] || null

  const selectedPlayers = players.filter(p => selected.has(p.id))

  const usedCredits = useMemo(() => {
    return selectedPlayers.reduce((sum, p) => sum + p.credits, 0)
  }, [selectedPlayers])

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

  const togglePlayer = (playerId) => {
    const player = players.find(p => p.id === playerId)
    if (!player) return

    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
        if (captain === playerId) setCaptain(null)
        if (viceCaptain === playerId) setViceCaptain(null)
      } else {
        if (next.size >= 11) return prev
        const roleCount = selectedPlayers.filter(p => p.role === player.role).length
        const stepDef = STEPS.find(s => s.role === player.role)
        if (stepDef && roleCount >= stepDef.max) return prev
        next.add(playerId)
      }
      return next
    })
  }

  const canSelect = (player) => {
    if (selected.has(player.id)) return true
    if (selected.size >= 11) return false
    if (usedCredits + player.credits > MAX_CREDITS) return false
    if ((teamBreakdown[player.team_id] || 0) >= 7) return false
    const roleCount = roleBreakdown[player.role] || 0
    const stepDef = STEPS.find(s => s.role === player.role)
    if (stepDef && roleCount >= stepDef.max) return false
    return true
  }

  const rolePlayers = currentStep
    ? players.filter(p => {
        if (p.role !== currentStep.role) return false
        if (teamFilter !== 'ALL' && p.team_id !== parseInt(teamFilter)) return false
        return true
      })
    : []

  const canGoNext = () => {
    if (!currentStep) return false
    const count = roleBreakdown[currentStep.role] || 0
    return count >= currentStep.min
  }

  const remainingSlots = 11 - selected.size
  const remainingSteps = STEPS.slice(stepIdx + 1)
  const minNeededFromLater = remainingSteps.reduce((sum, s) => sum + s.min, 0)
  const maxForThisRole = currentStep ? Math.min(currentStep.max, remainingSlots - minNeededFromLater) : 0

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
      {/* Header */}
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

      {/* Step indicator */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-1 mb-3">
          {STEPS.map((s, i) => {
            const count = roleBreakdown[s.role] || 0
            const isActive = i === stepIdx && !isCaptainStep
            const isDone = i < stepIdx || isCaptainStep
            return (
              <button
                key={s.role}
                onClick={() => { if (!isCaptainStep) setStepIdx(i) }}
                className={`flex-1 text-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-green-600 text-white'
                    : isDone
                      ? 'bg-green-900/40 text-green-400 border border-green-800'
                      : 'bg-gray-800 text-gray-500'
                }`}
              >
                {s.label.split('-')[0]}
                <span className="ml-1 opacity-75">({count})</span>
              </button>
            )
          })}
          <div className={`flex-1 text-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
            isCaptainStep
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-500'
          }`}>
            C / VC
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-3">
            {STEPS.map(s => (
              <span key={s.role} className={`px-2 py-0.5 rounded ${
                roleBreakdown[s.role] >= s.min ? 'text-green-400' : 'text-gray-500'
              }`}>
                {ROLE_LABELS[s.role]}: {roleBreakdown[s.role]}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-medium ${usedCredits > MAX_CREDITS ? 'text-red-400' : 'text-gray-300'}`}>
              {usedCredits.toFixed(1)} / {MAX_CREDITS} cr
            </span>
            <span className={`font-medium ${selected.size === 11 ? 'text-green-400' : 'text-gray-300'}`}>
              {selected.size} / 11
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
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

      {/* Role selection steps */}
      {!isCaptainStep && currentStep && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                Pick {currentStep.label}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select {currentStep.min}–{maxForThisRole} players
                <span className="ml-2">
                  (chosen: <span className={roleBreakdown[currentStep.role] >= currentStep.min ? 'text-green-400' : 'text-amber-400'}>{roleBreakdown[currentStep.role]}</span>)
                </span>
              </p>
            </div>
            {/* Team filter */}
            <div className="flex bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <button
                onClick={() => setTeamFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  teamFilter === 'ALL' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Both
              </button>
              <button
                onClick={() => setTeamFilter(String(match.team1.id))}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  teamFilter === String(match.team1.id) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {match.team1.short_name}
              </button>
              <button
                onClick={() => setTeamFilter(String(match.team2.id))}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  teamFilter === String(match.team2.id) ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {match.team2.short_name}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rolePlayers.map(player => (
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

          {/* Navigation */}
          <div className="flex gap-3 sticky bottom-4">
            {stepIdx > 0 && (
              <button
                onClick={() => { setStepIdx(stepIdx - 1); setTeamFilter('ALL') }}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
              >
                &larr; {STEPS[stepIdx - 1].label}
              </button>
            )}
            {stepIdx < STEPS.length - 1 ? (
              <button
                onClick={() => { setStepIdx(stepIdx + 1); setTeamFilter('ALL') }}
                disabled={!canGoNext()}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-600/20"
              >
                {STEPS[stepIdx + 1].label} &rarr;
              </button>
            ) : (
              <button
                onClick={() => {
                  if (selected.size !== 11) {
                    setError(`Select exactly 11 players (you have ${selected.size})`)
                    return
                  }
                  setError('')
                  setStepIdx(STEPS.length)
                }}
                disabled={!canGoNext()}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-600/20"
              >
                Choose Captain &amp; Vice Captain &rarr;
              </button>
            )}
          </div>
        </>
      )}

      {/* Captain / Vice-Captain step */}
      {isCaptainStep && (
        <>
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">
              {!captain ? 'Choose your Captain (2x points)' : !viceCaptain ? 'Choose your Vice Captain (1.5x points)' : 'Captain & Vice Captain selected!'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Tap to select · tap again to change</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedPlayers.map(player => {
              const isCap = captain === player.id
              const isVc = viceCaptain === player.id
              return (
                <button
                  key={player.id}
                  onClick={() => {
                    if (isCap) {
                      setCaptain(null)
                    } else if (isVc) {
                      setViceCaptain(null)
                    } else if (!captain) {
                      setCaptain(player.id)
                    } else if (!viceCaptain) {
                      setViceCaptain(player.id)
                    }
                  }}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    isCap ? 'border-yellow-500 bg-yellow-900/20 hover:bg-yellow-900/10' :
                    isVc ? 'border-blue-500 bg-blue-900/20 hover:bg-blue-900/10' :
                    captain && viceCaptain
                      ? 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-xs text-gray-400">
                        {player.role} · {player.team_id === match.team1.id ? match.team1.short_name : match.team2.short_name}
                      </p>
                    </div>
                    {isCap && (
                      <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-black rounded flex items-center gap-1">
                        C <span className="text-[10px] opacity-70">✕</span>
                      </span>
                    )}
                    {isVc && (
                      <span className="px-2 py-1 text-xs font-bold bg-blue-500 text-white rounded flex items-center gap-1">
                        VC <span className="text-[10px] opacity-70">✕</span>
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3 sticky bottom-4">
            <button
              onClick={() => { setStepIdx(STEPS.length - 1); setCaptain(null); setViceCaptain(null) }}
              className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
            >
              &larr; Back to {STEPS[STEPS.length - 1].label}
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
