'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  percentage?: number;
}

export interface AnimatedBarChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  showValues?: boolean;
  showTrends?: boolean;
  className?: string;
}

export function AnimatedBarChart({
  data,
  title,
  height = 200,
  showValues = true,
  showTrends = false,
  className,
}: AnimatedBarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
          style={{ height }}
        >
          {data.map((item, index) => (
            <motion.div
              key={item.label}
              variants={listItemVariants}
              className="flex items-center space-x-3"
            >
              <div className="w-20 text-sm font-medium text-slate-600 truncate">
                {item.label}
              </div>
              <div className="flex-1 relative">
                <motion.div
                  className={cn(
                    "h-6 rounded-full",
                    item.color || "bg-blue-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.value / maxValue) * 100}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                />
                {showValues && (
                  <motion.span
                    className="absolute right-2 top-0 h-6 flex items-center text-xs font-medium text-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    {item.value}
                  </motion.span>
                )}
              </div>
              {showTrends && item.trend && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <Badge
                    variant={item.trend === 'up' ? 'default' : item.trend === 'down' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'}
                    {item.percentage && ` ${item.percentage}%`}
                  </Badge>
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
}

export interface AnimatedLineChartProps {
  data: Array<{ x: string; y: number }>;
  title?: string;
  height?: number;
  color?: string;
  showDots?: boolean;
  className?: string;
}

export function AnimatedLineChart({
  data,
  title,
  height = 200,
  color = 'stroke-blue-500',
  showDots = true,
  className,
}: AnimatedLineChartProps) {
  const maxValue = Math.max(...data.map(d => d.y));
  const minValue = Math.min(...data.map(d => d.y));
  const range = maxValue - minValue || 1;
  
  const points = data.map((point, index) => ({
    x: (index / (data.length - 1)) * 100,
    y: ((maxValue - point.y) / range) * 80 + 10, // 10% padding top/bottom
  }));
  
  const pathData = points.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path} ${command} ${point.x} ${point.y}`;
  }, '');
  
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="relative" style={{ height }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="overflow-visible"
          >
            <motion.path
              d={pathData}
              fill="none"
              className={cn("stroke-2", color)}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
            {showDots && (
              <AnimatePresence>
                {points.map((point, index) => (
                  <motion.circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="2"
                    className={cn("fill-current", color.replace('stroke-', 'text-'))}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1 + index * 0.1 }}
                  />
                ))}
              </AnimatePresence>
            )}
          </svg>
          
          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-500 mt-2">
            {data.map((point, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 + index * 0.05 }}
              >
                {point.x}
              </motion.span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface AnimatedPieChartProps {
  data: ChartDataPoint[];
  title?: string;
  size?: number;
  showLegend?: boolean;
  className?: string;
}

export function AnimatedPieChart({
  data,
  title,
  size = 200,
  showLegend = true,
  className,
}: AnimatedPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercentage = 0;
  
  const segments = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const startAngle = (cumulativePercentage / 100) * 360;
    const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
    
    cumulativePercentage += percentage;
    
    return {
      ...item,
      percentage,
      startAngle,
      endAngle,
    };
  });
  
  const radius = size / 2 - 10;
  const center = size / 2;
  
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center space-x-6">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
              {segments.map((segment, index) => {
                const startAngleRad = (segment.startAngle - 90) * (Math.PI / 180);
                const endAngleRad = (segment.endAngle - 90) * (Math.PI / 180);
                
                const x1 = center + radius * Math.cos(startAngleRad);
                const y1 = center + radius * Math.sin(startAngleRad);
                const x2 = center + radius * Math.cos(endAngleRad);
                const y2 = center + radius * Math.sin(endAngleRad);
                
                const largeArcFlag = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
                
                const pathData = [
                  `M ${center} ${center}`,
                  `L ${x1} ${y1}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ');
                
                return (
                  <motion.path
                    key={segment.label}
                    d={pathData}
                    className={cn(
                      "stroke-white stroke-2",
                      segment.color || `fill-blue-${500 - index * 100}`
                    )}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  />
                );
              })}
            </svg>
          </div>
          
          {showLegend && (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-2"
            >
              {segments.map((segment, index) => (
                <motion.div
                  key={segment.label}
                  variants={listItemVariants}
                  className="flex items-center space-x-2"
                >
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full",
                      segment.color || `bg-blue-${500 - index * 100}`
                    )}
                  />
                  <span className="text-sm font-medium">{segment.label}</span>
                  <span className="text-sm text-slate-500">
                    {segment.percentage.toFixed(1)}%
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    period: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  color?: string;
  className?: string;
}

export function AnimatedMetricCard({
  title,
  value,
  change,
  icon,
  color = 'bg-blue-500',
  className,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">{title}</p>
              <motion.p
                className="text-2xl font-bold text-slate-900"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                {value}
              </motion.p>
              {change && (
                <motion.div
                  className="flex items-center mt-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <Badge
                    variant={change.trend === 'up' ? 'default' : change.trend === 'down' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {change.trend === 'up' ? '↗' : change.trend === 'down' ? '↘' : '→'}
                    {change.value > 0 ? '+' : ''}{change.value}%
                  </Badge>
                  <span className="text-xs text-slate-500 ml-2">
                    vs {change.period}
                  </span>
                </motion.div>
              )}
            </div>
            {icon && (
              <motion.div
                className={cn("p-3 rounded-full", color)}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <div className="text-white">{icon}</div>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}