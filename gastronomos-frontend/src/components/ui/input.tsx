import * as React from "react"
import { motion, MotionProps } from "framer-motion"

import { cn } from "@/lib/utils"
import { transitions } from "@/lib/animation-utils"

const inputVariants = {
  initial: { scale: 1 },
  focus: { scale: 1.01 },
  error: { 
    x: [-2, 2, -2, 2, 0],
    transition: { duration: 0.4 }
  },
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)

  React.useEffect(() => {
    // Check for aria-invalid to trigger error animation
    setHasError(props['aria-invalid'] === true || props['aria-invalid'] === 'true')
  }, [props['aria-invalid']])

  const motionProps: MotionProps = {
    variants: inputVariants,
    initial: "initial",
    animate: hasError ? "error" : isFocused ? "focus" : "initial",
    transition: transitions.fast,
    onFocus: (e) => {
      setIsFocused(true)
      props.onFocus?.(e)
    },
    onBlur: (e) => {
      setIsFocused(false)
      props.onBlur?.(e)
    },
  }

  return (
    <motion.input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...motionProps}
      {...props}
    />
  )
}

export { Input }
