import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import TeamSelection from './pages/TeamSelection'
import MyTeams from './pages/MyTeams'
import MatchDetail from './pages/MatchDetail'
import Leaderboard from './pages/Leaderboard'
import Login from './pages/Login'
import Register from './pages/Register'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'
import JoinRoom from './pages/JoinRoom'
import UserProfile from './pages/UserProfile'
import TeamDetail from './pages/TeamDetail'

function App() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)

    const pendingJoin = localStorage.getItem('pendingJoin')
    if (pendingJoin) {
      localStorage.removeItem('pendingJoin')
      navigate(`/join/${pendingJoin}`)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🏏</span>
              <span className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Fantasy Cricket
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <Link to="/" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Matches
              </Link>
              {user && (
                <>
                  <Link to="/my-teams" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                    My Teams
                  </Link>
                  <Link to="/rooms" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                    Rooms
                  </Link>
                  <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                    Leaderboard
                  </Link>
                </>
              )}
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">Hi, {user.username}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors font-medium"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="/match/:matchId/select-team" element={user ? <TeamSelection /> : <Navigate to="/login" />} />
          <Route path="/match/:matchId" element={<MatchDetail />} />
          <Route path="/my-teams" element={user ? <MyTeams /> : <Navigate to="/login" />} />
          <Route path="/rooms" element={user ? <Rooms /> : <Navigate to="/login" />} />
          <Route path="/rooms/:roomId" element={user ? <RoomDetail /> : <Navigate to="/login" />} />
          <Route path="/join/:inviteCode" element={<JoinRoom />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/user/:userId" element={<UserProfile />} />
          <Route path="/team/:teamId" element={<TeamDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
