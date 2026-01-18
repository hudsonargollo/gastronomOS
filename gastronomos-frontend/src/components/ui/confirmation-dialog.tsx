"use client"

import * as React from "react"
import { AlertTriangleIcon, InfoIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConfirmationVariant = "default" | "destructive" | "warning" | "info" | "success"

export interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmationVariant
  loading?: boolean
  children?: React.ReactNode
}

const variantConfig = {
  default: {
    icon: InfoIcon,
    iconClassName: "text-blue-500",
    confirmVariant: "default" as const,
  },
  destructive: {
    icon: AlertTriangleIcon,
    iconClassName: "text-red-500",
    confirmVariant: "destructive" as const,
  },
  warning: {
    icon: AlertTriangleIcon,
    iconClassName: "text-yellow-500",
    confirmVariant: "default" as const,
  },
  info: {
    icon: InfoIcon,
    iconClassName: "text-blue-500",
    confirmVariant: "default" as const,
  },
  success: {
    icon: CheckCircleIcon,
    iconClassName: "text-green-500",
    confirmVariant: "default" as const,
  },
}

function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  children,
}: ConfirmationDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false)
  
  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = async () => {
    if (isConfirming || loading) return

    setIsConfirming(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error("Confirmation action failed:", error)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleClose = () => {
    if (isConfirming || loading) return
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("flex-shrink-0", config.iconClassName)}>
              <Icon className="h-6 w-6" />
            </div>
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
          {description && (
            <DialogDescription className="text-left pl-9">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {children && (
          <div className="pl-9 pr-6 pb-4">
            {children}
          </div>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isConfirming || loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={isConfirming || loading}
          >
            {isConfirming ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easier usage
export function useConfirmationDialog() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [config, setConfig] = React.useState<Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>>({
    onConfirm: () => {},
    title: "",
  })

  const openDialog = React.useCallback((dialogConfig: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => {
    setConfig(dialogConfig)
    setIsOpen(true)
  }, [])

  const closeDialog = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  const ConfirmationDialogComponent = React.useCallback(() => (
    <ConfirmationDialog
      {...config}
      isOpen={isOpen}
      onClose={closeDialog}
    />
  ), [config, isOpen, closeDialog])

  return {
    openDialog,
    closeDialog,
    ConfirmationDialog: ConfirmationDialogComponent,
    isOpen,
  }
}

export { ConfirmationDialog }