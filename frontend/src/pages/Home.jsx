import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import MatchCard from '../components/MatchCard'
import CricketBanner from '../components/CricketBanner'

export default function Home() {
  const [matches, setMatches] = useState([])
  const [teamCounts, setTeamCounts] = useState({})
  const [myMatchIds, setMyMatchIds] = useState(new Set())
  const [activeTab, setActiveTab] = useState('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const fetches = [
      api.get('/matches/'),
      api.get('/points/team-counts'),
    ]
    if (token) {
      fetches.push(api.get('/teams/my').catch(() => ({ data: [] })))
    }
    Promise.all(fetches).then(([matchRes, countsRes, myTeamsRes]) => {
      setMatches(matchRes.data)
      setTeamCounts(countsRes.data)
      if (myTeamsRes?.data) {
        setMyMatchIds(new Set(myTeamsRes.data.map(t => t.match_id)))
      }
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const live = matches.filter(m => m.status === 'live')
  const completed = matches.filter(m => {
    if (m.status === 'completed') return true
    if (m.status !== 'upcoming') return false
    const matchDate = new Date(String(m.date).endsWith('Z') || String(m.date).includes('+') ? m.date : `${m.date}Z`)
    return matchDate < now
  })
  const completedIds = new Set(completed.map(m => m.id))
  const liveIds = new Set(live.map(m => m.id))
  const upcoming = matches.filter(m => !liveIds.has(m.id) && !completedIds.has(m.id))
  const tabs = [
    { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
    { id: 'live', label: `Live (${live.length})` },
    { id: 'completed', label: `Completed (${completed.length})` },
  ]
  const activeMatches =
    activeTab === 'live' ? live :
    activeTab === 'completed' ? completed :
    upcoming

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <CricketBanner />

      <div>
        <h1 className="text-3xl font-bold mb-2">IPL 2026 Fantasy</h1>
        <p className="text-gray-400">Pick your dream XI and compete for the top of the leaderboard</p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                activeTab === tab.id
                  ? 'bg-pink-600 text-white border-pink-500'
                  : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeMatches.length === 0 ? (
          <p className="text-sm text-gray-500">No matches in this tab.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMatches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                teamCount={teamCounts[match.id] || 0}
                hasTeam={myMatchIds.has(match.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
