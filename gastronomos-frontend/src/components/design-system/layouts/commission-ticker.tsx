'use client';

/**
 * Live Commission Ticker Component
 * Real-time earnings display
 * Adaptive Gastronomy Design System
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface CommissionTickerProps {
  currentCommission: number;
  targetCommission?: number;
  currency?: string;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showProgress?: boolean;
  recentEarnings?: CommissionEntry[];
  animateChanges?: boolean;
}

export interface CommissionEntry {
  id: string;
  amount: number;
  timestamp: Date;
  orderNumber?: string;
}

/**
 * Commission Ticker
 * Displays live commission earnings with optional progress tracking
 */
export function CommissionTicker({ 
  currentCommission,
  targetCommission,
  currency = 'R$',
  className,
  variant = 'default',
  showProgress = false,
  recentEarnings = [],
  animateChanges = true
}: CommissionTickerProps) {
  const [displayAmount, setDisplayAmount] = useState(currentCommission);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate commission changes
  useEffect(() => {
    if (!animateChanges) {
      setDisplayAmount(currentCommission);
      return;
    }

    if (displayAmount !== currentCommission) {
      setIsAnimating(true);
      const duration = 500;
      const steps = 20;
      const increment = (currentCommission - displayAmount) / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setDisplayAmount(currentCommission);
          setIsAnimating(false);
          clearInterval(interval);
        } else {
          setDisplayAmount(prev => prev + increment);
        }
      }, duration / steps);

      return () => clearInterval(interval);
    }
  }, [currentCommission, displayAmount, animateChanges]);

  const progress = targetCommission 
    ? Math.min((currentCommission / targetCommission) * 100, 100)
    : 0;

  const variantClasses = {
    default: 'p-4',
    compact: 'p-2',
    detailed: 'p-6',
  };

  return (
    <div
      className={cn(
        'bg-gradient-to-r from-[var(--token-action-primary)] to-[var(--token-action-secondary)]',
        'text-white',
        'rounded-lg shadow-lg',
        'overflow-hidden',
        variantClasses[variant],
        className
      )}
    >
      {/* Main commission display */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className={cn(
            'font-mono font-bold',
            variant === 'compact' ? 'text-xl' : 'text-3xl',
            variant === 'detailed' && 'text-4xl',
            isAnimating && 'animate-pulse'
          )}>
            {currency} {displayAmount.toFixed(2)}
          </div>
          <div className="text-xs opacity-80 mt-1">
            Comissão Atual
          </div>
        </div>

        {targetCommission && (
          <div className="text-right">
            <div className="text-sm font-semibold">
              Meta: {currency} {targetCommission.toFixed(2)}
            </div>
            <div className="text-xs opacity-80">
              {progress.toFixed(0)}% alcançado
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && targetCommission && (
        <div className="mt-3">
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent earnings */}
      {variant === 'detailed' && recentEarnings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="text-xs font-semibold mb-2 opacity-80">
            Últimas Comissões
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {recentEarnings.slice(0, 5).map((entry) => (
              <RecentEarningItem
                key={entry.id}
                entry={entry}
                currency={currency}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Recent Earning Item
 * Individual recent commission entry
 */
function RecentEarningItem({ 
  entry, 
  currency 
}: { 
  entry: CommissionEntry; 
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs bg-white/10 rounded px-2 py-1">
      <div className="flex items-center gap-2">
        <span className="opacity-60">
          {entry.timestamp.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
        {entry.orderNumber && (
          <span className="opacity-80">
            #{entry.orderNumber}
          </span>
        )}
      </div>
      <span className="font-mono font-semibold">
        +{currency} {entry.amount.toFixed(2)}
      </span>
    </div>
  );
}

/**
 * Commission Ticker Compact
 * Simplified version for headers/toolbars
 */
export function CommissionTickerCompact({ 
  currentCommission,
  currency = 'R$',
  className
}: {
  currentCommission: number;
  currency?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2',
        'bg-[var(--token-action-primary)]',
        'text-white',
        'px-3 py-1.5 rounded-full',
        'shadow-md',
        className
      )}
    >
      <svg 
        className="w-4 h-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
      <span className="font-mono font-bold text-sm">
        {currency} {currentCommission.toFixed(2)}
      </span>
    </div>
  );
}
