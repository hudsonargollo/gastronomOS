/**
 * Badge Component
 * Enhanced badge component using the unified design system
 */

import * as React from "react"
import { motion, MotionProps } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { badgeStyles, interactiveAnimations } from "@/lib/interactive-styles"
import { ariaAttributes } from "@/lib/accessibility"

const badgeVariants = badgeStyles

interface BadgeProps
  extends Omit<React.ComponentProps<"div">, 'onDrag'>,
    VariantProps<typeof badgeVariants> {
  animated?: boolean
  interactive?: boolean
  dismissible?: boolean
  onDismiss?: () => void
  icon?: React.ReactNode
  count?: number
}

function Badge({
  className,
  variant = "default",
  size = "default",
  animated = true,
  interactive = false,
  dismissible = false,
  onDismiss,
  icon,
  count,
  children,
  ...props
}: BadgeProps) {
  const [isVisible, setIsVisible] = React.useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => {
      onDismiss?.()
    }, 150) // Wait for exit animation
  }

  const motionProps: MotionProps = animated ? {
    variants: interactiveAnimations.badge,
    initial: "initial",
    animate: isVisible ? "initial" : { scale: 0, opacity: 0 },
    whileHover: interactive ? "hover" : undefined,
    whileTap: interactive ? "tap" : undefined,
    exit: { scale: 0, opacity: 0 },
    transition: { duration: 0.15 },
  } : {}

  const Component = animated ? motion.div : "div"

  if (!isVisible && dismissible) {
    return null
  }

  return (
    <Component
      className={cn(badgeVariants({ variant, size }), className)}
      {...motionProps}
      {...props}
    >
      {icon && (
        <span className="mr-1 flex-shrink-0">
          {icon}
        </span>
      )}
      
      <span className="truncate">
        {children}
      </span>
      
      {count !== undefined && (
        <span 
          className="ml-1 flex-shrink-0 text-xs"
          {...ariaAttributes.label(`Count: ${count}`)}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
      
      {dismissible && (
        <button
          type="button"
          className="ml-1 flex-shrink-0 rounded-full p-0.5 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          onClick={handleDismiss}
          {...ariaAttributes.label('Dismiss badge')}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </Component>
  )
}

// Status Badge Component
interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'success' | 'warning' | 'error' | 'info' | 'pending' | 'inactive'
}

function StatusBadge({ status, ...props }: StatusBadgeProps) {
  const statusConfig = {
    success: { variant: 'success' as const, icon: '✓' },
    warning: { variant: 'warning' as const, icon: '⚠' },
    error: { variant: 'destructive' as const, icon: '✕' },
    info: { variant: 'info' as const, icon: 'ℹ' },
    pending: { variant: 'secondary' as const, icon: '⏳' },
    inactive: { variant: 'outline' as const, icon: '○' },
  }

  const config = statusConfig[status]

  return (
    <Badge
      variant={config.variant}
      icon={<span className="text-xs">{config.icon}</span>}
      {...props}
    />
  )
}

// Notification Badge Component
interface NotificationBadgeProps extends Omit<BadgeProps, 'variant' | 'size'> {
  count: number
  max?: number
  showZero?: boolean
}

function NotificationBadge({ 
  count, 
  max = 99, 
  showZero = false, 
  className,
  ...props 
}: NotificationBadgeProps) {
  if (count === 0 && !showZero) {
    return null
  }

  const displayCount = count > max ? `${max}+` : count.toString()

  return (
    <Badge
      variant="destructive"
      size="sm"
      className={cn(
        "absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs font-bold",
        count === 0 && "opacity-50",
        className
      )}
      {...ariaAttributes.label(`${count} notifications`)}
      {...props}
    >
      {displayCount}
    </Badge>
  )
}

// Priority Badge Component
interface PriorityBadgeProps extends Omit<BadgeProps, 'variant'> {
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

function PriorityBadge({ priority, ...props }: PriorityBadgeProps) {
  const priorityConfig = {
    low: { variant: 'secondary' as const, text: 'Low' },
    medium: { variant: 'info' as const, text: 'Medium' },
    high: { variant: 'warning' as const, text: 'High' },
    urgent: { variant: 'destructive' as const, text: 'Urgent' },
  }

  const config = priorityConfig[priority]

  return (
    <Badge
      variant={config.variant}
      {...props}
    >
      {config.text}
    </Badge>
  )
}

export { Badge, StatusBadge, NotificationBadge, PriorityBadge, badgeVariants }