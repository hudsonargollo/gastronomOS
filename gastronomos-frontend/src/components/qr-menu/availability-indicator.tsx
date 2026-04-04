'use client';

/**
 * Availability Indicator Component
 * Displays real-time availability status and preparation time
 * Part of QR Menu Interface - Digital Menu System
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface AvailabilityIndicatorProps {
  isAvailable: boolean;
  preparationTime: number;
  reason?: 'OUT_OF_STOCK' | 'MANUAL_OVERRIDE' | 'PREPARATION_CAPACITY' | 'RESTORED';
  estimatedAvailableAt?: number;
  isRealTimeConnected?: boolean;
  className?: string;
}

/**
 * Availability Indicator
 * Shows availability status with real-time updates
 */
export function AvailabilityIndicator({
  isAvailable,
  preparationTime,
  reason,
  estimatedAvailableAt,
  isRealTimeConnected = false,
  className
}: AvailabilityIndicatorProps) {
  const getReasonText = () => {
    switch (reason) {
      case 'OUT_OF_STOCK':
        return 'Ingredientes esgotados';
      case 'MANUAL_OVERRIDE':
        return 'Temporariamente indisponível';
      case 'PREPARATION_CAPACITY':
        return 'Cozinha em capacidade máxima';
      case 'RESTORED':
        return 'Disponível novamente';
      default:
        return 'Indisponível';
    }
  };

  const formatEstimatedTime = () => {
    if (!estimatedAvailableAt) return null;
    
    const now = Date.now();
    const diff = estimatedAvailableAt - now;
    
    if (diff <= 0) return 'Em breve';
    
    const minutes = Math.ceil(diff / 60000);
    if (minutes < 60) {
      return `Disponível em ${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    return `Disponível em ${hours}h`;
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Availability Status */}
      <div className="flex items-center gap-2">
        {isAvailable ? (
          <>
            <Badge variant="default" className="bg-green-500">
              Disponível
            </Badge>
            {isRealTimeConnected && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-[var(--token-text-tertiary)]">
                  Ao vivo
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <Badge variant="destructive">
              Indisponível
            </Badge>
            {reason && (
              <span className="text-xs text-[var(--token-text-tertiary)]">
                {getReasonText()}
              </span>
            )}
          </>
        )}
      </div>

      {/* Preparation Time or Estimated Availability */}
      {isAvailable ? (
        <div className="flex items-center gap-2 text-sm text-[var(--token-text-secondary)]">
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Preparo: {preparationTime} min</span>
        </div>
      ) : (
        estimatedAvailableAt && (
          <div className="flex items-center gap-2 text-sm text-[var(--token-text-secondary)]">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{formatEstimatedTime()}</span>
          </div>
        )
      )}
    </div>
  );
}
