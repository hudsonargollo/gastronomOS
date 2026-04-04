'use client';

import { useState, useEffect } from 'react';

export function useOnboarding() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem('gastronomos-onboarding-completed');
    const isFirstTime = !hasCompletedOnboarding;
    
    setIsFirstVisit(isFirstTime);
    
    // Show onboarding for first-time users after a short delay
    if (isFirstTime) {
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 1500); // 1.5 second delay to let the dashboard load
      
      return () => clearTimeout(timer);
    }
  }, []);

  const startOnboarding = () => {
    setIsOnboardingOpen(true);
  };

  const closeOnboarding = () => {
    setIsOnboardingOpen(false);
  };

  const completeOnboarding = () => {
    setIsOnboardingOpen(false);
    setIsFirstVisit(false);
    localStorage.setItem('gastronomos-onboarding-completed', 'true');
  };

  const resetOnboarding = () => {
    localStorage.removeItem('gastronomos-onboarding-completed');
    setIsFirstVisit(true);
    setIsOnboardingOpen(true);
  };

  return {
    isOnboardingOpen,
    isFirstVisit,
    startOnboarding,
    closeOnboarding,
    completeOnboarding,
    resetOnboarding,
  };
}