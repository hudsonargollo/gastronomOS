"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ResponsiveGridProps {
  children: React.ReactNode
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
    "2xl"?: number
  }
  gap?: number
  className?: string
}

function ResponsiveGrid({
  children,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 4,
  className,
}: ResponsiveGridProps) {
  const gridClasses = React.useMemo(() => {
    const classes = [`gap-${gap}`]
    
    if (cols.default) classes.push(`grid-cols-${cols.default}`)
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`)
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`)
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`)
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`)
    if (cols["2xl"]) classes.push(`2xl:grid-cols-${cols["2xl"]}`)
    
    return classes.join(" ")
  }, [cols, gap])

  return (
    <div className={cn("grid", gridClasses, className)}>
      {children}
    </div>
  )
}

export interface ResponsiveStackProps {
  children: React.ReactNode
  direction?: {
    default?: "row" | "col"
    sm?: "row" | "col"
    md?: "row" | "col"
    lg?: "row" | "col"
    xl?: "row" | "col"
    "2xl"?: "row" | "col"
  }
  gap?: number
  align?: "start" | "center" | "end" | "stretch"
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly"
  className?: string
}

function ResponsiveStack({
  children,
  direction = { default: "col", md: "row" },
  gap = 4,
  align = "start",
  justify = "start",
  className,
}: ResponsiveStackProps) {
  const stackClasses = React.useMemo(() => {
    const classes = [
      `gap-${gap}`,
      `items-${align}`,
      `justify-${justify}`,
    ]
    
    if (direction.default) classes.push(`flex-${direction.default}`)
    if (direction.sm) classes.push(`sm:flex-${direction.sm}`)
    if (direction.md) classes.push(`md:flex-${direction.md}`)
    if (direction.lg) classes.push(`lg:flex-${direction.lg}`)
    if (direction.xl) classes.push(`xl:flex-${direction.xl}`)
    if (direction["2xl"]) classes.push(`2xl:flex-${direction["2xl"]}`)
    
    return classes.join(" ")
  }, [direction, gap, align, justify])

  return (
    <div className={cn("flex", stackClasses, className)}>
      {children}
    </div>
  )
}

export interface ResponsiveContainerProps {
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
  padding?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
    "2xl"?: number
  }
  className?: string
}

function ResponsiveContainer({
  children,
  maxWidth = "2xl",
  padding = { default: 4, md: 6, lg: 8 },
  className,
}: ResponsiveContainerProps) {
  const containerClasses = React.useMemo(() => {
    const classes = ["mx-auto"]
    
    if (maxWidth !== "full") {
      classes.push(`max-w-${maxWidth}`)
    }
    
    if (padding.default) classes.push(`px-${padding.default}`)
    if (padding.sm) classes.push(`sm:px-${padding.sm}`)
    if (padding.md) classes.push(`md:px-${padding.md}`)
    if (padding.lg) classes.push(`lg:px-${padding.lg}`)
    if (padding.xl) classes.push(`xl:px-${padding.xl}`)
    if (padding["2xl"]) classes.push(`2xl:px-${padding["2xl"]}`)
    
    return classes.join(" ")
  }, [maxWidth, padding])

  return (
    <div className={cn(containerClasses, className)}>
      {children}
    </div>
  )
}

export interface ResponsiveShowHideProps {
  children: React.ReactNode
  show?: {
    default?: boolean
    sm?: boolean
    md?: boolean
    lg?: boolean
    xl?: boolean
    "2xl"?: boolean
  }
  hide?: {
    default?: boolean
    sm?: boolean
    md?: boolean
    lg?: boolean
    xl?: boolean
    "2xl"?: boolean
  }
  className?: string
}

function ResponsiveShowHide({
  children,
  show,
  hide,
  className,
}: ResponsiveShowHideProps) {
  const visibilityClasses = React.useMemo(() => {
    const classes: string[] = []
    
    if (show) {
      if (show.default === false) classes.push("hidden")
      if (show.sm === true) classes.push("sm:block")
      if (show.sm === false) classes.push("sm:hidden")
      if (show.md === true) classes.push("md:block")
      if (show.md === false) classes.push("md:hidden")
      if (show.lg === true) classes.push("lg:block")
      if (show.lg === false) classes.push("lg:hidden")
      if (show.xl === true) classes.push("xl:block")
      if (show.xl === false) classes.push("xl:hidden")
      if (show["2xl"] === true) classes.push("2xl:block")
      if (show["2xl"] === false) classes.push("2xl:hidden")
    }
    
    if (hide) {
      if (hide.default === true) classes.push("hidden")
      if (hide.sm === true) classes.push("sm:hidden")
      if (hide.sm === false) classes.push("sm:block")
      if (hide.md === true) classes.push("md:hidden")
      if (hide.md === false) classes.push("md:block")
      if (hide.lg === true) classes.push("lg:hidden")
      if (hide.lg === false) classes.push("lg:block")
      if (hide.xl === true) classes.push("xl:hidden")
      if (hide.xl === false) classes.push("xl:block")
      if (hide["2xl"] === true) classes.push("2xl:hidden")
      if (hide["2xl"] === false) classes.push("2xl:block")
    }
    
    return classes.join(" ")
  }, [show, hide])

  return (
    <div className={cn(visibilityClasses, className)}>
      {children}
    </div>
  )
}

// Hook for responsive breakpoints
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = React.useState<string>("default")

  React.useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      
      if (width >= 1536) {
        setBreakpoint("2xl")
      } else if (width >= 1280) {
        setBreakpoint("xl")
      } else if (width >= 1024) {
        setBreakpoint("lg")
      } else if (width >= 768) {
        setBreakpoint("md")
      } else if (width >= 640) {
        setBreakpoint("sm")
      } else {
        setBreakpoint("default")
      }
    }

    updateBreakpoint()
    window.addEventListener("resize", updateBreakpoint)
    
    return () => window.removeEventListener("resize", updateBreakpoint)
  }, [])

  return {
    breakpoint,
    isDefault: breakpoint === "default",
    isSm: breakpoint === "sm",
    isMd: breakpoint === "md",
    isLg: breakpoint === "lg",
    isXl: breakpoint === "xl",
    is2Xl: breakpoint === "2xl",
    isMobile: breakpoint === "default" || breakpoint === "sm",
    isTablet: breakpoint === "md",
    isDesktop: breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl",
  }
}

export { ResponsiveGrid, ResponsiveStack, ResponsiveContainer, ResponsiveShowHide }