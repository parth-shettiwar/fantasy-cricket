import { useState, useEffect } from 'react'

const ACTIONS = [
  { emoji: '🏏', label: 'Cover Drive!', rotation: '-15deg' },
  { emoji: '💥', label: 'SIX!', rotation: '10deg' },
  { emoji: '☝️', label: 'Century!', rotation: '-5deg' },
  { emoji: '🏃', label: 'Quick Single!', rotation: '5deg' },
  { emoji: '👊', label: 'Aggression!', rotation: '-10deg' },
  { emoji: '🔥', label: 'On Fire!', rotation: '8deg' },
  { emoji: '👑', label: 'King Kohli!', rotation: '0deg' },
  { emoji: '🎯', label: 'Bowled!', rotation: '-12deg' },
]

export default function CricketBanner() {
  const [actionIdx, setActionIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActionIdx(prev => (prev + 1) % ACTIONS.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  const action = ACTIONS[actionIdx]

  return (
    <div className="relative w-full h-[25vh] min-h-[180px] max-h-[280px] overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-pink-950/40 to-gray-900 border border-pink-900/30 mb-6">
      {/* Animated stars / particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-pink-400/20"
            style={{
              width: `${3 + (i % 4) * 2}px`,
              height: `${3 + (i % 4) * 2}px`,
              left: `${(i * 8.3) % 100}%`,
              top: `${(i * 13 + 10) % 80}%`,
              animation: `sparkle ${1.5 + (i % 3) * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Road / ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[35px]">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-800 to-gray-800/80" />
        <div className="absolute top-[15px] left-0 right-0 h-[2px] bg-yellow-500/30" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #eab30850 0px, #eab30850 20px, transparent 20px, transparent 40px)' }} />
        <div className="absolute bottom-[8px] left-0 right-0 h-[1px] bg-gray-700" />
      </div>

      {/* Rolling character group */}
      <div className="absolute bottom-[32px]" style={{ animation: 'rollAcross 8s linear infinite' }}>
        {/* Action emoji above character */}
        <div
          className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
          style={{ transform: `translateX(-50%) rotate(${action.rotation})` }}
        >
          <span className="text-3xl" style={{ animation: 'actionBounce 0.6s ease-out', key: actionIdx }}>
            {action.emoji}
          </span>
          <span className="text-[10px] font-bold text-pink-400 whitespace-nowrap mt-1 px-2 py-0.5 rounded-full bg-pink-900/50 border border-pink-800/50">
            {action.label}
          </span>
        </div>

        {/* Character body */}
        <div className="relative" style={{ animation: 'characterBounce 0.4s ease-in-out infinite' }}>
          {/* Head */}
          <div className="absolute -top-[38px] left-1/2 -translate-x-1/2 w-[28px] h-[28px] rounded-full bg-amber-700 border-2 border-amber-600 flex items-center justify-center text-[14px] shadow-lg">
            😤
          </div>
          {/* Jersey - number 18 */}
          <div className="w-[32px] h-[28px] bg-blue-700 rounded-t-lg rounded-b-sm flex items-center justify-center relative border border-blue-600 shadow-md">
            <span className="text-[11px] font-black text-white leading-none">18</span>
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500/50 rounded-t-lg" />
          </div>
          {/* Bat in hand */}
          <div
            className="absolute -right-4 top-0 origin-bottom-left"
            style={{ animation: 'swingBat 1.2s ease-in-out infinite' }}
          >
            <div className="w-[4px] h-[20px] bg-amber-200 rounded-sm shadow" />
            <div className="w-[8px] h-[3px] bg-amber-300 rounded-b-sm -ml-[2px]" />
          </div>
        </div>

        {/* Tyre 1 (left) */}
        <div className="absolute -bottom-[16px] left-[-4px]" style={{ animation: 'spinTyre 0.5s linear infinite' }}>
          <div className="w-[20px] h-[20px] rounded-full bg-gray-900 border-[3px] border-gray-700 flex items-center justify-center shadow-md">
            <div className="w-[6px] h-[6px] rounded-full bg-gray-600 flex items-center justify-center">
              <div className="w-[2px] h-[2px] rounded-full bg-gray-400" />
            </div>
            {/* Tread marks */}
            <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-conic-gradient(from 0deg, transparent 0deg, transparent 30deg, rgba(255,255,255,0.08) 30deg, rgba(255,255,255,0.08) 60deg)' }} />
          </div>
          <div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[6px] font-black text-red-500 tracking-wider">MRF</span>
          </div>
        </div>

        {/* Tyre 2 (right) */}
        <div className="absolute -bottom-[16px] right-[-4px]" style={{ animation: 'spinTyre 0.5s linear infinite' }}>
          <div className="w-[20px] h-[20px] rounded-full bg-gray-900 border-[3px] border-gray-700 flex items-center justify-center shadow-md">
            <div className="w-[6px] h-[6px] rounded-full bg-gray-600 flex items-center justify-center">
              <div className="w-[2px] h-[2px] rounded-full bg-gray-400" />
            </div>
            <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-conic-gradient(from 0deg, transparent 0deg, transparent 30deg, rgba(255,255,255,0.08) 30deg, rgba(255,255,255,0.08) 60deg)' }} />
          </div>
          <div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[6px] font-black text-red-500 tracking-wider">MRF</span>
          </div>
        </div>

        {/* Smoke trail */}
        <div className="absolute -bottom-[8px] -left-[20px] flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="rounded-full bg-gray-500/20"
              style={{
                width: `${6 + i * 3}px`,
                height: `${6 + i * 3}px`,
                animation: `smoke 0.8s ease-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Flying cricket balls */}
      <div className="absolute" style={{ animation: 'flyBall1 4s linear infinite' }}>
        <span className="text-lg">🏐</span>
      </div>
      <div className="absolute" style={{ animation: 'flyBall2 5.5s linear infinite', animationDelay: '2s' }}>
        <span className="text-sm">🏐</span>
      </div>

      {/* Stumps on the right */}
      <div className="absolute bottom-[35px] right-[12%] flex gap-[2px]">
        <div className="w-[3px] h-[24px] bg-amber-200/60 rounded-t" />
        <div className="w-[3px] h-[24px] bg-amber-200/60 rounded-t" />
        <div className="w-[3px] h-[24px] bg-amber-200/60 rounded-t" />
        <div className="absolute top-0 -left-[1px] w-[13px] h-[2px] bg-amber-300/50 rounded" />
        <div className="absolute top-[3px] -left-[1px] w-[13px] h-[2px] bg-amber-300/50 rounded" />
      </div>

      {/* Overlay text */}
      <div className="absolute top-4 right-4 text-right">
        <p className="text-[10px] text-pink-400/60 font-medium tracking-widest uppercase">Powered by</p>
        <p className="text-sm font-black text-pink-400/40 tracking-wider">MRF ZLXION</p>
      </div>

      <div className="absolute top-4 left-4">
        <p className="text-xs font-bold text-white/70">🏏 Fantasy Cricket</p>
        <p className="text-[10px] text-pink-300/50 mt-0.5">IPL 2026 Season</p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes rollAcross {
          0% { left: -60px; }
          100% { left: calc(100% + 60px); }
        }

        @keyframes spinTyre {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes characterBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes swingBat {
          0%, 100% { transform: rotate(-20deg); }
          30% { transform: rotate(45deg); }
          60% { transform: rotate(-10deg); }
        }

        @keyframes actionBounce {
          0% { transform: translateX(-50%) scale(0.3) rotate(-20deg); opacity: 0; }
          50% { transform: translateX(-50%) scale(1.3) rotate(5deg); opacity: 1; }
          100% { transform: translateX(-50%) scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }

        @keyframes smoke {
          0% { opacity: 0.5; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(-15px) scale(0.3) translateY(-8px); }
        }

        @keyframes flyBall1 {
          0% { left: 85%; top: 60%; opacity: 0; }
          10% { opacity: 1; }
          50% { left: 50%; top: 15%; }
          90% { opacity: 1; }
          100% { left: 15%; top: 55%; opacity: 0; transform: rotate(720deg); }
        }

        @keyframes flyBall2 {
          0% { right: 80%; top: 50%; opacity: 0; }
          10% { opacity: 0.7; }
          50% { right: 40%; top: 10%; }
          90% { opacity: 0.7; }
          100% { right: 10%; top: 45%; opacity: 0; transform: rotate(-540deg); }
        }
      `}</style>
    </div>
  )
}
