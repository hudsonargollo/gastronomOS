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
import Link from 'next/link';

export default function LoginPage() {
  return <LoginPageContent />;
}

function LoginPageContent() {
  const router = useRouter();
  const { t } = useTranslations();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    tenantSlug: '',
  });

  // Disable onboarding on login page
  React.useEffect(() => {
    localStorage.setItem('pontal-stock-onboarding-completed', 'true');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiClient.login(formData.email, formData.password, formData.tenantSlug || 'demo-restaurant');
      apiClient.setToken(response.token);
      toast.success(t('auth.welcomeBackSuccess'));
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiClient.login('demo@pontal-stock.com', 'demo123', 'pontal-carapitangui');
      apiClient.setToken(response.token);
      toast.success(t('auth.welcomeBackSuccess'));
      router.push('/dashboard');
    } catch (error) {
      setFormData({ email: 'demo@pontal-stock.com', password: 'demo123', tenantSlug: 'pontal-carapitangui' });
      toast.error(error instanceof Error ? error.message : 'Demo account not available. Please register first.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-3 sm:p-4">
      {/* Background decorations - darker and more subtle */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-40 w-80 h-80 bg-orange-500 rounded-full mix-blend-screen filter blur-3xl opacity-15 animate-blob animation-delay-4000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo - Larger and more prominent */}
          <div className="text-center mb-12">
            <motion.div
              className="inline-flex h-32 w-32 items-center justify-center rounded-3xl shadow-2xl mb-6 overflow-hidden bg-gradient-to-br from-orange-400 via-orange-500 to-red-600 p-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="h-full w-full rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <img 
                  src="/logos/pontal-carapitangui.webp" 
                  alt="Pontal Stock Logo"
                  className="h-28 w-28 object-contain"
                  onError={(e) => {
                    // Hide image on error and show gradient background
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </motion.div>
            <h1 className="text-4xl font-bold text-white mb-1">
              Pontal Stock
            </h1>
            <p className="text-slate-300 text-sm">Gestão de Estoque</p>
          </div>

          {/* Login Card - More compact and professional */}
          <Card className="shadow-2xl border-0 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Acesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="E-mail"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="h-10 bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500 text-sm"
                    required
                  />
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Senha"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="h-10 bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500 pr-10 text-sm"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-10 px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>

                <div>
                  <Input
                    id="tenantSlug"
                    type="text"
                    placeholder="Restaurante (opcional)"
                    value={formData.tenantSlug}
                    onChange={(e) => setFormData(prev => ({ ...prev, tenantSlug: e.target.value }))}
                    className="h-10 bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500 text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 text-sm"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Entrando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Entrar</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm"
                  onClick={handleDemoLogin}
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    <span>Demo</span>
                  </div>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Features */}
          <motion.div
            className="mt-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <p className="text-slate-400 text-xs">
              Não tem conta? <Link href="/register" className="text-orange-400 hover:text-orange-300 font-semibold">Registre-se</Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}