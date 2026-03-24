import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [resetLink, setResetLink] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setMessage('')
    setResetLink('')
    setCopied(false)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', {
        email: email.trim(),
        frontend_origin: window.location.origin,
      })
      setMessage(data.message)
      if (data.reset_link) {
        setResetLink(data.reset_link)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!resetLink) return
    try {
      await navigator.clipboard.writeText(resetLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Forgot password</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter your email. If the account exists, you will get a reset link by email when the server
            is configured for email; otherwise the link appears on this page.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-800 text-red-300 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 space-y-3">
              <div className="p-3 rounded-lg bg-emerald-900/40 border border-emerald-800 text-emerald-200 text-sm">
                {message}
              </div>
              {resetLink && (
                <div className="rounded-lg border border-pink-800/50 bg-pink-950/30 p-3">
                  <p className="text-xs text-pink-200/90 mb-2">Your one-time reset link (keep it private):</p>
                  <p className="text-[11px] text-gray-300 break-all mb-3 font-mono">{resetLink}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyLink}
                      className="px-3 py-1.5 rounded-lg bg-pink-600 text-white text-sm hover:bg-pink-500"
                    >
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    <a
                      href={resetLink}
                      className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-sm hover:bg-gray-600 inline-block"
                    >
                      Open reset page
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-pink-500 transition-colors"
                required
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-pink-600 text-white font-medium hover:bg-pink-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Working…' : 'Request reset link'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/login" className="text-pink-400 hover:text-pink-300">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
