import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { mockChartData } from '../data/mockData';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';

const Reports = () => {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.reports')}</h1>
            <p className="text-gray-500 mt-1">Analyses et rapports détaillés</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Exporter rapport
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Chiffre d'affaires</p>
            <p className="text-2xl font-bold text-gray-900">801,000 TND</p>
            <div className="flex items-center gap-1 text-green-600 text-sm mt-2">
              <TrendingUp className="w-4 h-4" />
              <span>+15.3%</span>
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Marge brute</p>
            <p className="text-2xl font-bold text-blue-600">245,000 TND</p>
            <div className="flex items-center gap-1 text-green-600 text-sm mt-2">
              <TrendingUp className="w-4 h-4" />
              <span>+8.2%</span>
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Dépenses</p>
            <p className="text-2xl font-bold text-orange-600">53,050 TND</p>
            <div className="flex items-center gap-1 text-red-600 text-sm mt-2">
              <TrendingDown className="w-4 h-4" />
              <span>+12.5%</span>
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Bénéfice net</p>
            <p className="text-2xl font-bold text-green-600">191,950 TND</p>
            <div className="flex items-center gap-1 text-green-600 text-sm mt-2">
              <TrendingUp className="w-4 h-4" />
              <span>+18.7%</span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution du chiffre d'affaires</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockChartData.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Répartition des dépenses</h3>
            <div className="flex items-center justify-between">
              <div className="w-56 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockChartData.expenseCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {mockChartData.expenseCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {mockChartData.expenseCategories.map((category, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: category.color }}></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 truncate">{category.category}</p>
                    </div>
                    <p className="text-sm font-semibold">{category.value}%</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Comparaison mensuelle</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={mockChartData.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Reports;