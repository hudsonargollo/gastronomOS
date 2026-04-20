'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/theme-context';
import { AlertTriangle, Plus, Trash2, Save } from 'lucide-react';

interface StockAlertConfig {
  id: string;
  productName: string;
  productId: string;
  thresholdPercent: number;
  thresholdQuantity?: number;
  isActive: boolean;
}

interface StockAlertConfigProps {
  productId: string;
  productName: string;
  maxStock: number;
  currentStock: number;
  onSave?: (config: StockAlertConfig) => void;
}

export function StockAlertConfig({
  productId,
  productName,
  maxStock,
  currentStock,
}: StockAlertConfigProps) {
  const { palette } = useTheme();
  const [thresholdPercent, setThresholdPercent] = useState(20);
  const [thresholdQuantity, setThresholdQuantity] = useState(
    Math.round(maxStock * 0.2)
  );
  const [isActive, setIsActive] = useState(true);

  const calculateThresholdQuantity = (percent: number) => {
    return Math.round(maxStock * (percent / 100));
  };

  const handlePercentChange = (percent: number) => {
    setThresholdPercent(percent);
    setThresholdQuantity(calculateThresholdQuantity(percent));
  };

  const handleQuantityChange = (quantity: number) => {
    setThresholdQuantity(quantity);
    const percent = Math.round((quantity / maxStock) * 100);
    setThresholdPercent(percent);
  };

  const isLowStock = currentStock <= thresholdQuantity;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" style={{ color: palette.primary }} />
          Configurar Alerta de Estoque
        </CardTitle>
        <CardDescription>
          {productName} - Estoque atual: {currentStock} unidades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div
          className="p-4 rounded-lg border-2"
          style={{
            borderColor: isLowStock ? '#ea580c' : palette.accent,
            backgroundColor: isLowStock ? '#fef3c7' : `${palette.accent}10`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="font-semibold"
                style={{
                  color: isLowStock ? '#ea580c' : palette.primary,
                }}
              >
                {isLowStock ? 'Estoque Baixo' : 'Estoque Normal'}
              </p>
              <p style={{ color: palette.textSecondary }} className="text-sm">
                {currentStock} de {maxStock} unidades ({Math.round((currentStock / maxStock) * 100)}%)
              </p>
            </div>
            <Badge
              variant={isLowStock ? 'destructive' : 'secondary'}
            >
              {isLowStock ? 'Alerta Ativo' : 'OK'}
            </Badge>
          </div>
        </div>

        {/* Threshold Configuration */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold" style={{ color: palette.text }}>
              Limite em Percentual (%)
            </Label>
            <div className="mt-2 space-y-3">
              {/* Percentage Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={thresholdPercent}
                  onChange={(e) => handlePercentChange(parseInt(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: palette.primary,
                  }}
                />
                <div className="flex items-center justify-between">
                  <span style={{ color: palette.textSecondary }} className="text-sm">
                    1%
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: palette.primary }}
                  >
                    {thresholdPercent}%
                  </span>
                  <span style={{ color: palette.textSecondary }} className="text-sm">
                    100%
                  </span>
                </div>
              </div>

              {/* Percentage Input */}
              <Input
                type="number"
                min="1"
                max="100"
                value={thresholdPercent}
                onChange={(e) => handlePercentChange(parseInt(e.target.value) || 0)}
                style={{
                  borderColor: palette.accent,
                  backgroundColor: palette.background,
                  color: palette.text,
                }}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold" style={{ color: palette.text }}>
              Limite em Quantidade
            </Label>
            <div className="mt-2">
              <Input
                type="number"
                min="1"
                max={maxStock}
                value={thresholdQuantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                style={{
                  borderColor: palette.accent,
                  backgroundColor: palette.background,
                  color: palette.text,
                }}
              />
              <p style={{ color: palette.textSecondary }} className="text-xs mt-1">
                Alerta será disparado quando estoque cair para {thresholdQuantity} unidades ou menos
              </p>
            </div>
          </div>
        </div>

        {/* Preset Thresholds */}
        <div>
          <Label className="text-sm font-semibold mb-2 block" style={{ color: palette.text }}>
            Presets Recomendados
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Baixo (10%)', value: 10 },
              { label: 'Médio (20%)', value: 20 },
              { label: 'Alto (30%)', value: 30 },
              { label: 'Crítico (5%)', value: 5 },
            ].map((preset) => (
              <motion.button
                key={preset.value}
                whileHover={{ scale: 1.05 }}
                onClick={() => handlePercentChange(preset.value)}
                className="p-2 rounded-lg border-2 transition-all text-sm font-medium"
                style={{
                  borderColor:
                    thresholdPercent === preset.value
                      ? palette.primary
                      : palette.accent,
                  backgroundColor:
                    thresholdPercent === preset.value
                      ? `${palette.primary}20`
                      : palette.surface,
                  color:
                    thresholdPercent === preset.value
                      ? palette.primary
                      : palette.text,
                }}
              >
                {preset.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: `${palette.accent}10` }}>
          <div>
            <p className="font-semibold" style={{ color: palette.text }}>
              Alerta Ativo
            </p>
            <p style={{ color: palette.textSecondary }} className="text-sm">
              Receber notificações quando estoque cair abaixo do limite
            </p>
          </div>
          <button
            onClick={() => setIsActive(!isActive)}
            className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors"
            style={{
              backgroundColor: isActive ? palette.primary : palette.accent,
            }}
          >
            <span
              className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform"
              style={{
                transform: isActive ? 'translateX(1.75rem)' : 'translateX(0.25rem)',
              }}
            />
          </button>
        </div>

        {/* Save Button */}
        <Button
          onClick={() => {
            // TODO: Save configuration
          }}
          className="w-full"
          style={{
            backgroundColor: palette.primary,
            color: palette.surface,
          }}
        >
          <Save className="w-4 h-4 mr-2" />
          Salvar Configuração
        </Button>

        {/* Info Box */}
        <div
          className="p-4 rounded-lg border-2"
          style={{
            borderColor: palette.accent,
            backgroundColor: `${palette.accent}10`,
          }}
        >
          <p style={{ color: palette.text }} className="text-sm font-semibold mb-2">
            💡 Dica
          </p>
          <p style={{ color: palette.textSecondary }} className="text-sm">
            Configure limites diferentes para cada produto baseado na frequência de uso e tempo de reposição. Produtos de alto consumo devem ter limites mais altos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
