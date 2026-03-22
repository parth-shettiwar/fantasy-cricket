import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import MatchCard from '../components/MatchCard'

export default function Home() {
  const [matches, setMatches] = useState([])
  const [teamCounts, setTeamCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/matches/'),
      api.get('/points/team-counts'),
    ]).then(([matchRes, countsRes]) => {
      setMatches(matchRes.data)
      setTeamCounts(countsRes.data)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const upcoming = matches.filter(m => m.status === 'upcoming')
  const completed = matches.filter(m => m.status === 'completed')
  const live = matches.filter(m => m.status === 'live')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">IPL 2026 Fantasy</h1>
        <p className="text-gray-400">Pick your dream XI and compete for the top of the leaderboard</p>
      </div>

      {live.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Live Matches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {live.map(match => <MatchCard key={match.id} match={match} teamCount={teamCounts[match.id] || 0} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-green-400 mb-4">Upcoming Matches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map(match => <MatchCard key={match.id} match={match} teamCount={teamCounts[match.id] || 0} />)}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-400 mb-4">Completed Matches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completed.map(match => <MatchCard key={match.id} match={match} teamCount={teamCounts[match.id] || 0} />)}
          </div>
        </section>
      )}
    </div>
  )
}
