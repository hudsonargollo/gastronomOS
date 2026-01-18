'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Toaster } from '@/components/ui/sonner';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {(!isMobile || !sidebarCollapsed) && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={`${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}`}
          >
            <Sidebar collapsed={sidebarCollapsed && !isMobile} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile overlay */}
      {isMobile && !sidebarCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/50"
          onClick={toggleSidebar}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} title={title} />
        
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}