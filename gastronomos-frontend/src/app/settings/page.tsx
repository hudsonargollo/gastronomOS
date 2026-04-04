'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/theme-context';
import { useTranslations } from '@/hooks/use-translations';

export default function SettingsPage() {
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('restaurantName') || '';
    const userEmail = localStorage.getItem('email') || '';
    const slug = localStorage.getItem('tenantSlug') || '';
    
    setRestaurantName(name);
    setEmail(userEmail);
    setTenantSlug(slug);
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      localStorage.setItem('restaurantName', restaurantName);
      localStorage.setItem('email', email);
      toast.success(t('messages.saveSuccess'));
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('restaurantName');
    localStorage.removeItem('tenantSlug');
    toast.success('Desconectado com sucesso');
    router.push('/');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold" style={{ color: palette.text }}>{t('settings.title')}</h1>
          <p className="mt-1" style={{ color: palette.textSecondary }}>{t('settings.subtitle')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardHeader>
              <CardTitle style={{ color: palette.text }}>Informações da Conta</CardTitle>
              <CardDescription style={{ color: palette.textSecondary }}>Atualize os detalhes da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium" style={{ color: palette.text }}>Nome do Restaurante</Label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border rounded-lg focus:outline-none"
                  style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border,
                    '--tw-ring-color': palette.primary,
                  } as React.CSSProperties}
                  placeholder="Nome do seu restaurante"
                />
              </div>

              <div>
                <Label className="text-sm font-medium" style={{ color: palette.text }}>{t('forms.labels.email')}</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border rounded-lg focus:outline-none"
                  style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border,
                  } as React.CSSProperties}
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <Label className="text-sm font-medium" style={{ color: palette.text }}>ID do Restaurante</Label>
                <input
                  type="text"
                  value={tenantSlug}
                  disabled
                  className="w-full mt-2 px-3 py-2 border rounded-lg"
                  style={{
                    backgroundColor: palette.background,
                    color: palette.textSecondary,
                    borderColor: palette.border,
                    opacity: 0.6,
                  } as React.CSSProperties}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2"
                  style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Salvando...' : t('forms.buttons.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardHeader>
              <CardTitle style={{ color: palette.text }}>Sessão</CardTitle>
              <CardDescription style={{ color: palette.textSecondary }}>Gerencie sua sessão de login</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2"
                style={{
                  color: palette.destructive,
                  borderColor: palette.destructive,
                }}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </MainLayout>
  );
}
