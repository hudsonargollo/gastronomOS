'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';

export default function CategoriesPage() {
  const { t } = useTranslations();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t('inventory.categories')}</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Gestão de Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              A funcionalidade de gestão de categorias está sendo atualizada. Por favor, volte mais tarde.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}