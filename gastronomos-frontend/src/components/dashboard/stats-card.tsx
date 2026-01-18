'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  className?: string;
}

const colorVariants = {
  blue: {
    gradient: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  green: {
    gradient: 'from-green-500 to-emerald-500',
    bg: 'bg-green-50',
    text: 'text-green-600',
    badge: 'bg-green-100 text-green-700',
  },
  orange: {
    gradient: 'from-orange-500 to-red-500',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-700',
  },
  red: {
    gradient: 'from-red-500 to-pink-500',
    bg: 'bg-red-50',
    text: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
  purple: {
    gradient: 'from-purple-500 to-indigo-500',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-700',
  },
};

export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  color = 'blue',
  className,
}: StatsCardProps) {
  const colors = colorVariants[color];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn('relative overflow-hidden border-0 shadow-lg', className)}>
        <CardContent className="p-6">
          {/* Background gradient */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-5',
            colors.gradient
          )} />
          
          {/* Icon */}
          <div className="flex items-center justify-between mb-4">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl shadow-lg',
              `bg-gradient-to-br ${colors.gradient}`
            )}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            
            {change && (
              <Badge
                variant="secondary"
                className={cn(
                  'font-medium',
                  change.type === 'increase' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}
              >
                {change.type === 'increase' ? '+' : '-'}{Math.abs(change.value)}%
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-600">{title}</h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold text-slate-900">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </span>
            </div>
            {change && (
              <p className="text-xs text-slate-500">
                {change.type === 'increase' ? '↗' : '↘'} {change.period}
              </p>
            )}
          </div>

          {/* Decorative elements */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-tl from-white/10 to-transparent" />
        </CardContent>
      </Card>
    </motion.div>
  );
}