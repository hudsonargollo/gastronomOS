import { useEffect, useCallback, useRef } from 'react'

export interface KeyboardNavigationOptions {
  enabled?: boolean
  loop?: boolean
  orientation?: 'horizontal' | 'vertical' | 'both'
  selector?: string
  onSelect?: (element: HTMLElement, index: number) => void
  onEscape?: () => void
  onEnter?: (element: HTMLElement, index: number) => void
  onSpace?: (element: HTMLElement, index: number) => void
  skipDisabled?: boolean
  autoFocus?: boolean
}

export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: KeyboardNavigationOptions = {}
) {
  const {
    enabled = true,
    loop = true,
    orientation = 'vertical',
    selector = '[role="menuitem"], [role="option"], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    onSelect,
    onEscape,
    onEnter,
    onSpace,
    skipDisabled = true,
    autoFocus = false,
  } = options

  const currentIndexRef = useRef(-1)
  const elementsRef = useRef<HTMLElement[]>([])

  const getNavigableElements = useCallback(() => {
    if (!containerRef.current) return []
    
    const elements = Array.from(
      containerRef.current.querySelectorAll(selector)
    ) as HTMLElement[]
    
    return skipDisabled 
      ? elements.filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled'))
      : elements
  }, [containerRef, selector, skipDisabled])

  const updateElements = useCallback(() => {
    elementsRef.current = getNavigableElements()
  }, [getNavigableElements])

  const focusElement = useCallback((index: number) => {
    const elements = elementsRef.current
    if (index >= 0 && index < elements.length) {
      const element = elements[index]
      element.focus()
      element.scrollIntoView({ block: 'nearest' })
      currentIndexRef.current = index
      onSelect?.(element, index)
    }
  }, [onSelect])

  const moveToNext = useCallback(() => {
    const elements = elementsRef.current
    if (elements.length === 0) return

    let nextIndex = currentIndexRef.current + 1
    
    if (nextIndex >= elements.length) {
      nextIndex = loop ? 0 : elements.length - 1
    }
    
    focusElement(nextIndex)
  }, [focusElement, loop])

  const moveToPrevious = useCallback(() => {
    const elements = elementsRef.current
    if (elements.length === 0) return

    let prevIndex = currentIndexRef.current - 1
    
    if (prevIndex < 0) {
      prevIndex = loop ? elements.length - 1 : 0
    }
    
    focusElement(prevIndex)
  }, [focusElement, loop])

  const moveToFirst = useCallback(() => {
    focusElement(0)
  }, [focusElement])

  const moveToLast = useCallback(() => {
    const elements = elementsRef.current
    if (elements.length > 0) {
      focusElement(elements.length - 1)
    }
  }, [focusElement])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    const { key, ctrlKey, metaKey } = event
    const elements = elementsRef.current
    
    // Update current index based on focused element
    const activeElement = document.activeElement as HTMLElement
    const currentIndex = elements.indexOf(activeElement)
    if (currentIndex !== -1) {
      currentIndexRef.current = currentIndex
    }

    switch (key) {
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault()
          moveToNext()
        }
        break
        
      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault()
          moveToPrevious()
        }
        break
        
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault()
          moveToNext()
        }
        break
        
      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault()
          moveToPrevious()
        }
        break
        
      case 'Home':
        if (ctrlKey || metaKey) {
          event.preventDefault()
          moveToFirst()
        }
        break
        
      case 'End':
        if (ctrlKey || metaKey) {
          event.preventDefault()
          moveToLast()
        }
        break
        
      case 'Enter':
        if (currentIndexRef.current >= 0 && currentIndexRef.current < elements.length) {
          const element = elements[currentIndexRef.current]
          onEnter?.(element, currentIndexRef.current)
        }
        break
        
      case ' ':
        if (currentIndexRef.current >= 0 && currentIndexRef.current < elements.length) {
          event.preventDefault()
          const element = elements[currentIndexRef.current]
          onSpace?.(element, currentIndexRef.current)
        }
        break
        
      case 'Escape':
        onEscape?.()
        break
    }
  }, [
    enabled,
    orientation,
    moveToNext,
    moveToPrevious,
    moveToFirst,
    moveToLast,
    onEnter,
    onSpace,
    onEscape,
  ])

  // Initialize and update elements
  useEffect(() => {
    updateElements()
    
    // Set up mutation observer to watch for DOM changes
    if (containerRef.current) {
      const observer = new MutationObserver(updateElements)
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'aria-disabled', 'tabindex'],
      })
      
      return () => observer.disconnect()
    }
  }, [updateElements, containerRef])

  // Auto focus first element
  useEffect(() => {
    if (autoFocus && enabled && elementsRef.current.length > 0) {
      focusElement(0)
    }
  }, [autoFocus, enabled, focusElement])

  // Set up keyboard event listeners
  useEffect(() => {
    if (!enabled || !containerRef.current) return

    const container = containerRef.current
    container.addEventListener('keydown', handleKeyDown)
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown, containerRef])

  return {
    currentIndex: currentIndexRef.current,
    elements: elementsRef.current,
    focusElement,
    moveToNext,
    moveToPrevious,
    moveToFirst,
    moveToLast,
    updateElements,
  }
}

// Hook for managing focus trap (useful for modals)
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  enabled: boolean = true
) {
  const firstFocusableRef = useRef<HTMLElement | null>(null)
  const lastFocusableRef = useRef<HTMLElement | null>(null)

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []
    
    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ')
    
    return Array.from(
      containerRef.current.querySelectorAll(focusableSelectors)
    ) as HTMLElement[]
  }, [containerRef])

  const updateFocusableElements = useCallback(() => {
    const elements = getFocusableElements()
    firstFocusableRef.current = elements[0] || null
    lastFocusableRef.current = elements[elements.length - 1] || null
  }, [getFocusableElements])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || event.key !== 'Tab') return

    updateFocusableElements()
    
    const { shiftKey } = event
    const activeElement = document.activeElement as HTMLElement

    if (shiftKey) {
      // Shift + Tab (backward)
      if (activeElement === firstFocusableRef.current) {
        event.preventDefault()
        lastFocusableRef.current?.focus()
      }
    } else {
      // Tab (forward)
      if (activeElement === lastFocusableRef.current) {
        event.preventDefault()
        firstFocusableRef.current?.focus()
      }
    }
  }, [enabled, updateFocusableElements])

  useEffect(() => {
    if (!enabled || !containerRef.current) return

    const container = containerRef.current
    updateFocusableElements()
    
    // Focus first element when trap is enabled
    if (firstFocusableRef.current) {
      firstFocusableRef.current.focus()
    }
    
    container.addEventListener('keydown', handleKeyDown)
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown, updateFocusableElements, containerRef])

  return {
    firstFocusable: firstFocusableRef.current,
    lastFocusable: lastFocusableRef.current,
    updateFocusableElements,
  }
}

// Hook for managing ARIA announcements
export function useAriaAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Create announcer element
    const announcer = document.createElement('div')
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    announcer.style.position = 'absolute'
    announcer.style.left = '-10000px'
    announcer.style.width = '1px'
    announcer.style.height = '1px'
    announcer.style.overflow = 'hidden'
    
    document.body.appendChild(announcer)
    announcerRef.current = announcer
    
    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current)
      }
    }
  }, [])

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority)
      announcerRef.current.textContent = message
      
      // Clear after announcement
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = ''
        }
      }, 1000)
    }
  }, [])

  return { announce }
}