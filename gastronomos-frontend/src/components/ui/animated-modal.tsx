/**
 * AnimatedModal Component
 * Modal dialog with smooth scaling and opacity transitions using Framer Motion
 */

'use client';

import React from 'react';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { modalVariants, transitions } from '@/lib/animation-utils';

const AnimatedModal = DialogPrimitive.Root;
const AnimatedModalTrigger = DialogPrimitive.Trigger;
const AnimatedModalClose = DialogPrimitive.Close;

interface AnimatedModalContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
}

const AnimatedModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    asChild
    {...props}
  >
    <motion.div
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transitions.fast}
    />
  </DialogPrimitive.Overlay>
));
AnimatedModalOverlay.displayName = 'AnimatedModalOverlay';

const AnimatedModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AnimatedModalContentProps
>(({ 
  className, 
  children, 
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  ...props 
}, ref) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[95vw] max-h-[95vh]',
  };

  return (
    <DialogPrimitive.Portal>
      <AnimatePresence>
        <AnimatedModalOverlay />
        <DialogPrimitive.Content
          ref={ref}
          asChild
          onPointerDownOutside={closeOnOverlayClick ? undefined : (e) => e.preventDefault()}
          {...props}
        >
          <motion.div
            className={cn(
              'fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
              sizeClasses[size],
              className
            )}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.spring}
          >
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </motion.div>
        </DialogPrimitive.Content>
      </AnimatePresence>
    </DialogPrimitive.Portal>
  );
});
AnimatedModalContent.displayName = 'AnimatedModalContent';

const AnimatedModalHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
AnimatedModalHeader.displayName = 'AnimatedModalHeader';

const AnimatedModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
AnimatedModalFooter.displayName = 'AnimatedModalFooter';

const AnimatedModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
AnimatedModalTitle.displayName = 'AnimatedModalTitle';

const AnimatedModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AnimatedModalDescription.displayName = 'AnimatedModalDescription';

// Specialized modal variants
interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'destructive';
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AnimatedModal open={open} onOpenChange={onOpenChange}>
      <AnimatedModalContent size="sm">
        <AnimatedModalHeader>
          <AnimatedModalTitle>{title}</AnimatedModalTitle>
          {description && (
            <AnimatedModalDescription>{description}</AnimatedModalDescription>
          )}
        </AnimatedModalHeader>
        <AnimatedModalFooter>
          <motion.button
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleCancel}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {cancelText}
          </motion.button>
          <motion.button
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            onClick={handleConfirm}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {confirmText}
          </motion.button>
        </AnimatedModalFooter>
      </AnimatedModalContent>
    </AnimatedModal>
  );
}

// Loading modal
interface LoadingModalProps {
  open: boolean;
  title?: string;
  description?: string;
}

export function LoadingModal({
  open,
  title = 'Loading...',
  description,
}: LoadingModalProps) {
  return (
    <AnimatedModal open={open}>
      <AnimatedModalContent size="sm" showCloseButton={false} closeOnOverlayClick={false}>
        <AnimatedModalHeader>
          <AnimatedModalTitle className="flex items-center gap-2">
            <motion.div
              className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            {title}
          </AnimatedModalTitle>
          {description && (
            <AnimatedModalDescription>{description}</AnimatedModalDescription>
          )}
        </AnimatedModalHeader>
      </AnimatedModalContent>
    </AnimatedModal>
  );
}

export {
  AnimatedModal,
  AnimatedModalTrigger,
  AnimatedModalContent,
  AnimatedModalHeader,
  AnimatedModalFooter,
  AnimatedModalTitle,
  AnimatedModalDescription,
  AnimatedModalClose,
};