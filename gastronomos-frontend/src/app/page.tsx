'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useTranslations } from '@/hooks/use-translations';
import { Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslations();
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
      toast.success(t('auth.welcomeBackSuccess'));
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setFormData({
      email: 'demo@gastronomos.com',
      password: 'demo123',
    });
    toast.info(t('auth.demoCredentials'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-red-50 flex items-center justify-center p-3 sm:p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-40 w-80 h-80 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg mb-4"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <GastronomyIcons.Chef className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              GastronomOS
            </h1>
            <p className="text-slate-600 text-sm mt-1">Sistema de Gestão de Restaurante</p>
          </div>

          {/* Login Card */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-xl font-semibold text-slate-900">
                {t('auth.welcomeBack')}
              </CardTitle>
              <CardDescription className="text-slate-600">
                {t('auth.signInToAccount')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="h-11 bg-white border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    {t('auth.password')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="h-11 bg-white border-slate-200 focus:border-orange-500 focus:ring-orange-500 pr-10"
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
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Entrando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>{t('auth.signIn')}</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-500">ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
                  onClick={handleDemoLogin}
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    <span>{t('auth.tryDemo')}</span>
                  </div>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Features */}
          <motion.div
            className="mt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="grid grid-cols-3 gap-4 text-xs text-slate-600">
              <div className="flex flex-col items-center space-y-1">
                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <GastronomyIcons.Warehouse className="h-4 w-4 text-orange-600" />
                </div>
                <span>Gestão de Estoque</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <GastronomyIcons.Receipt className="h-4 w-4 text-blue-600" />
                </div>
                <span>Compras</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <GastronomyIcons.ChartPie className="h-4 w-4 text-green-600" />
                </div>
                <span>Análises</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}