'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, LogOut, RotateCcw, Bell, Lock, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/theme-context';
import { useTranslations } from '@/hooks/use-translations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SettingsPage() {
  const router = useRouter();
  const { palette, theme, setTheme, availableThemes, resetTheme } = useTheme();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [notifications, setNotifications] = useState({
    lowStock: true,
    transfers: true,
    orders: true,
  });
  const [sessionTimeout, setSessionTimeout] = useState('24');
  const [autoBackup, setAutoBackup] = useState(true);
  const [dataRetention, setDataRetention] = useState('90');

  useEffect(() => {
    const name = localStorage.getItem('restaurantName') || '';
    const userEmail = localStorage.getItem('email') || '';
    const slug = localStorage.getItem('tenantSlug') || '';
    const notifSettings = localStorage.getItem('notifications');
    const timeout = localStorage.getItem('sessionTimeout') || '24';
    const backup = localStorage.getItem('autoBackup') !== 'false';
    const retention = localStorage.getItem('dataRetention') || '90';
    
    setRestaurantName(name);
    setEmail(userEmail);
    setTenantSlug(slug);
    setSessionTimeout(timeout);
    setAutoBackup(backup);
    setDataRetention(retention);
    
    if (notifSettings) {
      try {
        setNotifications(JSON.parse(notifSettings));
      } catch (e) {
        console.error('Failed to parse notifications:', e);
      }
    }
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      localStorage.setItem('restaurantName', restaurantName);
      localStorage.setItem('email', email);
      localStorage.setItem('notifications', JSON.stringify(notifications));
      localStorage.setItem('sessionTimeout', sessionTimeout);
      localStorage.setItem('autoBackup', autoBackup.toString());
      localStorage.setItem('dataRetention', dataRetention);
      toast.success(t('messages.saveSuccess'));
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setSelectedTheme(newTheme as any);
    setTheme(newTheme as any);
    toast.success('Tema alterado com sucesso');
  };

  const handleResetTheme = () => {
    if (confirm('Tem certeza que deseja redefinir o tema para o padrão?')) {
      resetTheme();
      setSelectedTheme(theme);
      toast.success('Tema redefinido para o padrão');
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

  const getThemeDescription = (themeName: string) => {
    const descriptions: Record<string, string> = {
      'SIGNATURE': 'Tema assinatura com cores vibrantes',
      'MINIMAL': 'Tema minimalista e limpo',
      'WARM': 'Tema quente com tons terrosos',
      'COOL': 'Tema frio com tons azulados',
    };
    return descriptions[themeName] || 'Tema personalizado';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold" style={{ color: palette.text }}>{t('settings.title')}</h1>
          <p className="mt-1" style={{ color: palette.textSecondary }}>{t('settings.subtitle')}</p>
        </motion.div>

        {/* Account Information */}
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
            </CardContent>
          </Card>
        </motion.div>

        {/* Theme Settings */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardHeader>
              <CardTitle style={{ color: palette.text }}>Tema Visual</CardTitle>
              <CardDescription style={{ color: palette.textSecondary }}>Escolha o tema de cores do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium" style={{ color: palette.text }}>Tema Disponível</Label>
                <Select value={selectedTheme} onValueChange={handleThemeChange}>
                  <SelectTrigger style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border,
                  }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableThemes.map((themeName) => (
                      <SelectItem key={themeName} value={themeName}>
                        {themeName} - {getThemeDescription(themeName)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: palette.background }}>
                  <div
                    className="w-12 h-12 rounded-lg"
                    style={{ backgroundColor: palette.primary }}
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: palette.text }}>Cor Primária</p>
                    <p className="text-xs" style={{ color: palette.textSecondary }}>{palette.primary}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleResetTheme}
                  variant="outline"
                  className="flex items-center gap-2"
                  style={{
                    color: palette.text,
                    borderColor: palette.border,
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Redefinir Tema
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardHeader>
              <CardTitle style={{ color: palette.text }} className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {t('settings.notifications')}
              </CardTitle>
              <CardDescription style={{ color: palette.textSecondary }}>Gerencie suas preferências de notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: palette.background }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: palette.text }}>{t('settings.lowStockAlerts')}</p>
                  <p className="text-xs" style={{ color: palette.textSecondary }}>{t('settings.lowStockAlertsDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.lowStock}
                  onChange={(e) => setNotifications({ ...notifications, lowStock: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: palette.background }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: palette.text }}>{t('settings.transferUpdates')}</p>
                  <p className="text-xs" style={{ color: palette.textSecondary }}>{t('settings.transferUpdatesDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.transfers}
                  onChange={(e) => setNotifications({ ...notifications, transfers: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: palette.background }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: palette.text }}>{t('settings.orderApprovals')}</p>
                  <p className="text-xs" style={{ color: palette.textSecondary }}>{t('settings.orderApprovalsDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.orders}
                  onChange={(e) => setNotifications({ ...notifications, orders: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Settings */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardHeader>
              <CardTitle style={{ color: palette.text }} className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {t('settings.security')}
              </CardTitle>
              <CardDescription style={{ color: palette.textSecondary }}>Configurações de segurança e sessão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium" style={{ color: palette.text }}>{t('settings.sessionDuration')}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: palette.background,
                      color: palette.text,
                      borderColor: palette.border,
                    } as React.CSSProperties}
                  />
                  <span style={{ color: palette.textSecondary }}>horas</span>
                </div>
                <p className="text-xs mt-1" style={{ color: palette.textSecondary }}>Logout automático após inatividade</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data & Backup */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardHeader>
              <CardTitle style={{ color: palette.text }} className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                {t('settings.dataBackup')}
              </CardTitle>
              <CardDescription style={{ color: palette.textSecondary }}>Gerencie backups e retenção de dados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: palette.background }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: palette.text }}>{t('settings.automaticBackups')}</p>
                  <p className="text-xs" style={{ color: palette.textSecondary }}>{t('settings.automaticBackupsDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
              </div>

              <div>
                <Label className="text-sm font-medium" style={{ color: palette.text }}>{t('settings.dataRetention')}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min="30"
                    max="365"
                    value={dataRetention}
                    onChange={(e) => setDataRetention(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: palette.background,
                      color: palette.text,
                      borderColor: palette.border,
                    } as React.CSSProperties}
                  />
                  <span style={{ color: palette.textSecondary }}>dias</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Save & Session */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
              <CardHeader>
                <CardTitle style={{ color: palette.text }}>Salvar Alterações</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2"
                  style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Salvando...' : t('forms.buttons.save')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
              <CardHeader>
                <CardTitle style={{ color: palette.text }}>Sessão</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
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
      </div>
    </MainLayout>
  );
}
