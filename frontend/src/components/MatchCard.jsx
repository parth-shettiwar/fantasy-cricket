import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

function asUTC(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr)
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

function getCountdown(lockTime) {
  const diff = asUTC(lockTime) - new Date()
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function formatLocalDeadline(lockTime) {
  const dt = asUTC(lockTime)
  if (!dt || Number.isNaN(dt.getTime())) return ''
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const local = dt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${local} (${tz})`
}

const STATUS_STYLES = {
  upcoming: 'bg-pink-900/40 text-pink-400 border-pink-800',
  live: 'bg-red-900/50 text-red-400 border-red-800',
  completed: 'bg-gray-800/50 text-gray-400 border-gray-700',
}

export default function MatchCard({ match, teamCount = 0, hasTeam = false }) {
  const [countdown, setCountdown] = useState(getCountdown(match.lock_time))

  useEffect(() => {
    if (match.status !== 'upcoming') return
    const interval = setInterval(() => {
      setCountdown(getCountdown(match.lock_time))
    }, 1000)
    return () => clearInterval(interval)
  }, [match.lock_time, match.status])

  const matchDate = asUTC(match.date)
  const localDeadline = formatLocalDeadline(match.lock_time)
  const isLocked = !countdown && match.status === 'upcoming'

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-pink-800/50 transition-all">
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLES[match.status]}`}>
          {match.status === 'live' && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>}
          {match.status.toUpperCase()}
        </span>
        <span className="text-xs text-gray-500">
          {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &middot;{' '}
          {matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 text-center">
          <div className="w-12 h-12 mx-auto bg-gray-800 rounded-full flex items-center justify-center text-lg font-bold text-pink-400 mb-2">
            {match.team1.short_name.slice(0, 2)}
          </div>
          <p className="text-sm font-semibold">{match.team1.short_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{match.team1.name}</p>
        </div>

        <div className="px-4">
          <span className="text-gray-600 font-bold text-lg">VS</span>
        </div>

        <div className="flex-1 text-center">
          <div className="w-12 h-12 mx-auto bg-gray-800 rounded-full flex items-center justify-center text-lg font-bold text-rose-400 mb-2">
            {match.team2.short_name.slice(0, 2)}
          </div>
          <p className="text-sm font-semibold">{match.team2.short_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{match.team2.name}</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center mb-2">{match.venue}</p>

      {teamCount > 0 && (
        <p className="text-xs text-center mb-3">
          <Link to={`/match/${match.id}`} className="text-pink-400 hover:text-pink-300 transition-colors">
            {teamCount} team{teamCount !== 1 ? 's' : ''} joined
          </Link>
        </p>
      )}

      {match.status === 'upcoming' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {countdown ? (
              <span className="text-xs text-amber-400">Locks in {countdown}</span>
            ) : (
              <span className="text-xs text-red-400">Locked</span>
            )}
            {!isLocked && (
              <Link
                to={`/match/${match.id}/select-team`}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                  hasTeam
                    ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800 hover:bg-yellow-900/70'
                    : 'bg-pink-600 text-white hover:bg-pink-500'
                }`}
              >
                {hasTeam ? 'Edit Team' : 'Create Team'}
              </Link>
            )}
          </div>
          {localDeadline && (
            <p className="text-[11px] text-gray-500">
              Submit by: {localDeadline}
            </p>
          )}
        </div>
      )}

      {match.status === 'live' && (
        <div className="flex items-center justify-center">
          <Link
            to={`/match/${match.id}`}
            className="text-sm px-4 py-2 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900/70 transition-colors border border-red-800"
          >
            View Live
          </Link>
        </div>
      )}

      {match.status === 'completed' && (
        <div className="flex justify-center">
          <Link
            to={`/match/${match.id}`}
            className="text-sm px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            View Scorecard
          </Link>
        </div>
      )}
    </div>
  )
}
