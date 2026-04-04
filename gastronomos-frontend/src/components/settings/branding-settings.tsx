'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useBranding } from '@/contexts/branding-context';
import { 
  Palette, 
  Upload, 
  X, 
  Check,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export function BrandingSettings() {
  const { 
    branding, 
    updateBranding, 
    applyColorPalette, 
    uploadLogo, 
    removeLogo, 
    resetToDefaults,
    availablePalettes 
  } = useBranding();

  const [businessName, setBusinessName] = React.useState(branding.businessName);
  const [selectedPalette, setSelectedPalette] = React.useState('orange');
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleBusinessNameChange = (name: string) => {
    setBusinessName(name);
    updateBranding({ businessName: name });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 2MB');
      return;
    }

    setIsUploading(true);
    try {
      await uploadLogo(file);
      toast.success('Logo carregado com sucesso!');
    } catch (error) {
      toast.error('Erro ao carregar logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    removeLogo();
    toast.success('Logo removido');
  };

  const handlePaletteChange = (paletteName: string) => {
    setSelectedPalette(paletteName);
    applyColorPalette(paletteName);
    toast.success(`Paleta de cores "${paletteName}" aplicada!`);
  };

  const handleReset = () => {
    resetToDefaults();
    setBusinessName('GastronomOS Demo');
    setSelectedPalette('orange');
    toast.success('Configurações de marca redefinidas');
  };

  const paletteNames: Record<string, string> = {
    orange: 'Laranja',
    blue: 'Azul',
    green: 'Verde',
    purple: 'Roxo',
    red: 'Vermelho',
  };

  return (
    <div className="space-y-6">
      {/* Business Name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5 text-blue-500" />
            <span>Identidade da Empresa</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Nome da Empresa</Label>
            <Input
              id="business-name"
              value={businessName}
              onChange={(e) => handleBusinessNameChange(e.target.value)}
              placeholder="Digite o nome da sua empresa"
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo da Empresa (Opcional)</Label>
            <div className="flex items-center space-x-4">
              {branding.logo ? (
                <div className="flex items-center space-x-3">
                  <div className="h-16 w-16 rounded-lg border-2 border-slate-200 overflow-hidden bg-white">
                    <img
                      src={branding.logo}
                      alt="Logo da empresa"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Alterar Logo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? 'Carregando...' : 'Carregar Logo'}
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5 text-purple-500" />
            <span>Paleta de Cores</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(availablePalettes).map(([name, palette]) => (
              <motion.div
                key={name}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  selectedPalette === name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => handlePaletteChange(name)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-slate-900">
                    {paletteNames[name]}
                  </span>
                  {selectedPalette === name && (
                    <Badge className="bg-blue-500">
                      <Check className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <div
                    className="h-8 w-8 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: palette.primary }}
                  />
                  <div
                    className="h-8 w-8 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: palette.secondary }}
                  />
                  <div
                    className="h-8 w-8 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: palette.accent }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Current Palette Preview */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-3">Prévia da Paleta Atual</h4>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-2">
                <div
                  className="h-10 w-10 rounded-lg border border-white shadow-sm"
                  style={{ backgroundColor: branding.colorPalette.primary }}
                />
                <div
                  className="h-10 w-10 rounded-lg border border-white shadow-sm"
                  style={{ backgroundColor: branding.colorPalette.secondary }}
                />
                <div
                  className="h-10 w-10 rounded-lg border border-white shadow-sm"
                  style={{ backgroundColor: branding.colorPalette.accent }}
                />
              </div>
              <div className="text-sm text-slate-600">
                <p>Primária: {branding.colorPalette.primary}</p>
                <p>Secundária: {branding.colorPalette.secondary}</p>
                <p>Destaque: {branding.colorPalette.accent}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-slate-900">Redefinir Configurações</h4>
              <p className="text-sm text-slate-600">
                Restaurar todas as configurações de marca para os valores padrão
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleReset}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Redefinir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}