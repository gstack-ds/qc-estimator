'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';

export interface EstimateCard {
  id: string;
  name: string;
  total: number;
  pricePerPerson: number;
  lineItemCount: number;
  includeInBudget: boolean;
  qcMarginPct: number;
}

interface Props {
  programId: string;
  cards: EstimateCard[];
}

function fmt(val: number) {
  return '$' + Math.round(val).toLocaleString('en-US');
}

export default function ComparisonView({ programId, cards: initialCards }: Props) {
  const [cards, setCards] = useState(initialCards);

  const withTotal = cards.filter((c) => c.total > 0);
  const lowestTotal = withTotal.length > 0 ? Math.min(...withTotal.map((c) => c.total)) : null;
  const bestMarginPct = withTotal.length > 0 ? Math.max(...withTotal.map((c) => c.qcMarginPct)) : null;

  const budgetTotal = cards
    .filter((c) => c.includeInBudget)
    .reduce((sum, c) => sum + c.total, 0);
  const budgetCount = cards.filter((c) => c.includeInBudget).length;

  async function handleToggle(id: string, next: boolean) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, includeInBudget: next } : c)));
    await updateEstimate(id, programId, { include_in_budget: next });
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-brand-cream rounded-lg">
        <p className="text-sm text-brand-silver">No estimates yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total Budget banner */}
      {budgetCount > 0 && (
        <div className="bg-brand-cream border border-brand-copper/40 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-brand-charcoal">Total Budget</span>
            <span className="text-xs text-brand-brown ml-2">
              {budgetCount} venue{budgetCount !== 1 ? 's' : ''} included
            </span>
          </div>
          <span className="font-serif text-lg font-medium text-brand-charcoal">{fmt(budgetTotal)}</span>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const isLowest = lowestTotal !== null && card.total === lowestTotal && card.total > 0;
          const isBestMargin = bestMarginPct !== null && card.qcMarginPct === bestMarginPct && card.total > 0;

          return (
            <Link
              key={card.id}
              href={`/programs/${programId}/estimates/${card.id}`}
              className="relative block bg-white rounded-lg border border-brand-cream p-5 flex flex-col gap-3 transition-all hover:shadow-md hover:border-brand-copper/50 cursor-pointer overflow-hidden"
            >
              {/* Left accent bar */}
              {isLowest && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
              )}
              {!isLowest && isBestMargin && (
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#C19C81' }} />
              )}
              {isLowest && isBestMargin && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500">
                  <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ backgroundColor: '#C19C81' }} />
                </div>
              )}

              {/* Header: name + badges */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-brand-charcoal text-sm leading-snug">
                  {card.name}
                </span>
                {(isLowest || isBestMargin) && (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isLowest && (
                      <span className="text-xs bg-green-100 text-green-800 font-medium px-1.5 py-0.5 rounded">
                        Lowest
                      </span>
                    )}
                    {isBestMargin && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#C19C81', color: 'white' }}>
                        Best Margin
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="flex items-end gap-4">
                <div>
                  <p className="font-serif text-xl font-medium text-brand-charcoal">{fmt(card.total)}</p>
                  <p className="text-xs text-brand-silver mt-0.5">total estimate</p>
                </div>
                {card.pricePerPerson > 0 && (
                  <div>
                    <p className="text-base font-medium text-brand-brown">
                      ${card.pricePerPerson.toLocaleString('en-US')}
                      <span className="text-xs font-normal text-brand-silver">/pp</span>
                    </p>
                    <p className="text-xs text-brand-silver mt-0.5">per person</p>
                  </div>
                )}
              </div>

              {/* Line item count + QC Margin */}
              <div className="space-y-0.5">
                <p className="text-xs text-brand-silver">
                  {card.lineItemCount} line item{card.lineItemCount !== 1 ? 's' : ''}
                </p>
                {card.total > 0 && (
                  <p className="text-xs text-brand-silver/70">
                    QC Margin: {(card.qcMarginPct * 100).toFixed(1)}%
                  </p>
                )}
              </div>

              {/* Include in Budget toggle */}
              <div className="border-t border-brand-cream pt-3 mt-auto">
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={(e) => e.preventDefault()}
                >
                  <div
                    onClick={(e) => { e.preventDefault(); handleToggle(card.id, !card.includeInBudget); }}
                    className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                      card.includeInBudget ? 'bg-brand-brown' : 'bg-brand-silver/40'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${
                        card.includeInBudget ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-brand-charcoal/70">Include in Total Budget</span>
                </label>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
