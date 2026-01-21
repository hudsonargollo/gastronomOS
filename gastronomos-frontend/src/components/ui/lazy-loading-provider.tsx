/**
 * LazyLoadingProvider Component
 * Provides asset optimization and lazy loading capabilities
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy loading configuration
export interface LazyLoadingConfig {
  rootMargin?: string;
  threshold?: number;
  enableIntersectionObserver?: boolean;
  preloadDistance?: number;
  maxConcurrentLoads?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// Asset loading state
export interface AssetLoadingState {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  progress?: number;
}

// Lazy loading context
interface LazyLoadingContextType {
  config: LazyLoadingConfig;
  loadAsset: (url: string, type: 'image' | 'script' | 'style') => Promise<void>;
  preloadAsset: (url: string, type: 'image' | 'script' | 'style') => void;
  getAssetState: (url: string) => AssetLoadingState;
  clearCache: () => void;
}

const LazyLoadingContext = createContext<LazyLoadingContextType | null>(null);

// Default configuration
const defaultConfig: LazyLoadingConfig = {
  rootMargin: '50px',
  threshold: 0.1,
  enableIntersectionObserver: true,
  preloadDistance: 200,
  maxConcurrentLoads: 3,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Asset cache and loading state
const assetCache = new Map<string, AssetLoadingState>();
const loadingQueue: Array<{ url: string; type: 'image' | 'script' | 'style'; resolve: () => void; reject: (error: Error) => void }> = [];
let currentLoads = 0;

export interface LazyLoadingProviderProps {
  children: React.ReactNode;
  config?: Partial<LazyLoadingConfig>;
}

export function LazyLoadingProvider({ children, config: userConfig = {} }: LazyLoadingProviderProps) {
  const config = { ...defaultConfig, ...userConfig };
  const [, forceUpdate] = useState({});

  // Force re-render when asset states change
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  // Load asset function
  const loadAsset = useCallback(async (url: string, type: 'image' | 'script' | 'style'): Promise<void> => {
    // Check if already loaded or loading
    const currentState = assetCache.get(url);
    if (currentState?.loaded) return;
    if (currentState?.loading) {
      // Wait for existing load to complete
      return new Promise((resolve, reject) => {
        const checkState = () => {
          const state = assetCache.get(url);
          if (state?.loaded) resolve();
          else if (state?.error) reject(new Error(`Failed to load ${url}`));
          else setTimeout(checkState, 100);
        };
        checkState();
      });
    }

    // Set loading state
    assetCache.set(url, { loading: true, loaded: false, error: false });
    triggerUpdate();

    return new Promise((resolve, reject) => {
      // Add to queue if max concurrent loads reached
      if (currentLoads >= config.maxConcurrentLoads!) {
        loadingQueue.push({ url, type, resolve, reject });
        return;
      }

      currentLoads++;
      performLoad(url, type, resolve, reject);
    });
  }, [config.maxConcurrentLoads, triggerUpdate]);

  // Perform actual asset loading
  const performLoad = useCallback((
    url: string, 
    type: 'image' | 'script' | 'style', 
    resolve: () => void, 
    reject: (error: Error) => void,
    attempt = 1
  ) => {
    const onSuccess = () => {
      assetCache.set(url, { loading: false, loaded: true, error: false });
      triggerUpdate();
      currentLoads--;
      resolve();
      
      // Process next item in queue
      if (loadingQueue.length > 0) {
        const next = loadingQueue.shift()!;
        currentLoads++;
        performLoad(next.url, next.type, next.resolve, next.reject);
      }
    };

    const onError = (error: Error) => {
      if (attempt < config.retryAttempts!) {
        // Retry after delay
        setTimeout(() => {
          performLoad(url, type, resolve, reject, attempt + 1);
        }, config.retryDelay! * attempt);
      } else {
        assetCache.set(url, { loading: false, loaded: false, error: true });
        triggerUpdate();
        currentLoads--;
        reject(error);
        
        // Process next item in queue
        if (loadingQueue.length > 0) {
          const next = loadingQueue.shift()!;
          currentLoads++;
          performLoad(next.url, next.type, next.resolve, next.reject);
        }
      }
    };

    // Load based on type
    switch (type) {
      case 'image':
        const img = new Image();
        img.onload = onSuccess;
        img.onerror = () => onError(new Error(`Failed to load image: ${url}`));
        img.src = url;
        break;

      case 'script':
        const script = document.createElement('script');
        script.onload = onSuccess;
        script.onerror = () => onError(new Error(`Failed to load script: ${url}`));
        script.src = url;
        document.head.appendChild(script);
        break;

      case 'style':
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.onload = onSuccess;
        link.onerror = () => onError(new Error(`Failed to load stylesheet: ${url}`));
        link.href = url;
        document.head.appendChild(link);
        break;
    }
  }, [config.retryAttempts, config.retryDelay, triggerUpdate]);

  // Preload asset
  const preloadAsset = useCallback((url: string, type: 'image' | 'script' | 'style') => {
    loadAsset(url, type).catch(() => {
      // Silently handle preload failures
    });
  }, [loadAsset]);

  // Get asset state
  const getAssetState = useCallback((url: string): AssetLoadingState => {
    return assetCache.get(url) || { loading: false, loaded: false, error: false };
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    assetCache.clear();
    triggerUpdate();
  }, [triggerUpdate]);

  const contextValue: LazyLoadingContextType = {
    config,
    loadAsset,
    preloadAsset,
    getAssetState,
    clearCache,
  };

  return (
    <LazyLoadingContext.Provider value={contextValue}>
      {children}
    </LazyLoadingContext.Provider>
  );
}

// Hook to use lazy loading
export function useLazyLoading() {
  const context = useContext(LazyLoadingContext);
  if (!context) {
    throw new Error('useLazyLoading must be used within a LazyLoadingProvider');
  }
  return context;
}

// Lazy image component
export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: React.ReactNode;
  errorComponent?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  preload?: boolean;
}

export function LazyImage({
  src,
  alt,
  placeholder,
  errorComponent,
  onLoad,
  onError,
  preload = false,
  className = '',
  ...props
}: LazyImageProps) {
  const { loadAsset, getAssetState, preloadAsset } = useLazyLoading();
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const assetState = getAssetState(src);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  // Preload if requested
  useEffect(() => {
    if (preload) {
      preloadAsset(src, 'image');
    }
  }, [preload, src, preloadAsset]);

  // Load image when in view
  useEffect(() => {
    if (isInView && !assetState.loaded && !assetState.loading) {
      loadAsset(src, 'image')
        .then(() => onLoad?.())
        .catch((error) => onError?.(error));
    }
  }, [isInView, src, assetState, loadAsset, onLoad, onError]);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        {assetState.error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center bg-gray-100"
          >
            {errorComponent || (
              <div className="text-gray-500 text-sm">Failed to load image</div>
            )}
          </motion.div>
        ) : assetState.loaded ? (
          <motion.img
            key="image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            {...props}
          />
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center bg-gray-100"
          >
            {placeholder || (
              <div className="animate-pulse bg-gray-200 w-full h-full" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Hook for intersection observer
export function useIntersectionObserver(
  callback: (isIntersecting: boolean) => void,
  options?: IntersectionObserverInit
) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => callback(entry.isIntersecting),
      options
    );

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [callback, options]);

  return elementRef;
}

// Hook for lazy loading assets
export function useLazyAsset(url: string, type: 'image' | 'script' | 'style') {
  const { loadAsset, getAssetState } = useLazyLoading();
  const [shouldLoad, setShouldLoad] = useState(false);
  const assetState = getAssetState(url);

  const load = useCallback(() => {
    setShouldLoad(true);
  }, []);

  useEffect(() => {
    if (shouldLoad && !assetState.loaded && !assetState.loading) {
      loadAsset(url, type);
    }
  }, [shouldLoad, url, type, assetState, loadAsset]);

  return {
    ...assetState,
    load,
  };
}