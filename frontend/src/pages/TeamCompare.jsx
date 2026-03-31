import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'

export default function TeamCompare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [matches, setMatches] = useState([])
  const [users, setUsers] = useState([])
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(false)

  const matchId = searchParams.get('match_id') || ''
  const user1Id = searchParams.get('user1_id') || ''
  const user2Id = searchParams.get('user2_id') || ''

  useEffect(() => {
    api.get('/matches/')
      .then(res => {
        const playable = res.data.filter(m => m.status === 'live' || m.status === 'completed')
        setMatches(playable)
        // If opened from nav without query params, default to latest playable match.
        if (!matchId && playable.length > 0) {
          setSearchParams({ match_id: String(playable[0].id) })
        }
      })
      .catch(console.error)
  }, [matchId, setSearchParams])

  useEffect(() => {
    if (!matchId) {
      setUsers([])
      setComparison(null)
      return
    }
    api.get(`/points/match/${matchId}/leaderboard`)
      .then(res => {
        const opts = (res.data || []).map(u => ({ id: String(u.user_id), username: u.username }))
        setUsers(opts)
      })
      .catch(console.error)
  }, [matchId])

  useEffect(() => {
    if (!matchId || !user1Id || !user2Id) {
      setComparison(null)
      return
    }
    if (user1Id === user2Id) {
      setComparison(null)
      return
    }
    setLoading(true)
    api.get('/points/compare', {
      params: {
        match_id: Number(matchId),
        user1_id: Number(user1Id),
        user2_id: Number(user2Id),
      },
    })
      .then(res => setComparison(res.data))
      .catch(err => {
        console.error(err)
        setComparison(null)
      })
      .finally(() => setLoading(false))
  }, [matchId, user1Id, user2Id])

  const matchLabel = useMemo(() => {
    const m = matches.find(x => String(x.id) === matchId)
    return m ? `${m.team1.short_name} vs ${m.team2.short_name}` : ''
  }, [matches, matchId])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sm:p-6 space-y-4">
        <h1 className="text-2xl font-bold">Compare Teams</h1>
        <p className="text-sm text-gray-400">Pick a match and two users to see team differences.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={matchId}
            onChange={e => {
              const nextMatchId = e.target.value
              const next = new URLSearchParams(searchParams)
              if (nextMatchId) next.set('match_id', nextMatchId)
              else next.delete('match_id')
              next.delete('user1_id')
              next.delete('user2_id')
              setSearchParams(next)
            }}
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select match</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.team1.short_name} vs {m.team2.short_name}
              </option>
            ))}
          </select>

          <select
            value={user1Id}
            onChange={e => updateParam('user1_id', e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            disabled={!matchId}
          >
            <option value="">User 1</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>

          <select
            value={user2Id}
            onChange={e => updateParam('user2_id', e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            disabled={!matchId}
          >
            <option value="">User 2</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading comparison...</p>}

      {comparison && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sm:p-6">
            <p className="text-sm text-gray-400">{matchLabel || comparison.match.name}</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <Link to={`/user/${comparison.user1.user_id}`} className="font-semibold hover:text-pink-400">{comparison.user1.username}</Link>
                <p className="text-pink-400 font-bold text-xl mt-1">{comparison.user1.total_points.toFixed(1)}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <Link to={`/user/${comparison.user2.user_id}`} className="font-semibold hover:text-pink-400">{comparison.user2.username}</Link>
                <p className="text-pink-400 font-bold text-xl mt-1">{comparison.user2.total_points.toFixed(1)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              Delta: <span className={comparison.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>{comparison.delta.toFixed(1)}</span>
            </p>
          </div>

          <section className="bg-gray-900 rounded-xl border border-gray-800 p-4 sm:p-6">
            <h2 className="font-semibold mb-3">Different Picks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm text-gray-400 mb-2">Only {comparison.user1.username}</h3>
                <div className="space-y-2">
                  {comparison.only_user1.length === 0 && <p className="text-xs text-gray-500">No unique players</p>}
                  {comparison.only_user1.map(p => (
                    <div key={p.player_id} className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 flex justify-between">
                      <span className="truncate text-sm">{p.name}</span>
                      <span className="text-sm text-pink-400">{p.final_points.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm text-gray-400 mb-2">Only {comparison.user2.username}</h3>
                <div className="space-y-2">
                  {comparison.only_user2.length === 0 && <p className="text-xs text-gray-500">No unique players</p>}
                  {comparison.only_user2.map(p => (
                    <div key={p.player_id} className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 flex justify-between">
                      <span className="truncate text-sm">{p.name}</span>
                      <span className="text-sm text-pink-400">{p.final_points.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
