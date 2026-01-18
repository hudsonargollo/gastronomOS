"use client"

import * as React from "react"
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  MoreHorizontalIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  InfoIcon,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down' | 'neutral'
  }
  icon?: React.ReactNode
  loading?: boolean
  className?: string
  onClick?: () => void
}

function StatCard({
  title,
  value,
  description,
  trend,
  icon,
  loading = false,
  className,
  onClick,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    )
  }

  const getTrendIcon = () => {
    if (!trend) return null
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUpIcon className="h-3 w-3 text-green-600" />
      case 'down':
        return <TrendingDownIcon className="h-3 w-3 text-red-600" />
      default:
        return null
    }
  }

  const getTrendColor = () => {
    if (!trend) return 'text-muted-foreground'
    
    switch (trend.direction) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        onClick && "hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center space-x-2 text-xs">
          {trend && (
            <div className={cn("flex items-center space-x-1", getTrendColor())}>
              {getTrendIcon()}
              <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
            </div>
          )}
          {(description || trend?.label) && (
            <p className="text-muted-foreground">
              {trend?.label || description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export interface ProgressCardProps {
  title: string
  description?: string
  progress: number
  target?: number
  current?: number
  unit?: string
  color?: 'default' | 'success' | 'warning' | 'danger'
  loading?: boolean
  className?: string
}

function ProgressCard({
  title,
  description,
  progress,
  target,
  current,
  unit = '',
  color = 'default',
  loading = false,
  className,
}: ProgressCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const getProgressColor = () => {
    switch (color) {
      case 'success':
        return 'bg-green-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'danger':
        return 'bg-red-500'
      default:
        return 'bg-primary'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress 
          value={progress} 
          className="h-2"
          // Apply custom color via CSS variable
          style={{ 
            '--progress-background': getProgressColor() 
          } as React.CSSProperties}
        />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {current !== undefined ? `${current}${unit}` : `${progress}%`}
          </span>
          <span className="text-muted-foreground">
            {target !== undefined ? `${target}${unit}` : '100%'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export interface ListCardProps {
  title: string
  description?: string
  items: Array<{
    id: string
    label: string
    value: string | number
    subtitle?: string
    badge?: {
      text: string
      variant?: 'default' | 'secondary' | 'destructive' | 'outline'
    }
    icon?: React.ReactNode
  }>
  loading?: boolean
  className?: string
  onItemClick?: (id: string) => void
  showMore?: {
    label: string
    onClick: () => void
  }
}

function ListCard({
  title,
  description,
  items,
  loading = false,
  className,
  onItemClick,
  showMore,
}: ListCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          {description && <Skeleton className="h-4 w-48" />}
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center space-x-3 p-2 rounded-lg transition-colors",
                onItemClick && "cursor-pointer hover:bg-accent"
              )}
              onClick={() => onItemClick?.(item.id)}
            >
              {item.icon && (
                <div className="text-muted-foreground">{item.icon}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {item.badge && (
                    <Badge variant={item.badge.variant || 'default'} className="text-xs">
                      {item.badge.text}
                    </Badge>
                  )}
                </div>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div className="text-sm font-medium">{item.value}</div>
            </div>
          ))}
          
          {items.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <InfoIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No items to display</p>
            </div>
          )}
          
          {showMore && items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={showMore.onClick}
            >
              {showMore.label}
              <ExternalLinkIcon className="ml-2 h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export interface WidgetContainerProps {
  title?: string
  description?: string
  children: React.ReactNode
  loading?: boolean
  error?: string | Error
  onRefresh?: () => void
  onSettings?: () => void
  className?: string
  actions?: Array<{
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }>
}

function WidgetContainer({
  title,
  description,
  children,
  loading = false,
  error,
  onRefresh,
  onSettings,
  className,
  actions = [],
}: WidgetContainerProps) {
  const hasActions = onRefresh || onSettings || actions.length > 0

  if (error) {
    const errorMessage = error instanceof Error ? error.message : error
    
    return (
      <Card className={cn("border-red-200", className)}>
        <CardHeader>
          {title && <CardTitle className="text-base text-red-600">{title}</CardTitle>}
          <CardDescription className="text-red-500">
            Error: {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCwIcon className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {(title || hasActions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          
          {hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onRefresh && (
                  <DropdownMenuItem onClick={onRefresh}>
                    <RefreshCwIcon className="mr-2 h-4 w-4" />
                    Refresh
                  </DropdownMenuItem>
                )}
                {actions.map((action, index) => (
                  <DropdownMenuItem key={index} onClick={action.onClick}>
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {(onRefresh || actions.length > 0) && onSettings && (
                  <DropdownMenuSeparator />
                )}
                {onSettings && (
                  <DropdownMenuItem onClick={onSettings}>
                    Settings
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
      )}
      
      <CardContent className={title || hasActions ? "pt-0" : ""}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export { StatCard, ProgressCard, ListCard, WidgetContainer }