'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CategoriesPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Categories</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Categories Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Categories management functionality is being updated. Please check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}