'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import { useLanguage } from '@/contexts/language-context';
import { 
  Settings, 
  Bell, 
  Shield, 
  Database, 
  Palette, 
  Globe,
  Save
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { t } = useTranslations();
  const { language, setLanguage } = useLanguage();

  return (
    <MainLayout title={t('settings.title')}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('settings.title')}</h1>
            <p className="text-slate-600 mt-2">{t('settings.subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
            <Save className="h-4 w-4 mr-2" />
            {t('settings.saveChanges')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-blue-500" />
                  <span>{t('settings.generalSettings')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">{t('settings.companyName')}</Label>
                  <Input id="company-name" defaultValue="GastronomOS Demo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">{t('settings.timezone')}</Label>
                  <Input id="timezone" defaultValue="UTC-3 (Brasília)" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t('settings.defaultCurrency')}</Label>
                  <Input id="currency" defaultValue="BRL" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">{t('settings.language')}</Label>
                  <Select value={language} onValueChange={(value: 'en' | 'pt-BR') => setLanguage(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('settings.selectLanguage')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">🇧🇷 Português Brasileiro</SelectItem>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  <span>{t('settings.notifications')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.lowStockAlerts')}</Label>
                    <p className="text-sm text-slate-500">{t('settings.lowStockAlertsDesc')}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.transferUpdates')}</Label>
                    <p className="text-sm text-slate-500">{t('settings.transferUpdatesDesc')}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.orderApprovals')}</Label>
                    <p className="text-sm text-slate-500">{t('settings.orderApprovalsDesc')}</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  <span>{t('settings.security')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.twoFactorAuth')}</Label>
                    <p className="text-sm text-slate-500">{t('settings.twoFactorAuthDesc')}</p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.sessionTimeout')}</Label>
                    <p className="text-sm text-slate-500">{t('settings.sessionTimeoutDesc')}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="session-duration">{t('settings.sessionDuration')}</Label>
                  <Input id="session-duration" type="number" defaultValue="8" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Data & Backup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-purple-500" />
                  <span>{t('settings.dataBackup')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.automaticBackups')}</Label>
                    <p className="text-sm text-slate-500">{t('settings.automaticBackupsDesc')}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="retention">{t('settings.dataRetention')}</Label>
                  <Input id="retention" type="number" defaultValue="90" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Button variant="outline" className="w-full">
                    {t('settings.exportData')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}