import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import PlayerCard from '../components/PlayerCard'

const ROLE_STEPS = [
  { role: 'BAT',  label: 'Batsmen',        min: 1, max: 6 },
  { role: 'BOWL', label: 'Bowlers',         min: 1, max: 6 },
  { role: 'AR',   label: 'All-Rounders',    min: 1, max: 4 },
  { role: 'WK',   label: 'Wicket-Keepers',  min: 1, max: 4 },
]
const ROLE_LABELS = { WK: 'WK', BAT: 'BAT', AR: 'AR', BOWL: 'BOWL' }
const MAX_CREDITS = 100
const MAX_SUBS = 4

const STEP_SUBS = ROLE_STEPS.length
const STEP_CAPTAIN = ROLE_STEPS.length + 1

export default function TeamSelection() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [substitutes, setSubstitutes] = useState([])
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
        if (et.substitutes?.length) {
          setSubstitutes(
            et.substitutes
              .sort((a, b) => a.priority - b.priority)
              .map(s => s.player_id)
          )
        }
      }
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [matchId])

  const isEditing = !!existingTeamId
  const isSubsStep = stepIdx === STEP_SUBS
  const isCaptainStep = stepIdx === STEP_CAPTAIN
  const isRoleStep = stepIdx < ROLE_STEPS.length
  const currentRoleStep = isRoleStep ? ROLE_STEPS[stepIdx] : null

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
        const stepDef = ROLE_STEPS.find(s => s.role === player.role)
        if (stepDef && roleCount >= stepDef.max) return prev
        next.add(playerId)
      }
      return next
    })
  }

  const toggleSubstitute = (playerId) => {
    setSubstitutes(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId)
      }
      if (prev.length >= MAX_SUBS) return prev
      return [...prev, playerId]
    })
  }

  const canSelect = (player) => {
    if (selected.has(player.id)) return true
    if (selected.size >= 11) return false
    if (usedCredits + player.credits > MAX_CREDITS) return false
    if ((teamBreakdown[player.team_id] || 0) >= 7) return false
    const roleCount = roleBreakdown[player.role] || 0
    const stepDef = ROLE_STEPS.find(s => s.role === player.role)
    if (stepDef && roleCount >= stepDef.max) return false
    return true
  }

  const rolePlayers = currentRoleStep
    ? players.filter(p => {
        if (p.role !== currentRoleStep.role) return false
        if (teamFilter !== 'ALL' && p.team_id !== parseInt(teamFilter)) return false
        return true
      })
    : []

  const subsAvailablePlayers = players.filter(p => {
    if (selected.has(p.id)) return false
    if (teamFilter !== 'ALL' && p.team_id !== parseInt(teamFilter)) return false
    const validTeams = match ? new Set([match.team1.id, match.team2.id]) : new Set()
    return validTeams.has(p.team_id)
  })

  const canGoNext = () => {
    if (!currentRoleStep) return false
    const count = roleBreakdown[currentRoleStep.role] || 0
    return count >= currentRoleStep.min
  }

  const remainingSlots = 11 - selected.size
  const remainingSteps = ROLE_STEPS.slice(stepIdx + 1)
  const minNeededFromLater = remainingSteps.reduce((sum, s) => sum + s.min, 0)
  const maxForThisRole = currentRoleStep ? Math.min(currentRoleStep.max, remainingSlots - minNeededFromLater) : 0

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        match_id: parseInt(matchId),
        player_ids: [...selected],
        captain_id: captain,
        vice_captain_id: viceCaptain,
        substitute_ids: substitutes,
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

  const getTeamName = (p) => p.team_id === match?.team1?.id ? match.team1.short_name : match?.team2?.short_name

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
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
        <button onClick={() => navigate(-1)} className="inline-block mt-4 text-sm text-pink-400 hover:text-pink-300 transition-colors">
          &larr; Go back
        </button>
      </div>
    )
  }

  const stepLabels = [...ROLE_STEPS.map(s => s.label), 'Subs', 'C / VC']

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
        <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-white transition-colors">
          &larr; Back
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-1 mb-3">
          {stepLabels.map((label, i) => {
            const isActive = i === stepIdx
            const isDone = i < stepIdx
            let badge = ''
            if (i < ROLE_STEPS.length) badge = ` (${roleBreakdown[ROLE_STEPS[i].role] || 0})`
            else if (i === STEP_SUBS) badge = ` (${substitutes.length})`
            return (
              <button
                key={label}
                onClick={() => {
                  if (i <= STEP_SUBS && i < stepIdx) setStepIdx(i)
                }}
                className={`flex-1 text-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                  isActive ? 'bg-pink-600 text-white'
                    : isDone ? 'bg-pink-900/40 text-pink-400 border border-pink-800'
                    : 'bg-gray-800 text-gray-500'
                }`}
              >
                {label.split('-')[0]}
                <span className="ml-0.5 opacity-75">{badge}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-3">
            {ROLE_STEPS.map(s => (
              <span key={s.role} className={`px-2 py-0.5 rounded ${roleBreakdown[s.role] >= s.min ? 'text-pink-400' : 'text-gray-500'}`}>
                {ROLE_LABELS[s.role]}: {roleBreakdown[s.role]}
              </span>
            ))}
            <span className={`px-2 py-0.5 rounded ${substitutes.length > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
              SUB: {substitutes.length}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-medium ${usedCredits > MAX_CREDITS ? 'text-red-400' : 'text-gray-300'}`}>
              {usedCredits.toFixed(1)} / {MAX_CREDITS} cr
            </span>
            <span className={`font-medium ${selected.size === 11 ? 'text-pink-400' : 'text-gray-300'}`}>
              {selected.size} / 11
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
          <div className="bg-pink-500 h-2 rounded-full transition-all" style={{ width: `${(selected.size / 11) * 100}%` }}></div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/50 border border-red-800 text-red-300 text-sm">{error}</div>
      )}

      {isRoleStep && currentRoleStep && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Pick {currentRoleStep.label}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select {currentRoleStep.min}–{maxForThisRole} players
                <span className="ml-2">
                  (chosen: <span className={roleBreakdown[currentRoleStep.role] >= currentRoleStep.min ? 'text-pink-400' : 'text-amber-400'}>{roleBreakdown[currentRoleStep.role]}</span>)
                </span>
              </p>
            </div>
            <div className="flex bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <button onClick={() => setTeamFilter('ALL')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${teamFilter === 'ALL' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}>Both</button>
              <button onClick={() => setTeamFilter(String(match.team1.id))} className={`px-3 py-1.5 text-xs font-medium transition-colors ${teamFilter === String(match.team1.id) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>{match.team1.short_name}</button>
              <button onClick={() => setTeamFilter(String(match.team2.id))} className={`px-3 py-1.5 text-xs font-medium transition-colors ${teamFilter === String(match.team2.id) ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>{match.team2.short_name}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rolePlayers.map(player => (
              <PlayerCard key={player.id} player={player} selected={selected.has(player.id)} disabled={!canSelect(player)} teamName={getTeamName(player)} onClick={() => togglePlayer(player.id)} />
            ))}
          </div>

          <div className="flex gap-3 sticky bottom-4">
            {stepIdx > 0 && (
              <button onClick={() => { setStepIdx(stepIdx - 1); setTeamFilter('ALL') }} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors">
                &larr; {ROLE_STEPS[stepIdx - 1].label}
              </button>
            )}
            {stepIdx < ROLE_STEPS.length - 1 ? (
              <button onClick={() => { setStepIdx(stepIdx + 1); setTeamFilter('ALL') }} disabled={!canGoNext()} className="flex-1 py-3 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-pink-600/20">
                {ROLE_STEPS[stepIdx + 1].label} &rarr;
              </button>
            ) : (
              <button
                onClick={() => {
                  if (selected.size !== 11) { setError(`Select exactly 11 players (you have ${selected.size})`); return }
                  setError(''); setStepIdx(STEP_SUBS); setTeamFilter('ALL')
                }}
                disabled={!canGoNext()}
                className="flex-1 py-3 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-pink-600/20"
              >
                Pick Substitutes &rarr;
              </button>
            )}
          </div>
        </>
      )}

      {isSubsStep && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Pick Substitutes</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select up to {MAX_SUBS} backup players (optional) · order = priority
              </p>
            </div>
            <div className="flex bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <button onClick={() => setTeamFilter('ALL')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${teamFilter === 'ALL' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}>Both</button>
              <button onClick={() => setTeamFilter(String(match.team1.id))} className={`px-3 py-1.5 text-xs font-medium transition-colors ${teamFilter === String(match.team1.id) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>{match.team1.short_name}</button>
              <button onClick={() => setTeamFilter(String(match.team2.id))} className={`px-3 py-1.5 text-xs font-medium transition-colors ${teamFilter === String(match.team2.id) ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>{match.team2.short_name}</button>
            </div>
          </div>

          {substitutes.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {substitutes.map((sid, i) => {
                const p = players.find(pl => pl.id === sid)
                if (!p) return null
                return (
                  <button key={sid} onClick={() => toggleSubstitute(sid)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800 text-xs hover:bg-amber-900/50 transition-colors">
                    <span className="font-bold w-4">{i + 1}.</span>
                    <span>{p.name}</span>
                    <span className="text-gray-500">{p.role}</span>
                    <span className="opacity-60">✕</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subsAvailablePlayers.map(player => {
              const isSub = substitutes.includes(player.id)
              const subIdx = substitutes.indexOf(player.id)
              const disabled = !isSub && substitutes.length >= MAX_SUBS
              return (
                <button
                  key={player.id}
                  onClick={() => toggleSubstitute(player.id)}
                  disabled={disabled}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    isSub
                      ? 'border-amber-500 bg-amber-900/20 ring-1 ring-amber-500/30'
                      : disabled
                        ? 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
                        : 'border-gray-800 bg-gray-900 hover:border-pink-800/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isSub ? 'bg-amber-900/50 text-amber-400' : 'bg-gray-800 text-gray-300'
                      }`}>
                        {isSub ? subIdx + 1 : player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{player.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{player.role}</span>
                          <span className="text-xs text-gray-500">{getTeamName(player)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-semibold">{player.credits}</p>
                      <p className="text-xs text-gray-500">credits</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3 sticky bottom-4">
            <button onClick={() => { setStepIdx(ROLE_STEPS.length - 1); setTeamFilter('ALL') }} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors">
              &larr; {ROLE_STEPS[ROLE_STEPS.length - 1].label}
            </button>
            <button
              onClick={() => { setError(''); setStepIdx(STEP_CAPTAIN) }}
              className="flex-1 py-3 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-500 transition-colors shadow-lg shadow-pink-600/20"
            >
              {substitutes.length === 0 ? 'Skip' : `${substitutes.length} Sub${substitutes.length !== 1 ? 's' : ''} Selected`} · Captain &amp; VC &rarr;
            </button>
          </div>
        </>
      )}

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
                    if (isCap) setCaptain(null)
                    else if (isVc) setViceCaptain(null)
                    else if (!captain) setCaptain(player.id)
                    else if (!viceCaptain) setViceCaptain(player.id)
                  }}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    isCap ? 'border-yellow-500 bg-yellow-900/20 hover:bg-yellow-900/10' :
                    isVc ? 'border-blue-500 bg-blue-900/20 hover:bg-blue-900/10' :
                    captain && viceCaptain ? 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed' :
                    'border-gray-800 bg-gray-900 hover:border-pink-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-xs text-gray-400">{player.role} · {getTeamName(player)}</p>
                    </div>
                    {isCap && <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-black rounded flex items-center gap-1">C <span className="text-[10px] opacity-70">✕</span></span>}
                    {isVc && <span className="px-2 py-1 text-xs font-bold bg-blue-500 text-white rounded flex items-center gap-1">VC <span className="text-[10px] opacity-70">✕</span></span>}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3 sticky bottom-4">
            <button onClick={() => setStepIdx(STEP_SUBS)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors">
              &larr; Back to Substitutes
            </button>
            {captain && viceCaptain && (
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-500 disabled:opacity-50 transition-colors shadow-lg shadow-pink-600/20">
                {submitting ? 'Saving...' : isEditing ? 'Update Team' : 'Create Team'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
