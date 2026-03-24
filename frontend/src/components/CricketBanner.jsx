import { useState, useEffect } from 'react'

const ACTIONS = [
  {
    emoji: '🏏', label: 'Cover Drive!',
    imgStyle: { transform: 'rotate(-20deg) translateX(8px)', transition: 'transform 0.4s ease-out' },
    batAngle: 60,
  },
  {
    emoji: '💥', label: 'SIX!',
    imgStyle: { transform: 'rotate(15deg) scaleX(-1) translateY(-12px)', transition: 'transform 0.3s ease-out' },
    batAngle: -40,
  },
  {
    emoji: '☝️', label: 'Century!',
    imgStyle: { transform: 'translateY(-20px) scale(1.1)', transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' },
    batAngle: 0,
  },
  {
    emoji: '🏃', label: 'Quick Single!',
    imgStyle: { transform: 'rotate(-8deg) skewX(-8deg) translateX(6px)', transition: 'transform 0.3s ease-out' },
    batAngle: 20,
  },
  {
    emoji: '👊', label: 'Aggression!',
    imgStyle: { transform: 'scale(1.15) rotate(5deg)', transition: 'transform 0.2s ease-out' },
    batAngle: -30,
  },
  {
    emoji: '🔥', label: 'On Fire!',
    imgStyle: { transform: 'translateY(-8px) rotate(-5deg) scale(1.05)', transition: 'transform 0.3s ease-out' },
    batAngle: 45,
  },
  {
    emoji: '👑', label: 'King Kohli!',
    imgStyle: { transform: 'translateY(-16px) scale(1.12) rotate(3deg)', transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' },
    batAngle: 10,
  },
  {
    emoji: '🎯', label: 'Pull Shot!',
    imgStyle: { transform: 'rotate(25deg) translateX(-5px) scaleX(-1)', transition: 'transform 0.3s ease-out' },
    batAngle: -55,
  },
]

export default function CricketBanner() {
  const [actionIdx, setActionIdx] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setActionIdx(prev => (prev + 1) % ACTIONS.length)
        setIsTransitioning(false)
      }, 200)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const action = ACTIONS[actionIdx]

  return (
    <div className="relative w-full h-[25vh] min-h-[200px] max-h-[300px] overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-pink-950/40 to-gray-900 border border-pink-900/30 mb-6 select-none">
      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${3 + (i % 4) * 2}px`,
              height: `${3 + (i % 4) * 2}px`,
              left: `${(i * 7) % 100}%`,
              top: `${(i * 11 + 8) % 75}%`,
              background: i % 3 === 0 ? 'rgba(236,72,153,0.25)' : 'rgba(255,255,255,0.08)',
              animation: `sparkle ${1.5 + (i % 3) * 0.7}s ease-in-out infinite`,
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[38px]">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-800 to-gray-800/70" />
        <div className="absolute top-[16px] left-0 right-0 h-[2px]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(234,179,8,0.3) 0px, rgba(234,179,8,0.3) 20px, transparent 20px, transparent 40px)' }} />
        <div className="absolute bottom-[8px] left-0 right-0 h-[1px] bg-gray-700/50" />
      </div>

      {/* === MAIN CHARACTER ASSEMBLY === */}
      <div className="absolute bottom-[36px]" style={{ animation: 'rollAcross 9s linear infinite' }}>

        {/* Action label floating above */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 pointer-events-none">
          <span
            className="text-2xl block"
            key={`e-${actionIdx}`}
            style={{ animation: 'popEmoji 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
          >
            {action.emoji}
          </span>
          <span
            className="text-[9px] font-bold text-pink-300 whitespace-nowrap mt-0.5 px-2 py-0.5 rounded-full bg-pink-900/70 border border-pink-700/50 shadow-lg shadow-pink-900/30"
            key={`l-${actionIdx}`}
            style={{ animation: 'fadeLabel 0.4s ease-out forwards' }}
          >
            {action.label}
          </span>
        </div>

        {/* Character container - bounces on tyres */}
        <div style={{ animation: 'rideOnTyres 0.35s ease-in-out infinite' }}>

          {/* Caricature + bat + action pose transforms */}
          <div
            className="relative"
            style={{
              ...action.imgStyle,
              opacity: isTransitioning ? 0.6 : 1,
              filter: isTransitioning
                ? 'blur(2px) brightness(1.3)'
                : 'drop-shadow(0 0 15px rgba(236,72,153,0.45)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
              transition: `${action.imgStyle.transition}, opacity 0.2s, filter 0.2s`,
            }}
          >
            <div
              className="inline-block origin-bottom"
              style={{ animation: 'headAlive 2.8s ease-in-out infinite' }}
            >
              <img
                src="/assets/kohli-caricature.png"
                alt="Player"
                className="w-[76px] h-[108px] object-contain object-bottom"
                width={226}
                height={320}
              />
            </div>

            <div
              className="absolute right-[-8px] bottom-[15px] origin-bottom"
              style={{
                transform: `rotate(${action.batAngle}deg)`,
                transition: 'transform 0.35s ease-out',
              }}
            >
              <div className="w-[3px] h-[18px] bg-amber-400 rounded-t-sm" />
              <div className="w-[8px] h-[16px] bg-amber-200 rounded-b-md -ml-[2.5px] border border-amber-400/50" />
            </div>

            {/* Motion lines when transitioning */}
            {isTransitioning && (
              <div className="absolute inset-0 pointer-events-none">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="absolute bg-pink-400/40 rounded-full"
                    style={{
                      width: '2px',
                      height: `${12 + i * 5}px`,
                      left: `${-6 - i * 5}px`,
                      top: `${20 + i * 15}px`,
                      transform: 'rotate(-15deg)',
                      animation: 'motionLine 0.3s ease-out forwards',
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tyre left */}
        <div className="absolute -bottom-[15px] left-[10px]" style={{ animation: 'spinTyre 0.35s linear infinite' }}>
          <div className="w-[24px] h-[24px] rounded-full bg-gray-950 border-[3px] border-gray-600 flex items-center justify-center shadow-lg shadow-black/60">
            <div className="w-[8px] h-[8px] rounded-full bg-gray-500">
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 mx-auto mt-[2.5px]" />
            </div>
            <div className="absolute inset-[2px] rounded-full" style={{ background: 'repeating-conic-gradient(from 0deg, transparent 0deg 25deg, rgba(255,255,255,0.12) 25deg 50deg)' }} />
          </div>
          <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[7px] font-black text-red-500 tracking-wider">MRF</span>
          </div>
        </div>

        {/* Tyre right */}
        <div className="absolute -bottom-[15px] right-[10px]" style={{ animation: 'spinTyre 0.35s linear infinite', animationDelay: '0.1s' }}>
          <div className="w-[24px] h-[24px] rounded-full bg-gray-950 border-[3px] border-gray-600 flex items-center justify-center shadow-lg shadow-black/60">
            <div className="w-[8px] h-[8px] rounded-full bg-gray-500">
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 mx-auto mt-[2.5px]" />
            </div>
            <div className="absolute inset-[2px] rounded-full" style={{ background: 'repeating-conic-gradient(from 0deg, transparent 0deg 25deg, rgba(255,255,255,0.12) 25deg 50deg)' }} />
          </div>
          <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[7px] font-black text-red-500 tracking-wider">MRF</span>
          </div>
        </div>

        {/* Dust / smoke trail */}
        <div className="absolute -bottom-[5px] -left-[12px] flex gap-[3px]">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="rounded-full bg-gray-400/30"
              style={{
                width: `${5 + i * 3}px`,
                height: `${5 + i * 3}px`,
                animation: `smoke 0.7s ease-out infinite`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Flying balls */}
      <div className="absolute" style={{ animation: 'flyBall1 4.5s linear infinite' }}>
        <span className="text-lg">🏐</span>
      </div>
      <div className="absolute" style={{ animation: 'flyBall2 6s linear infinite', animationDelay: '2.5s' }}>
        <span className="text-base">🏐</span>
      </div>

      {/* Stumps */}
      <div className="absolute bottom-[38px] right-[10%] flex gap-[2px] opacity-60">
        <div className="w-[3px] h-[30px] bg-amber-200/50 rounded-t" />
        <div className="w-[3px] h-[30px] bg-amber-200/50 rounded-t" />
        <div className="w-[3px] h-[30px] bg-amber-200/50 rounded-t" />
        <div className="absolute top-0 -left-[1px] w-[14px] h-[2px] bg-amber-300/40 rounded" />
        <div className="absolute top-[4px] -left-[1px] w-[14px] h-[2px] bg-amber-300/40 rounded" />
      </div>

      {/* Branding */}
      <div className="absolute top-4 right-4 text-right">
        <p className="text-[10px] text-pink-400/40 font-medium tracking-widest uppercase">Powered by</p>
        <p className="text-sm font-black text-pink-400/25 tracking-wider">MRF ZLXION</p>
      </div>
      <div className="absolute top-4 left-4">
        <p className="text-xs font-bold text-white/60">🏏 Fantasy Cricket</p>
        <p className="text-[10px] text-pink-300/40 mt-0.5">IPL 2026 Season</p>
      </div>

      <style>{`
        @keyframes rollAcross {
          0% { left: -120px; }
          100% { left: calc(100% + 120px); }
        }

        @keyframes spinTyre {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes rideOnTyres {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-5px) rotate(-1deg); }
          75% { transform: translateY(-2px) rotate(1deg); }
        }

        @keyframes popEmoji {
          0% { transform: translateX(-50%) scale(0) rotate(-30deg); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.4) rotate(8deg); opacity: 1; }
          100% { transform: translateX(-50%) scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes fadeLabel {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes motionLine {
          0% { opacity: 0.8; transform: rotate(-15deg) scaleY(1); }
          100% { opacity: 0; transform: rotate(-15deg) scaleY(0.3) translateX(-10px); }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.8); }
        }

        @keyframes smoke {
          0% { opacity: 0.5; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(-18px) scale(0.2) translateY(-12px); }
        }

        @keyframes flyBall1 {
          0% { left: 85%; top: 55%; opacity: 0; }
          10% { opacity: 1; }
          50% { left: 50%; top: 12%; }
          90% { opacity: 1; }
          100% { left: 15%; top: 50%; opacity: 0; transform: rotate(720deg); }
        }

        @keyframes flyBall2 {
          0% { right: 75%; top: 50%; opacity: 0; }
          10% { opacity: 0.6; }
          50% { right: 40%; top: 8%; }
          90% { opacity: 0.6; }
          100% { right: 10%; top: 45%; opacity: 0; transform: rotate(-540deg); }
        }

        @keyframes headAlive {
          0%, 100% { transform: scale(1) rotate(-1deg); }
          25% { transform: scale(1.028) rotate(1.5deg); }
          50% { transform: scale(1.018) rotate(-0.5deg); }
          75% { transform: scale(1.032) rotate(2deg); }
        }
      `}</style>
    </div>
  )
}
