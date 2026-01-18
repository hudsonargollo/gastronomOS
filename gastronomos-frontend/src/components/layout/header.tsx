'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Search, Menu, Sun, Moon, User, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  onMenuClick?: () => void;
  title?: string;
}

export function Header({ onMenuClick, title = 'Dashboard' }: HeaderProps) {
  const [isDark, setIsDark] = React.useState(false);
  const [notifications] = React.useState([
    { id: 1, title: 'Low stock alert', message: 'Tomatoes running low at Location A', time: '5m ago', type: 'warning' },
    { id: 2, title: 'Transfer completed', message: 'Transfer #TR-001 has been received', time: '10m ago', type: 'success' },
    { id: 3, title: 'New purchase order', message: 'PO #PO-123 requires approval', time: '15m ago', type: 'info' },
  ]);

  const toggleTheme = () => {
    setIsDark(!isDark);
    // In a real app, you'd update the theme context here
  };

  return (
    <motion.header
      className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 shadow-sm"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Left side */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">Welcome back, manage your restaurant operations</p>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search products, orders, transfers..."
            className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="hidden sm:flex"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {notifications.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-y-auto">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                  whileHover={{ backgroundColor: 'rgb(248 250 252)' }}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`h-2 w-2 rounded-full mt-2 ${
                        notification.type === 'warning'
                          ? 'bg-yellow-500'
                          : notification.type === 'success'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-slate-600 truncate">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {notification.time}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/avatars/01.png" alt="@johndoe" />
                <AvatarFallback className="bg-gradient-to-br from-orange-400 to-red-500 text-white">
                  JD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">John Doe</p>
                <p className="text-xs leading-none text-muted-foreground">
                  john.doe@restaurant.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}