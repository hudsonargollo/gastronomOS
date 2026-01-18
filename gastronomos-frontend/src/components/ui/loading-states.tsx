"use client"

import * as React from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
  text?: string
}

function LoadingSpinner({ size = "md", className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2Icon className={cn("animate-spin", sizeClasses[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  )
}

export interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  text?: string
  className?: string
  overlayClassName?: string
}

function LoadingOverlay({
  isLoading,
  children,
  text = "Loading...",
  className,
  overlayClassName,
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50",
            overlayClassName
          )}
        >
          <LoadingSpinner text={text} />
        </div>
      )}
    </div>
  )
}

export interface ProgressLoaderProps {
  progress: number
  text?: string
  showPercentage?: boolean
  className?: string
}

function ProgressLoader({
  progress,
  text = "Loading...",
  showPercentage = true,
  className,
}: ProgressLoaderProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{text}</span>
        {showPercentage && (
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        )}
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}

export interface SkeletonLoaderProps {
  type: "text" | "card" | "table" | "list" | "form" | "avatar" | "image"
  count?: number
  className?: string
}

function SkeletonLoader({ type, count = 1, className }: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    switch (type) {
      case "text":
        return (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )

      case "card":
        return (
          <div className="border rounded-lg p-4 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        )

      case "table":
        return (
          <div className="border rounded-lg">
            <div className="border-b p-4">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border-b p-4 last:border-b-0">
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )

      case "list":
        return (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )

      case "form":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        )

      case "avatar":
        return <Skeleton className="h-10 w-10 rounded-full" />

      case "image":
        return <Skeleton className="h-48 w-full rounded-lg" />

      default:
        return <Skeleton className="h-4 w-full" />
    }
  }

  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={count > 1 ? "mb-4 last:mb-0" : ""}>
          {renderSkeleton()}
        </div>
      ))}
    </div>
  )
}

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  )
}

export interface ErrorStateProps {
  title?: string
  description?: string
  error?: Error | string
  onRetry?: () => void
  className?: string
}

function ErrorState({
  title = "Something went wrong",
  description = "An error occurred while loading the data.",
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="mb-4 text-red-500">
        <svg
          className="h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        {errorMessage || description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  )
}

export {
  LoadingSpinner,
  LoadingOverlay,
  ProgressLoader,
  SkeletonLoader,
  EmptyState,
  ErrorState,
}