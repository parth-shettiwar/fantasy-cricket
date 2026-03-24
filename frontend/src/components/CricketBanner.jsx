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
    <div className="relative w-full h-[25vh] min-h-[200px] max-h-[300px] overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-pink-950/40 to-gray-900 border border-pink-900/30 mb-6">
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
      <div className="absolute bottom-[32px]" style={{ animation: 'rollAcross 10s linear infinite' }}>
        {/* Action emoji above character */}
        <div
          className="absolute -top-8 left-1/2 flex flex-col items-center"
          style={{ transform: `translateX(-50%) rotate(${action.rotation})` }}
        >
          <span className="text-2xl" style={{ animation: 'actionBounce 0.6s ease-out' }} key={actionIdx}>
            {action.emoji}
          </span>
          <span className="text-[9px] font-bold text-pink-400 whitespace-nowrap mt-0.5 px-2 py-0.5 rounded-full bg-pink-900/60 border border-pink-800/50">
            {action.label}
          </span>
        </div>

        {/* Kohli image on tyres */}
        <div className="relative" style={{ animation: 'characterBounce 0.4s ease-in-out infinite' }}>
          <img
            src="/assets/kohli.png"
            alt="Kohli"
            className="w-[80px] h-[100px] object-contain drop-shadow-[0_0_12px_rgba(236,72,153,0.4)]"
            style={{ imageRendering: 'auto' }}
          />
          {/* Cricket bat in hand */}
          <div
            className="absolute right-[-6px] bottom-[20px] origin-bottom-left"
            style={{ animation: 'swingBat 1.2s ease-in-out infinite' }}
          >
            <div className="w-[3px] h-[22px] bg-amber-300 rounded-sm shadow-sm" />
            <div className="w-[7px] h-[14px] bg-amber-200 rounded-sm -ml-[2px] shadow" />
          </div>
        </div>

        {/* Tyre 1 (left) */}
        <div className="absolute -bottom-[14px] left-[8px]" style={{ animation: 'spinTyre 0.4s linear infinite' }}>
          <div className="w-[22px] h-[22px] rounded-full bg-gray-900 border-[3px] border-gray-600 flex items-center justify-center shadow-lg shadow-black/50">
            <div className="w-[7px] h-[7px] rounded-full bg-gray-500 flex items-center justify-center">
              <div className="w-[2px] h-[2px] rounded-full bg-gray-300" />
            </div>
            <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-conic-gradient(from 0deg, transparent 0deg, transparent 30deg, rgba(255,255,255,0.1) 30deg, rgba(255,255,255,0.1) 60deg)' }} />
          </div>
          <div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[7px] font-black text-red-500 tracking-wider drop-shadow-sm">MRF</span>
          </div>
        </div>

        {/* Tyre 2 (right) */}
        <div className="absolute -bottom-[14px] right-[8px]" style={{ animation: 'spinTyre 0.4s linear infinite' }}>
          <div className="w-[22px] h-[22px] rounded-full bg-gray-900 border-[3px] border-gray-600 flex items-center justify-center shadow-lg shadow-black/50">
            <div className="w-[7px] h-[7px] rounded-full bg-gray-500 flex items-center justify-center">
              <div className="w-[2px] h-[2px] rounded-full bg-gray-300" />
            </div>
            <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-conic-gradient(from 0deg, transparent 0deg, transparent 30deg, rgba(255,255,255,0.1) 30deg, rgba(255,255,255,0.1) 60deg)' }} />
          </div>
          <div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[7px] font-black text-red-500 tracking-wider drop-shadow-sm">MRF</span>
          </div>
        </div>

        {/* Smoke trail */}
        <div className="absolute -bottom-[6px] -left-[18px] flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="rounded-full bg-gray-400/25"
              style={{
                width: `${6 + i * 4}px`,
                height: `${6 + i * 4}px`,
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
        <div className="w-[3px] h-[28px] bg-amber-200/50 rounded-t" />
        <div className="w-[3px] h-[28px] bg-amber-200/50 rounded-t" />
        <div className="w-[3px] h-[28px] bg-amber-200/50 rounded-t" />
        <div className="absolute top-0 -left-[1px] w-[13px] h-[2px] bg-amber-300/40 rounded" />
        <div className="absolute top-[4px] -left-[1px] w-[13px] h-[2px] bg-amber-300/40 rounded" />
      </div>

      {/* Overlay text */}
      <div className="absolute top-4 right-4 text-right">
        <p className="text-[10px] text-pink-400/50 font-medium tracking-widest uppercase">Powered by</p>
        <p className="text-sm font-black text-pink-400/30 tracking-wider">MRF ZLXION</p>
      </div>

      <div className="absolute top-4 left-4">
        <p className="text-xs font-bold text-white/70">🏏 Fantasy Cricket</p>
        <p className="text-[10px] text-pink-300/50 mt-0.5">IPL 2026 Season</p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes rollAcross {
          0% { left: -100px; }
          100% { left: calc(100% + 100px); }
        }

        @keyframes spinTyre {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes characterBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes swingBat {
          0%, 100% { transform: rotate(-25deg); }
          30% { transform: rotate(50deg); }
          60% { transform: rotate(-15deg); }
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
          100% { opacity: 0; transform: translateX(-15px) scale(0.3) translateY(-10px); }
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
