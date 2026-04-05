export default function PointsSystem() {
  const batting = [
    ['Run', '+1'],
    ['Boundary Bonus (4)', '+4'],
    ['Six Bonus', '+6'],
    ['25 Run Bonus', '+4'],
    ['50 Run Bonus', '+8'],
    ['75 Run Bonus', '+12'],
    ['100 Run Bonus', '+16'],
    ['Dismissal for Duck (BAT/WK/AR)', '-2'],
  ]

  const strikeRate = [
    ['Above 170', '+6'],
    ['150 - 170', '+4'],
    ['130 - 149.99', '+2'],
    ['60 - 69.99', '-2'],
    ['50 - 59.99', '-4'],
    ['Below 50', '-6'],
  ]

  const bowling = [
    ['Wicket (excluding run out)', '+30'],
    ['3 Wicket Bonus', '+4'],
    ['4 Wicket Bonus', '+8'],
    ['5 Wicket Bonus', '+12'],
    ['Maiden Over', '+12'],
  ]

  const economy = [
    ['Below 5 runs/over', '+6'],
    ['5 - 5.99 runs/over', '+4'],
    ['6 - 7 runs/over', '+2'],
    ['10 - 11 runs/over', '-2'],
    ['11.01 - 12 runs/over', '-4'],
    ['Above 12 runs/over', '-6'],
  ]

  const fielding = [
    ['Catch', '+8'],
    ['3 Catch Bonus', '+4'],
    ['Stumping', '+12'],
    ['Run Out', '+12'],
  ]

  const additional = [
    ['Captain Points', '2x'],
    ['Vice-Captain Points', '1.5x'],
    ['In Announced Lineups / Playing Substitute', '+4'],
  ]

  const section = (title, rows, subtitle = '') => (
    <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[1fr_80px] gap-3 px-5 py-3 border-b border-gray-800/50 items-center">
          <span className="text-sm text-gray-300">{k}</span>
          <span className={`text-right font-semibold ${String(v).startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>{v}</span>
        </div>
      ))}
    </section>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Points System</h1>
        <p className="text-sm text-gray-400 mt-1">Fantasy scoring rules used in this app.</p>
      </div>

      {section('Batting', batting)}
      {section('Strike Rate', strikeRate, 'Min 10 balls faced; except pure bowlers')}
      {section('Bowling', bowling)}
      {section('Economy Rate', economy, 'Min 2 overs bowled')}
      {section('Fielding', fielding)}
      {section('Additional', additional)}
    </div>
  )
}
