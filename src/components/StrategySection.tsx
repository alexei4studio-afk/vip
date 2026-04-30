import { Lightbulb } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { GLASS_CARD } from '../lib/utils';

export default function StrategySection() {
  const { strategies } = useClient();

  return (
    <section className={`${GLASS_CARD} mt-6 p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-apple-gold/10">
          <Lightbulb className="h-4 w-4 text-apple-gold" />
        </div>
        <h2 className="text-base font-semibold text-apple-text">Strategie AI</h2>
      </div>
      {strategies.length > 0 ? (
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
