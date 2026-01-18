"use client"

import * as React from "react"
import { Toaster } from "sonner"
import { useTheme } from "next-themes"

export interface ToastProviderProps {
  children: React.ReactNode
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
  expand?: boolean
  richColors?: boolean
  closeButton?: boolean
  duration?: number
  visibleToasts?: number
}

function ToastProvider({
  children,
  position = "bottom-right",
  expand = false,
  richColors = true,
  closeButton = true,
  duration = 4000,
  visibleToasts = 5,
}: ToastProviderProps) {
  const { theme } = useTheme()

  return (
    <>
      {children}
      <Toaster
        position={position}
        expand={expand}
        richColors={richColors}
        closeButton={closeButton}
        duration={duration}
        visibleToasts={visibleToasts}
        theme={theme as "light" | "dark" | "system"}
        toastOptions={{
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
          className: 'toast',
          descriptionClassName: 'toast-description',
          actionButtonStyle: {
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
          },
          cancelButtonStyle: {
            background: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
          },
        }}
      />
    </>
  )
}

export { ToastProvider }