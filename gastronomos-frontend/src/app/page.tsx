'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiClient.login(formData.email, formData.password);
      apiClient.setToken(response.token);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setFormData({
      email: 'demo@gastronomos.com',
      password: 'demo123',
    });
    toast.info('Demo credentials loaded - click Sign In to continue');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-orange-400/20 to-red-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-orange-400/20 to-red-400/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-gradient-to-br from-orange-300/10 to-red-300/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and branding */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-2xl shadow-orange-500/25">
              <GastronomyIcons.Chef className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            GastronomOS
          </h1>
          <p className="text-slate-600 mt-2">Restaurant Management System</p>
        </motion.div>

        {/* Login form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-black/10">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center text-slate-900">
                Welcome back
              </CardTitle>
              <CardDescription className="text-center text-slate-600">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-11 bg-white/50 border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-11 bg-white/50 border-slate-200 focus:border-orange-500 focus:ring-orange-500/20 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-400" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium shadow-lg shadow-orange-500/25 transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Demo button */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
                  onClick={handleDemoLogin}
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Try Demo Account</span>
                  </div>
                </Button>
                <p className="text-xs text-slate-500 text-center mt-2">
                  Experience GastronomOS with sample data
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Features showcase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 grid grid-cols-3 gap-4 text-center"
        >
          <div className="space-y-2">
            <div className="h-10 w-10 mx-auto rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <GastronomyIcons.Warehouse className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs text-slate-600 font-medium">Inventory Management</p>
          </div>
          <div className="space-y-2">
            <div className="h-10 w-10 mx-auto rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <GastronomyIcons.Receipt className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs text-slate-600 font-medium">Smart Receipts</p>
          </div>
          <div className="space-y-2">
            <div className="h-10 w-10 mx-auto rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <GastronomyIcons.TrendingUp className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs text-slate-600 font-medium">Analytics</p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 text-center text-xs text-slate-500"
        >
          © 2024 GastronomOS. All rights reserved.
        </motion.div>
      </div>
    </div>
  );
}