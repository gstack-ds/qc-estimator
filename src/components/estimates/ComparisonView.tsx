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

  const budgetTotal = cards
    .filter((c) => c.includeInBudget)
    .reduce((sum, c) => sum + c.total, 0);
  const budgetCount = cards.filter((c) => c.includeInBudget).length;

  async function handleToggle(id: string, next: boolean) {
    // Optimistic update
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, includeInBudget: next } : c)));
    await updateEstimate(id, programId, { include_in_budget: next });
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed border-gray-200 rounded-lg">
        <p className="text-sm text-gray-400">No estimates yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total Budget banner */}
      {budgetCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-blue-900">Total Budget</span>
            <span className="text-xs text-blue-600 ml-2">
              {budgetCount} venue{budgetCount !== 1 ? 's' : ''} included
            </span>
          </div>
          <span className="text-lg font-semibold text-blue-900">{fmt(budgetTotal)}</span>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const isLowest = lowestTotal !== null && card.total === lowestTotal && card.total > 0;

          return (
            <Link
              key={card.id}
              href={`/programs/${programId}/estimates/${card.id}`}
              className={`block bg-white rounded-lg border p-4 flex flex-col gap-3 transition-shadow hover:shadow-md cursor-pointer ${
                isLowest ? 'border-green-400 ring-1 ring-green-300' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-gray-900 text-sm leading-snug">
                  {card.name}
                </span>
                {isLowest && (
                  <span className="flex-shrink-0 text-xs bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded">
                    Lowest
                  </span>
                )}
              </div>

              {/* Totals */}
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-xl font-semibold text-gray-900">{fmt(card.total)}</p>
                  <p className="text-xs text-gray-400">total estimate</p>
                </div>
                {card.pricePerPerson > 0 && (
                  <div>
                    <p className="text-base font-medium text-gray-700">
                      ${card.pricePerPerson.toLocaleString('en-US')}
                      <span className="text-xs font-normal text-gray-400">/pp</span>
                    </p>
                    <p className="text-xs text-gray-400">per person</p>
                  </div>
                )}
              </div>

              {/* Line item count */}
              <p className="text-xs text-gray-400">
                {card.lineItemCount} line item{card.lineItemCount !== 1 ? 's' : ''}
              </p>

              {/* Include in Budget toggle */}
              <div className="border-t border-gray-100 pt-3 mt-auto">
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={(e) => e.preventDefault()}
                >
                  <div
                    onClick={(e) => { e.preventDefault(); handleToggle(card.id, !card.includeInBudget); }}
                    className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                      card.includeInBudget ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${
                        card.includeInBudget ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-gray-600">Include in Total Budget</span>
                </label>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
