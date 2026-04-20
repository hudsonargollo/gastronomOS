'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/theme-context';
import { Calendar, Clock, DollarSign, Bell, Plus, Trash2 } from 'lucide-react';

interface PaymentScheduleItem {
  id: string;
  dueDate: string;
  amountCents: number;
  reminderDays: number;
  notes?: string;
}

interface PaymentSchedulerProps {
  totalAmountCents: number;
  onScheduleChange?: (schedules: PaymentScheduleItem[]) => void;
  isRecurring?: boolean;
  recurringFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
}

export function PaymentScheduler({
  totalAmountCents,
  onScheduleChange,
  isRecurring = false,
  recurringFrequency = 'MONTHLY',
}: PaymentSchedulerProps) {
  const { palette } = useTheme();
  const [schedules, setSchedules] = useState<PaymentScheduleItem[]>([
    {
      id: '1',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amountCents: totalAmountCents,
      reminderDays: 3,
    },
  ]);
  const [showAddSchedule, setShowAddSchedule] = useState(false);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const addSchedule = () => {
    const lastSchedule = schedules[schedules.length - 1];
    const newDate = new Date(lastSchedule.dueDate);
    newDate.setDate(newDate.getDate() + 30);

    const newSchedule: PaymentScheduleItem = {
      id: Date.now().toString(),
      dueDate: newDate.toISOString().split('T')[0],
      amountCents: Math.floor(totalAmountCents / 2),
      reminderDays: 3,
    };

    const updatedSchedules = [...schedules, newSchedule];
    setSchedules(updatedSchedules);
    onScheduleChange?.(updatedSchedules);
  };

  const removeSchedule = (id: string) => {
    const updatedSchedules = schedules.filter(s => s.id !== id);
    setSchedules(updatedSchedules);
    onScheduleChange?.(updatedSchedules);
  };

  const updateSchedule = (id: string, updates: Partial<PaymentScheduleItem>) => {
    const updatedSchedules = schedules.map(s =>
      s.id === id ? { ...s, ...updates } : s
    );
    setSchedules(updatedSchedules);
    onScheduleChange?.(updatedSchedules);
  };

  const totalScheduled = schedules.reduce((sum, s) => sum + s.amountCents, 0);
  const difference = totalAmountCents - totalScheduled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" style={{ color: palette.primary }} />
          Agendamento de Pagamentos
        </CardTitle>
        <CardDescription>
          Configure quando e quanto pagar para este fornecedor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recurring Payment Option */}
        {isRecurring && (
          <div
            className="p-4 rounded-lg border-2"
            style={{
              borderColor: palette.accent,
              backgroundColor: `${palette.accent}10`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" style={{ color: palette.primary }} />
              <p className="font-semibold" style={{ color: palette.text }}>
                Pagamento Recorrente
              </p>
            </div>
            <p style={{ color: palette.textSecondary }} className="text-sm">
              Este pagamento se repete {recurringFrequency === 'WEEKLY' ? 'semanalmente' : recurringFrequency === 'MONTHLY' ? 'mensalmente' : recurringFrequency === 'QUARTERLY' ? 'trimestralmente' : 'anualmente'}
            </p>
          </div>
        )}

        {/* Payment Schedules */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: palette.text }}>
              Parcelas ({schedules.length})
            </h3>
            <Badge variant="outline">
              Total: {formatCurrency(totalScheduled)}
            </Badge>
          </div>

          {schedules.map((schedule, index) => (
            <motion.div
              key={schedule.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border-2"
              style={{
                borderColor: palette.accent,
                backgroundColor: palette.surface,
              }}
            >
              <div className="space-y-4">
                {/* Schedule Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold" style={{ color: palette.text }}>
                      Parcela {index + 1}
                    </p>
                    <p style={{ color: palette.textSecondary }} className="text-sm">
                      Vencimento: {new Date(schedule.dueDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSchedule(schedule.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Schedule Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs" style={{ color: palette.textSecondary }}>
                      Data de Vencimento
                    </Label>
                    <Input
                      type="date"
                      value={schedule.dueDate}
                      onChange={(e) =>
                        updateSchedule(schedule.id, { dueDate: e.target.value })
                      }
                      className="mt-1"
                      style={{
                        borderColor: palette.accent,
                        backgroundColor: palette.background,
                        color: palette.text,
                      }}
                    />
                  </div>

                  <div>
                    <Label className="text-xs" style={{ color: palette.textSecondary }}>
                      Valor (R$)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(schedule.amountCents / 100).toFixed(2)}
                      onChange={(e) =>
                        updateSchedule(schedule.id, {
                          amountCents: Math.round(parseFloat(e.target.value) * 100),
                        })
                      }
                      className="mt-1"
                      style={{
                        borderColor: palette.accent,
                        backgroundColor: palette.background,
                        color: palette.text,
                      }}
                    />
                  </div>

                  <div>
                    <Label className="text-xs" style={{ color: palette.textSecondary }}>
                      Lembrete (dias antes)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      value={schedule.reminderDays}
                      onChange={(e) =>
                        updateSchedule(schedule.id, {
                          reminderDays: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1"
                      style={{
                        borderColor: palette.accent,
                        backgroundColor: palette.background,
                        color: palette.text,
                      }}
                    />
                  </div>

                  <div>
                    <Label className="text-xs" style={{ color: palette.textSecondary }}>
                      Notas (opcional)
                    </Label>
                    <Input
                      type="text"
                      placeholder="Ex: Desconto à vista"
                      value={schedule.notes || ''}
                      onChange={(e) =>
                        updateSchedule(schedule.id, { notes: e.target.value })
                      }
                      className="mt-1"
                      style={{
                        borderColor: palette.accent,
                        backgroundColor: palette.background,
                        color: palette.text,
                      }}
                    />
                  </div>
                </div>

                {/* Reminder Info */}
                <div
                  className="flex items-center gap-2 p-2 rounded text-sm"
                  style={{
                    backgroundColor: `${palette.primary}10`,
                    color: palette.primary,
                  }}
                >
                  <Bell className="w-4 h-4" />
                  <span>
                    Lembrete será enviado em{' '}
                    {new Date(
                      new Date(schedule.dueDate).getTime() -
                        schedule.reminderDays * 24 * 60 * 60 * 1000
                    ).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Schedule Button */}
        <Button
          onClick={addSchedule}
          variant="outline"
          className="w-full"
          style={{
            borderColor: palette.primary,
            color: palette.primary,
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Parcela
        </Button>

        {/* Summary */}
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: `${palette.accent}10`,
            borderColor: palette.accent,
            borderWidth: '1px',
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span style={{ color: palette.textSecondary }}>Valor Total:</span>
              <span
                className="font-semibold"
                style={{ color: palette.primary }}
              >
                {formatCurrency(totalAmountCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: palette.textSecondary }}>Agendado:</span>
              <span
                className="font-semibold"
                style={{ color: palette.primary }}
              >
                {formatCurrency(totalScheduled)}
              </span>
            </div>
            {difference !== 0 && (
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: palette.accent }}>
                <span style={{ color: palette.textSecondary }}>
                  {difference > 0 ? 'Faltam' : 'Excesso'}:
                </span>
                <span
                  className="font-semibold"
                  style={{
                    color: difference > 0 ? '#ea580c' : '#16a34a',
                  }}
                >
                  {formatCurrency(Math.abs(difference))}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
