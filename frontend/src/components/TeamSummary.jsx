export default function TeamSummary({ breakdown }) {
  if (!breakdown) return null

  const sorted = [...breakdown.player_points].sort((a, b) => b.final_points - a.final_points)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_60px_60px_60px_60px_70px] gap-2 text-xs text-gray-500 font-medium px-3">
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
          className={`grid grid-cols-[1fr_60px_60px_60px_60px_70px] gap-2 items-center text-sm px-3 py-2 rounded-lg ${
            pp.is_captain ? 'bg-yellow-900/20 border border-yellow-900/50' :
            pp.is_vice_captain ? 'bg-blue-900/20 border border-blue-900/50' :
            'bg-gray-800/50'
          }`}
        >
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
          <span className={`text-right font-semibold ${pp.final_points > 0 ? 'text-green-400' : pp.final_points < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {pp.final_points.toFixed(1)}
          </span>
        </div>
      ))}
      <div className="flex justify-end pt-2 border-t border-gray-800 mt-2">
        <span className="text-lg font-bold text-green-400">
          Total: {breakdown.total_points.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
