import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import KingKohliVideoOverlay from './components/KingKohliVideoOverlay'
import Home from './pages/Home'
import TeamSelection from './pages/TeamSelection'
import MyTeams from './pages/MyTeams'
import MatchDetail from './pages/MatchDetail'
import Leaderboard from './pages/Leaderboard'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'
import JoinRoom from './pages/JoinRoom'
import UserProfile from './pages/UserProfile'
import TeamDetail from './pages/TeamDetail'

function App() {
  const [user, setUser] = useState(null)
  const [kingKohliVideoOpen, setKingKohliVideoOpen] = useState(false)
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
      <style>{`
        @keyframes kingKohliGlow {
          0%, 100% {
            box-shadow: 0 0 14px #ec4899, 0 0 26px rgba(239, 68, 68, 0.55), 0 0 12px rgba(52, 211, 153, 0.45);
            text-shadow: 0 0 8px rgba(236, 72, 153, 0.9), 0 0 4px rgba(34, 197, 94, 0.6);
          }
          33% {
            box-shadow: 0 0 18px #22c55e, 0 0 22px rgba(236, 72, 153, 0.6), 0 0 14px rgba(239, 68, 68, 0.5);
            text-shadow: 0 0 10px rgba(34, 197, 94, 0.85), 0 0 6px rgba(244, 63, 94, 0.7);
          }
          66% {
            box-shadow: 0 0 16px #ef4444, 0 0 28px rgba(236, 72, 153, 0.55), 0 0 10px rgba(52, 211, 153, 0.5);
            text-shadow: 0 0 8px rgba(248, 113, 113, 0.9), 0 0 6px rgba(236, 72, 153, 0.7);
          }
        }
      `}</style>

      <header className="sticky top-0 z-50">
        <div className="flex justify-center px-4 py-2.5 bg-gray-950/95 border-b border-pink-900/40">
          <button
            type="button"
            onClick={() => setKingKohliVideoOpen(true)}
            className="rounded-full px-4 py-2 text-xs sm:text-sm font-bold tracking-wide text-white bg-gradient-to-r from-pink-950/90 via-gray-900 to-rose-950/90 border border-pink-500/40 hover:border-pink-400/70 transition-colors max-w-[min(100%,28rem)] text-center leading-snug"
            style={{ animation: 'kingKohliGlow 2.2s ease-in-out infinite' }}
          >
            Watch King Kohli best contribution
          </button>
        </div>
        <nav className="bg-gray-900/80 backdrop-blur-md border-b border-pink-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🏏</span>
              <span className="text-xl font-bold bg-gradient-to-r from-pink-400 to-rose-500 bg-clip-text text-transparent">
                Fantasy Cricket
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <Link to="/" className="text-gray-300 hover:text-pink-300 transition-colors text-sm font-medium">
                Matches
              </Link>
              {user && (
                <>
                  <Link to="/my-teams" className="text-gray-300 hover:text-pink-300 transition-colors text-sm font-medium">
                    My Teams
                  </Link>
                  <Link to="/rooms" className="text-gray-300 hover:text-pink-300 transition-colors text-sm font-medium">
                    Rooms
                  </Link>
                  <Link to="/leaderboard" className="text-gray-300 hover:text-pink-300 transition-colors text-sm font-medium">
                    Leaderboard
                  </Link>
                </>
              )}
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-pink-300/70">Hi, {user.username}</span>
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
                  className="text-sm px-4 py-1.5 rounded-lg bg-pink-600 text-white hover:bg-pink-500 transition-colors font-medium"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
        </nav>
      </header>

      <KingKohliVideoOverlay open={kingKohliVideoOpen} onClose={() => setKingKohliVideoOpen(false)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
