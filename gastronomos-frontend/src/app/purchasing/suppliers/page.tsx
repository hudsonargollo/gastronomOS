'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Plus, Phone, Mail, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

const suppliers = [
  { 
    id: 1, 
    name: 'Fresh Produce Co.', 
    category: 'Vegetables & Fruits', 
    rating: 4.8, 
    orders: 45, 
    status: 'active',
    contact: '+1 (555) 123-4567',
    email: 'orders@freshproduce.com',
    location: 'Downtown Market District'
  },
  { 
    id: 2, 
    name: 'Meat Masters Ltd.', 
    category: 'Meat & Poultry', 
    rating: 4.9, 
    orders: 32, 
    status: 'active',
    contact: '+1 (555) 987-6543',
    email: 'sales@meatmasters.com',
    location: 'Industrial Food Hub'
  },
  { 
    id: 3, 
    name: 'Dairy Direct', 
    category: 'Dairy Products', 
    rating: 4.6, 
    orders: 28, 
    status: 'active',
    contact: '+1 (555) 456-7890',
    email: 'info@dairydirect.com',
    location: 'Suburban Distribution Center'
  },
  { 
    id: 4, 
    name: 'Spice World', 
    category: 'Spices & Seasonings', 
    rating: 4.7, 
    orders: 18, 
    status: 'inactive',
    contact: '+1 (555) 321-0987',
    email: 'contact@spiceworld.com',
    location: 'Specialty Foods District'
  },
];

export default function SuppliersPage() {
  return (
    <MainLayout title="Suppliers">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
            <p className="text-slate-600">Manage your supplier relationships</p>
          </div>
          <Button className="bg-gradient-to-r from-orange-500 to-red-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Truck className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">3</p>
                  <p className="text-sm text-slate-600">Active Suppliers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Receipt className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">123</p>
                  <p className="text-sm text-slate-600">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.TrendingUp className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">4.8</p>
                  <p className="text-sm text-slate-600">Avg Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.ChartPie className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">$45K</p>
                  <p className="text-sm text-slate-600">Monthly Spend</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {suppliers.map((supplier, index) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{supplier.name}</CardTitle>
                      <p className="text-sm text-slate-600">{supplier.category}</p>
                    </div>
                    <Badge 
                      variant={supplier.status === 'active' ? 'default' : 'secondary'}
                      className={supplier.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                    >
                      {supplier.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < Math.floor(supplier.rating) ? 'text-yellow-400' : 'text-gray-300'}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-sm text-slate-600">{supplier.rating}</span>
                    </div>
                    <span className="text-sm text-slate-600">{supplier.orders} orders</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Phone className="h-4 w-4" />
                      <span>{supplier.contact}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Mail className="h-4 w-4" />
                      <span>{supplier.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4" />
                      <span>{supplier.location}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      New Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}