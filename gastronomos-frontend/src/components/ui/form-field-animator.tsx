"use client"

import * as React from "react"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/animation-utils"

interface FormFieldAnimatorProps {
  children: React.ReactNode
  name: string
  label?: string
  error?: string
  isValid?: boolean
  isRequired?: boolean
  isVisible?: boolean
  description?: string
  className?: string
  animationDelay?: number
}

const fieldVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      duration: 0.2,
      ease: "easeInOut"
    }
  },
  visible: {
    opacity: 1,
    height: "auto",
    marginBottom: 16,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      duration: 0.2,
      ease: "easeIn"
    }
  }
}

const labelVariants: Variants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
}

const errorVariants: Variants = {
  initial: { opacity: 0, height: 0, y: -10 },
  animate: { 
    opacity: 1, 
    height: "auto", 
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    height: 0, 
    y: -10,
    transition: {
      duration: 0.15,
      ease: "easeIn"
    }
  }
}

const validationIconVariants: Variants = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  },
  exit: { 
    scale: 0, 
    rotate: 180,
    transition: {
      duration: 0.15
    }
  }
}

const FormFieldAnimator: React.FC<FormFieldAnimatorProps> = ({
  children,
  name,
  label,
  error,
  isValid,
  isRequired = false,
  isVisible = true,
  description,
  className,
  animationDelay = 0
}) => {
  const hasError = !!error
  const showValidation = isValid !== undefined

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={name}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn("space-y-2", className)}
          style={{
            animationDelay: `${animationDelay}ms`
          }}
        >
          {/* Label with animation */}
          {label && (
            <motion.div
              variants={labelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitions.fast}
              className="flex items-center justify-between"
            >
              <label
                htmlFor={name}
                className={cn(
                  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                  hasError && "text-destructive",
                  isValid && "text-green-600"
                )}
              >
                {label}
                {isRequired && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ml-1 text-destructive"
                  >
                    *
                  </motion.span>
                )}
              </label>

              {/* Validation icon */}
              <AnimatePresence>
                {showValidation && (
                  <motion.div
                    variants={validationIconVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {hasError ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : isValid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Field content with focus animation */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{
              ...transitions.default,
              delay: animationDelay / 1000
            }}
            className="relative"
          >
            {children}
          </motion.div>

          {/* Description */}
          <AnimatePresence>
            {description && !hasError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={transitions.fast}
                className="flex items-start space-x-2 text-sm text-muted-foreground"
              >
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{description}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message with animation */}
          <AnimatePresence>
            {hasError && (
              <motion.div
                variants={errorVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-start space-x-2 text-sm text-destructive"
              >
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { FormFieldAnimator }