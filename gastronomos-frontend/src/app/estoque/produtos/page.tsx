'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Eye, EyeOff, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from '@/hooks/use-translations';
import { useTheme } from '@/contexts/theme-context';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId?: string;
  preparationTime: number;
  imageUrl?: string;
  isAvailable: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export default function ProductsPage() {
  const { t } = useTranslations();
  const { palette } = useTheme();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    preparationTime: '15',
    imageUrl: '',
  });

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(t('pages.products.notAuthenticated'));
        setLoading(false);
        return;
      }

      const response = await fetch('/api/menu', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch menu items: ${response.status}`);
      }
      
      const data = await response.json();
      setMenuItems(data.items || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error(t('pages.products.failedToLoadMenuItems'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price) {
      toast.error(t('pages.products.pleaseEnterNameAndPrice'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(t('pages.products.notAuthenticated'));
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        price: Math.round(parseFloat(formData.price) * 100),
        preparationTime: parseInt(formData.preparationTime),
        imageUrl: formData.imageUrl || undefined,
      };

      const url = editingItem ? `/api/menu/${editingItem.id}` : '/api/menu';
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save menu item');
      }

      toast.success(editingItem ? t('pages.products.menuItemUpdated') : t('pages.products.menuItemCreated'));
      setShowForm(false);
      setEditingItem(null);
      setFormData({ name: '', description: '', price: '', preparationTime: '15', imageUrl: '' });
      fetchMenuItems();
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast.error(error instanceof Error ? error.message : t('pages.products.failedToSaveMenuItem'));
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: (item.price / 100).toString(),
      preparationTime: item.preparationTime.toString(),
      imageUrl: item.imageUrl || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm(t('pages.products.confirmDelete'))) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/menu/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete menu item');

      toast.success(t('pages.products.menuItemDeleted'));
      fetchMenuItems();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      toast.error(t('pages.products.failedToDeleteMenuItem'));
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/menu/${item.id}/availability`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isAvailable: !item.isAvailable,
          reason: item.isAvailable ? 'Manually disabled' : 'Manually enabled',
        }),
      });

      if (!response.ok) throw new Error('Failed to update availability');

      toast.success(item.isAvailable ? t('pages.products.itemMarkedUnavailable') : t('pages.products.itemMarkedAvailable'));
      fetchMenuItems();
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error(t('pages.products.failedToUpdateAvailability'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: palette.text }}>{t('pages.products.title')}</h1>
            <p className="mt-1" style={{ color: palette.textSecondary }}>{t('pages.products.subtitle')}</p>
          </div>
          <Button
            onClick={() => {
              setEditingItem(null);
              setFormData({ name: '', description: '', price: '', preparationTime: '15', imageUrl: '' });
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2"
            style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}
          >
            <Plus className="w-4 h-4" />
            {showForm ? t('pages.products.cancel') : t('pages.products.addItem')}
          </Button>
        </div>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
              <CardHeader>
                <CardTitle style={{ color: palette.text }}>{editingItem ? t('pages.products.editMenuItem') : t('pages.products.createNewMenuItem')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                        {t('pages.products.itemName')} *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          backgroundColor: palette.background,
                          color: palette.text,
                          borderColor: palette.border,
                        } as React.CSSProperties}
                        placeholder="ex: Pasta Carbonara"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                        {t('pages.products.price')} *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          backgroundColor: palette.background,
                          color: palette.text,
                          borderColor: palette.border,
                        } as React.CSSProperties}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                      {t('pages.products.description')}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                      style={{
                        backgroundColor: palette.background,
                        color: palette.text,
                        borderColor: palette.border,
                      } as React.CSSProperties}
                      placeholder={t('forms.placeholders.enterDescription')}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                        {t('pages.products.preparationTime')}
                      </label>
                      <input
                        type="number"
                        value={formData.preparationTime}
                        onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          backgroundColor: palette.background,
                          color: palette.text,
                          borderColor: palette.border,
                        } as React.CSSProperties}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                        {t('pages.products.imageUrl')}
                      </label>
                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          backgroundColor: palette.background,
                          color: palette.text,
                          borderColor: palette.border,
                        } as React.CSSProperties}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}
                    >
                      {editingItem ? t('pages.products.updateItem') : t('pages.products.createItem')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingItem(null);
                      }}
                    >
                      {t('pages.products.cancel')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin" style={{ color: palette.primary }} />
          </div>
        ) : menuItems.length === 0 ? (
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardContent className="pt-6">
              <p className="text-center" style={{ color: palette.textSecondary }}>
                {t('pages.products.noMenuItems')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                  {item.imageUrl && (
                    <div className="h-40 overflow-hidden rounded-t-lg" style={{ backgroundColor: palette.background }}>
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold" style={{ color: palette.text }}>{item.name}</h3>
                          <Badge
                            style={{
                              backgroundColor: item.isAvailable ? palette.accent : palette.destructive,
                              color: item.isAvailable ? palette.text : palette.primaryForeground,
                            }}
                          >
                            {item.isAvailable ? t('pages.products.available') : t('pages.products.unavailable')}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-sm line-clamp-2" style={{ color: palette.textSecondary }}>
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: palette.textSecondary }}>
                          {item.preparationTime} {t('pages.products.min')}
                        </span>
                        <span className="font-semibold" style={{ color: palette.primary }}>
                          R$ {(item.price / 100).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleAvailability(item)}
                          className="flex-1 flex items-center justify-center gap-1"
                        >
                          {item.isAvailable ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              {t('pages.products.hide')}
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              {t('pages.products.show')}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(item)}
                          className="flex-1 flex items-center justify-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          {t('pages.products.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(item.id)}
                          className="flex-1 flex items-center justify-center gap-1"
                          style={{ color: palette.destructive }}
                        >
                          <Trash2 className="w-3 h-3" />
                          {t('pages.products.delete')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
