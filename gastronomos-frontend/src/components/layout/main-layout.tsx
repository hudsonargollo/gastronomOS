'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BreadcrumbNavigation } from './breadcrumb-navigation';
import { Toaster } from '@/components/ui/sonner';

interface BreadcrumbItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBreadcrumbs?: boolean;
}

export function MainLayout({ 
  children, 
  title, 
  breadcrumbs, 
  showBreadcrumbs = true 
}: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setIsTransitioning(true);
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
    
    // Reset transition state after animation completes
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const closeMobileSidebar = () => {
    if (isMobile) {
      setIsTransitioning(true);
      setSidebarOpen(false);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={closeMobileSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {(sidebarOpen || !isMobile) && (
          <motion.div
            initial={isMobile ? { x: -320, opacity: 0 } : { x: 0, opacity: 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={isMobile ? { x: -320, opacity: 0 } : { x: 0, opacity: 1 }}
            transition={{ 
              duration: 0.3, 
              ease: [0.4, 0.0, 0.2, 1], // Custom easing for smoother feel
              type: 'tween'
            }}
            className={`${
              isMobile 
                ? 'fixed inset-y-0 left-0 z-50' 
                : 'relative'
            }`}
          >
            <Sidebar 
              collapsed={sidebarCollapsed && !isMobile} 
              className={isMobile ? 'shadow-2xl' : ''}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <motion.div 
        className="flex flex-1 flex-col overflow-hidden min-w-0"
        animate={{ 
          marginLeft: !isMobile && sidebarCollapsed ? 0 : 0,
          transition: { duration: 0.3, ease: [0.4, 0.0, 0.2, 1] }
        }}
      >
        <Header onMenuClick={toggleSidebar} title={title} />
        
        {/* Breadcrumb Navigation */}
        <AnimatePresence>
          {showBreadcrumbs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-slate-200 bg-white/80 backdrop-blur-sm px-3 sm:px-6"
            >
              <BreadcrumbNavigation customItems={breadcrumbs} />
            </motion.div>
          )}
        </AnimatePresence>
        
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={title} // Re-animate when title changes (page changes)
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.4, 0.0, 0.2, 1],
              delay: isTransitioning ? 0.1 : 0 // Slight delay during sidebar transitions
            }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </motion.div>

      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'white',
            color: 'rgb(15 23 42)',
            border: '1px solid rgb(226 232 240)',
            fontSize: '14px',
          },
        }}
      />
    </div>
  );
}