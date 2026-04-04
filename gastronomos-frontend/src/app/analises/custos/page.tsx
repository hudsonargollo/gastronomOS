'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/contexts/theme-context';
import { useTranslations } from '@/hooks/use-translations';

export default function CostAnalyticsPage() {
  const { palette } = useTheme();
  const { t } = useTranslations();

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: palette.text }}>
            {t('navigation.costAnalysis')}
          </h1>
          <p className="mt-1" style={{ color: palette.textSecondary }}>
            {t('analytics.costAnalysisDesc')}
          </p>
        </div>

        <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
          <CardContent className="pt-6">
            <p className="text-center" style={{ color: palette.textSecondary }}>
              {t('messages.noDataFound')}
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
