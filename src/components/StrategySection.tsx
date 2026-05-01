import { Lightbulb, Zap, TrendingUp, Star } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { GLASS_CARD } from '../lib/utils';

const STRATEGY_GROUPS = [
  { key: 'imediate' as const, label: 'Acțiuni Imediate', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { key: 'termen_mediu' as const, label: 'Termen Mediu (2-4 săpt.)', icon: TrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { key: 'diferentiere' as const, label: 'Diferențiere', icon: Star, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
] as const;

export default function StrategySection() {
  const { strategies, groupedStrategies } = useClient();

  const hasGrouped = groupedStrategies && (
    groupedStrategies.imediate.length > 0 ||
    groupedStrategies.termen_mediu.length > 0 ||
    groupedStrategies.diferentiere.length > 0
  );

  return (
    <section className={`${GLASS_CARD} mt-6 p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-apple-gold/10">
          <Lightbulb className="h-4 w-4 text-apple-gold" />
        </div>
        <h2 className="text-base font-semibold text-apple-text">Strategie AI</h2>
      </div>

      {hasGrouped ? (
        <div className="space-y-4">
          {STRATEGY_GROUPS.map(({ key, label, icon: Icon, color, bg, border }) => {
            const items = groupedStrategies[key];
            if (!items.length) return null;
            return (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md ${bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <h3 className={`text-sm font-semibold ${color}`}>{label}</h3>
                </div>
                <ul className="space-y-2">
                  {items.map((strategy, index) => (
                    <li
                      key={`${key}-${index}`}
                      className={`rounded-xl border ${border} bg-apple-bg/50 px-4 py-3 text-sm leading-relaxed text-apple-text/80`}
                    >
                      {strategy}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : strategies.length > 0 ? (
        <ul className="space-y-2.5">
          {strategies.map((strategy, index) => (
            <li
              key={`${strategy.slice(0, 20)}-${index}`}
              className="rounded-xl border border-apple-border/30 bg-apple-bg/50 px-4 py-3 text-sm leading-relaxed text-apple-text/80"
            >
              {strategy}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-apple-muted">
          Momentan nu există recomandări strategice pentru acest client.
        </p>
      )}
    </section>
  );
}
