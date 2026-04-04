'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Package, 
  ShoppingCart, 
  ArrowRightLeft, 
  BarChart3,
  MapPin,
  Users,
  Settings,
  CheckCircle
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  features: string[];
  route?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao GastronomOS!',
    description: 'Sistema completo para gestão do seu restaurante. Vamos fazer um tour rápido.',
    icon: CheckCircle,
    features: [
      'Gestão de estoque',
      'Controle de compras',
      'Transferências entre locais',
      'Análises e relatórios'
    ]
  },
  {
    id: 'inventory',
    title: 'Estoque',
    description: 'Controle total do inventário com sistema ESTOQUE → COZINHA.',
    icon: Package,
    features: [
      'Produtos organizados',
      'Níveis em tempo real',
      'Alertas de estoque baixo',
      'Sistema ESTOQUE → COZINHA'
    ],
    route: '/inventory'
  },
  {
    id: 'purchasing',
    title: 'Compras',
    description: 'Gerencie pedidos, fornecedores e recibos.',
    icon: ShoppingCart,
    features: [
      'Pedidos digitais',
      'Cadastro de fornecedores',
      'Processamento de recibos',
      'Histórico completo'
    ],
    route: '/purchasing'
  },
  {
    id: 'transfers',
    title: 'Transferências',
    description: 'Transfira itens entre ESTOQUE e COZINHA com rastreamento.',
    icon: ArrowRightLeft,
    features: [
      'Transferências programadas',
      'Rastreamento em tempo real',
      'Transferências de emergência',
      'Histórico detalhado'
    ],
    route: '/transfers'
  },
  {
    id: 'analytics',
    title: 'Análises',
    description: 'Insights para decisões baseadas em dados.',
    icon: BarChart3,
    features: [
      'Análise de desempenho',
      'Controle de custos',
      'Relatórios de variação',
      'Métricas em tempo real'
    ],
    route: '/analytics'
  },
  {
    id: 'locations',
    title: 'Locais',
    description: 'Configure e gerencie os locais do restaurante.',
    icon: MapPin,
    features: [
      'ESTOQUE (Depósito)',
      'COZINHA (Produção)',
      'Gestão de funcionários',
      'Controle por local'
    ],
    route: '/locations'
  }
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingTour({ isOpen, onClose, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isCompleting, setIsCompleting] = React.useState(false);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    // Mark onboarding as completed in localStorage
    localStorage.setItem('gastronomos-onboarding-completed', 'true');
    
    setTimeout(() => {
      onComplete();
      setIsCompleting(false);
    }, 1000);
  };

  const handleSkip = () => {
    localStorage.setItem('gastronomos-onboarding-completed', 'true');
    onClose();
  };

  const currentStepData = onboardingSteps[currentStep];
  const Icon = currentStepData.icon;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl"
        >
          <Card className="relative">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline">
                        Passo {currentStep + 1} de {onboardingSteps.length}
                      </Badge>
                      <div className="flex space-x-1">
                        {onboardingSteps.map((_, index) => (
                          <div
                            key={index}
                            className={`h-2 w-2 rounded-full ${
                              index <= currentStep ? 'bg-orange-500' : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="text-slate-600 text-lg leading-relaxed">
                {currentStepData.description}
              </p>

              <div className="space-y-3">
                <h4 className="font-medium text-slate-900">Recursos:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {currentStepData.features.map((feature, index) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center space-x-2"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="text-slate-600"
                  >
                    Pular
                  </Button>
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Anterior
                    </Button>
                  )}
                </div>

                <Button
                  onClick={handleNext}
                  disabled={isCompleting}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  {isCompleting ? (
                    'Finalizando...'
                  ) : currentStep === onboardingSteps.length - 1 ? (
                    'Começar!'
                  ) : (
                    <>
                      Próximo
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}