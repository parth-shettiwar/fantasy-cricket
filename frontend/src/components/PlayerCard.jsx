const ROLE_COLORS = {
  WK: 'text-yellow-400 bg-yellow-900/30',
  BAT: 'text-blue-400 bg-blue-900/30',
  AR: 'text-purple-400 bg-purple-900/30',
  BOWL: 'text-emerald-400 bg-emerald-900/30',
}

export default function PlayerCard({ player, selected, disabled, teamName, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      className={`w-full p-4 rounded-xl border text-left transition-all ${
        selected
          ? 'border-pink-500 bg-pink-900/20 ring-1 ring-pink-500/30'
          : disabled
            ? 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
            : 'border-gray-800 bg-gray-900 hover:border-pink-800/50 cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
            {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{player.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[player.role]}`}>
                {player.role}
              </span>
              <span className="text-xs text-gray-500">{teamName}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="text-sm font-semibold">{player.credits}</p>
          <p className="text-xs text-gray-500">credits</p>
        </div>
      </div>
    </button>
  )
}
