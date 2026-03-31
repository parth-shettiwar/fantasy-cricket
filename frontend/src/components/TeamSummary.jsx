export default function TeamSummary({ breakdown }) {
  if (!breakdown) return null

  const sorted = [...breakdown.player_points].sort((a, b) => b.final_points - a.final_points)

  return (
    <div className="space-y-2">
      {/* Desktop header */}
      <div className="hidden md:grid grid-cols-[1fr_60px_60px_60px_60px_70px] gap-2 text-xs text-gray-500 font-medium px-3">
        <span>Player</span>
        <span className="text-right">BAT</span>
        <span className="text-right">BOWL</span>
        <span className="text-right">FIELD</span>
        <span className="text-right">Base</span>
        <span className="text-right">Final</span>
      </div>

      {sorted.map(pp => (
        <div
          key={pp.player_id}
          className={`rounded-lg ${
            pp.is_captain ? 'bg-yellow-900/20 border border-yellow-900/50' :
            pp.is_vice_captain ? 'bg-blue-900/20 border border-blue-900/50' :
            'bg-gray-800/50'
          }`}
        >
          {/* Desktop row */}
          <div className="hidden md:grid grid-cols-[1fr_60px_60px_60px_60px_70px] gap-2 items-center text-sm px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{pp.player_name}</span>
              {pp.is_captain && <span className="shrink-0 text-xs px-1.5 py-0.5 bg-yellow-500 text-black rounded font-bold">C</span>}
              {pp.is_vice_captain && <span className="shrink-0 text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded font-bold">VC</span>}
              <span className="shrink-0 text-xs text-gray-500">({pp.team_short_name})</span>
            </div>
            <span className="text-right text-gray-300">{pp.batting_points}</span>
            <span className="text-right text-gray-300">{pp.bowling_points}</span>
            <span className="text-right text-gray-300">{pp.fielding_points}</span>
            <span className="text-right text-gray-300">{pp.total_points}</span>
            <span className={`text-right font-semibold ${pp.final_points > 0 ? 'text-pink-400' : pp.final_points < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {pp.final_points.toFixed(1)}
            </span>
          </div>

          {/* Mobile row */}
          <div className="md:hidden px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-sm truncate">{pp.player_name}</span>
                {pp.is_captain && <span className="shrink-0 text-[10px] px-1 py-0.5 bg-yellow-500 text-black rounded font-bold">C</span>}
                {pp.is_vice_captain && <span className="shrink-0 text-[10px] px-1 py-0.5 bg-blue-500 text-white rounded font-bold">VC</span>}
              </div>
              <span className={`text-sm font-semibold shrink-0 ${pp.final_points > 0 ? 'text-pink-400' : pp.final_points < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {pp.final_points.toFixed(1)}
              </span>
            </div>
            <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
              <span className="text-gray-600">({pp.team_short_name})</span>
              {pp.batting_points > 0 && <span className="text-blue-400/70">B:{pp.batting_points}</span>}
              {pp.bowling_points > 0 && <span className="text-emerald-400/70">W:{pp.bowling_points}</span>}
              {pp.fielding_points > 0 && <span className="text-yellow-400/70">F:{pp.fielding_points}</span>}
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-2 border-t border-gray-800 mt-2">
        <span className="text-lg font-bold text-pink-400">
          Total: {breakdown.total_points.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
