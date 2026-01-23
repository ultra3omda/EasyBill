import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { mockDashboardStats, mockChartData } from '../data/mockData';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  FileInput,
  Truck,
  DollarSign,
  CreditCard,
  AlertCircle,
  Filter
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const Dashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const stats = [
    {
      label: t('dashboard.marginRate'),
      value: `${mockDashboardStats.marginRate.value}%`,
      change: mockDashboardStats.marginRate.change,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      icon: TrendingUp
    },
    {
      label: t('dashboard.marginRate2'),
      value: `${mockDashboardStats.marginNet.value}%`,
      change: mockDashboardStats.marginNet.change,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: TrendingDown
    },
    {
      label: t('dashboard.dso'),
      value: mockDashboardStats.dso.value,
      change: mockDashboardStats.dso.change,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      icon: FileText
    },
    {
      label: t('dashboard.renewal'),
      value: `${mockDashboardStats.renewal.value}%`,
      change: mockDashboardStats.renewal.change,
      bgColor: 'bg-teal-50',
      iconColor: 'text-teal-600',
      icon: TrendingUp
    }
  ];

  const businessMetrics = [
    {
      label: t('dashboard.invoices'),
      amount: `${(mockDashboardStats.invoices.amount / 1000).toFixed(0)}k+`,
      subtitle: `TND ${mockDashboardStats.invoices.paid.toLocaleString()} TND`,
      icon: FileText,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      label: t('dashboard.quotes'),
      amount: `${(mockDashboardStats.quotes.amount / 1000).toFixed(0)}k+`,
      subtitle: `TND ${mockDashboardStats.quotes.count} ${t('dashboard.quotes').toLowerCase()}`,
      icon: FileInput,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600'
    },
    {
      label: t('dashboard.deliveryNotes'),
      amount: '0',
      subtitle: 'TND 0.000 TND',
      icon: Truck,
      bgColor: 'bg-gray-50',
      iconColor: 'text-gray-600'
    }
  ];

  const paymentMetrics = [
    {
      label: t('dashboard.paymentsReceived'),
      amount: `${(mockDashboardStats.paymentsReceived.amount / 1000).toFixed(0)}k+`,
      subtitle: 'TND',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      label: t('dashboard.paymentsSent'),
      amount: `${(mockDashboardStats.paymentsSent.amount / 1000).toFixed(0)}k+`,
      subtitle: 'TND',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600'
    },
    {
      label: t('dashboard.unpaidInvoices'),
      amount: `${(mockDashboardStats.unpaidInvoices.amount / 1000).toFixed(0)}k+`,
      subtitle: 'TND',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('dashboard.welcome')}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-gray-500 mt-1">Iberis</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {t('dashboard.filter')}
          </Button>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className={`p-6 ${stat.bgColor} border-none`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                  <span className="text-xs text-gray-600">CA - Cob marchandise</span>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  {stat.change !== undefined && (
                    <div className="flex items-center gap-1 text-xs">
                      {stat.change > 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-600" />
                      )}
                      <span className={stat.change > 0 ? 'text-green-600' : 'text-red-600'}>
                        {Math.abs(stat.change)}%
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Business Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {businessMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card key={index} className="p-6 border-l-4 border-l-teal-500">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                    <Icon className={`w-5 h-5 ${metric.iconColor}`} />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
                <p className="text-2xl font-bold text-gray-900 mb-1">{metric.amount}</p>
                <p className="text-xs text-gray-500">{metric.subtitle}</p>
              </Card>
            );
          })}
        </div>

        {/* Payment Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paymentMetrics.map((metric, index) => (
            <Card key={index} className={`p-6 ${metric.bgColor}`}>
              <p className="text-sm text-gray-600 mb-2">{metric.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900">{metric.amount}</p>
                <p className="text-sm text-gray-500">{metric.subtitle}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.accountingExercise')}</h3>
                <p className="text-sm text-gray-500">2024-01-01 - 2024-12-31</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mockChartData.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Expense Categories */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Principales Catégories De Dépenses</h3>
            <div className="flex items-center justify-between">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockChartData.expenseCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
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
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-700 truncate">{category.category}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{category.value}%</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Comparative Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.comparative')}</h3>
            <p className="text-sm text-gray-500">2024/2025</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
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

export default Dashboard;