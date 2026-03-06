export const mockCustomers = [
  { id: 1, name: 'Club Africain', email: 'contact@clubafricain.tn', phone: '+216 71 123 456', address: 'Tunis, Tunisia', balance: 15420.50, invoices: 12 },
  { id: 2, name: 'TRID SARL', email: 'contact@trid.tn', phone: '+216 70 234 567', address: 'Sfax, Tunisia', balance: 8900.00, invoices: 8 },
  { id: 3, name: 'BluePrinters Lab', email: 'info@blueprinters.com', phone: '+216 98 345 678', address: 'Sousse, Tunisia', balance: 0, invoices: 15 },
  { id: 4, name: 'SBS Consulting', email: 'contact@sbs.tn', phone: '+216 52 456 789', address: 'Tunis, Tunisia', balance: 23500.75, invoices: 20 },
  { id: 5, name: 'B&G Services', email: 'info@bg-services.tn', phone: '+216 25 567 890', address: 'Bizerte, Tunisia', balance: 5600.00, invoices: 6 },
  { id: 6, name: 'GeoPRO Solutions', email: 'contact@geopro.tn', phone: '+216 98 678 901', address: 'Tunis, Tunisia', balance: 0, invoices: 10 }
];

export const mockSuppliers = [
  { id: 1, name: 'TechPro Distribution', email: 'sales@techpro.tn', phone: '+216 71 111 222', balance: 8500.00, orders: 15 },
  { id: 2, name: 'Office Supplies TN', email: 'info@officesupplies.tn', phone: '+216 70 222 333', balance: 3200.00, orders: 8 },
  { id: 3, name: 'Cloud Services SARL', email: 'billing@cloudservices.tn', phone: '+216 98 333 444', balance: 0, orders: 12 },
  { id: 4, name: 'Marketing Agency Plus', email: 'contact@marketingplus.tn', phone: '+216 52 444 555', balance: 15000.00, orders: 5 }
];

export const mockInvoices = [
  { id: 'INV-2024-001', customer: 'Club Africain', date: '2024-01-15', dueDate: '2024-02-15', amount: 15420.50, status: 'overdue', items: 3 },
  { id: 'INV-2024-002', customer: 'TRID SARL', date: '2024-01-20', dueDate: '2024-02-20', amount: 8900.00, status: 'paid', items: 2 },
  { id: 'INV-2024-003', customer: 'BluePrinters Lab', date: '2024-01-22', dueDate: '2024-02-22', amount: 12500.00, status: 'sent', items: 4 },
  { id: 'INV-2024-004', customer: 'SBS Consulting', date: '2024-01-25', dueDate: '2024-02-25', amount: 23500.75, status: 'partial', items: 5 },
  { id: 'INV-2024-005', customer: 'B&G Services', date: '2024-01-28', dueDate: '2024-02-28', amount: 5600.00, status: 'draft', items: 2 },
  { id: 'INV-2024-006', customer: 'GeoPRO Solutions', date: '2024-01-30', dueDate: '2024-03-01', amount: 18900.00, status: 'sent', items: 6 }
];

export const mockQuotes = [
  { id: 'QUO-2024-001', customer: 'Club Africain', date: '2024-01-10', validUntil: '2024-02-10', amount: 25000.00, status: 'sent', items: 4 },
  { id: 'QUO-2024-002', customer: 'TRID SARL', date: '2024-01-12', validUntil: '2024-02-12', amount: 18500.00, status: 'accepted', items: 3 },
  { id: 'QUO-2024-003', customer: 'SBS Consulting', date: '2024-01-18', validUntil: '2024-02-18', amount: 32000.00, status: 'draft', items: 5 },
  { id: 'QUO-2024-004', customer: 'GeoPRO Solutions', date: '2024-01-25', validUntil: '2024-02-25', amount: 15600.00, status: 'sent', items: 3 }
];

export const mockProducts = [
  { id: 1, name: 'Consultation Stratégique', sku: 'CONS-001', category: 'Services', price: 1500.00, stock: null, unit: 'Heure' },
  { id: 2, name: 'Développement Web', sku: 'DEV-001', category: 'Services', price: 800.00, stock: null, unit: 'Heure' },
  { id: 3, name: 'Design Graphique', sku: 'DESIGN-001', category: 'Services', price: 600.00, stock: null, unit: 'Heure' },
  { id: 4, name: 'Licence Logiciel Pro', sku: 'LIC-001', category: 'Produits', price: 4500.00, stock: 50, unit: 'Unité' },
  { id: 5, name: 'Formation en Groupe', sku: 'FORM-001', category: 'Services', price: 2500.00, stock: null, unit: 'Journée' },
  { id: 6, name: 'Support Technique', sku: 'SUP-001', category: 'Services', price: 450.00, stock: null, unit: 'Heure' },
  { id: 7, name: 'Hébergement Cloud', sku: 'HOST-001', category: 'Produits', price: 890.00, stock: 100, unit: 'Mois' },
  { id: 8, name: 'Maintenance Annuelle', sku: 'MAINT-001', category: 'Services', price: 12000.00, stock: null, unit: 'Contrat' }
];

export const mockPurchases = [
  { id: 'PUR-2024-001', supplier: 'TechPro Distribution', date: '2024-01-05', dueDate: '2024-02-05', amount: 8500.00, status: 'paid', items: 5 },
  { id: 'PUR-2024-002', supplier: 'Office Supplies TN', date: '2024-01-12', dueDate: '2024-02-12', amount: 3200.00, status: 'overdue', items: 8 },
  { id: 'PUR-2024-003', supplier: 'Cloud Services SARL', date: '2024-01-18', dueDate: '2024-02-18', amount: 5600.00, status: 'paid', items: 2 },
  { id: 'PUR-2024-004', supplier: 'Marketing Agency Plus', date: '2024-01-25', dueDate: '2024-02-25', amount: 15000.00, status: 'pending', items: 4 }
];

export const mockExpenses = [
  { id: 'EXP-2024-001', category: 'Salaires et charges', amount: 45000.00, date: '2024-01-31', supplier: 'Administration Fiscale', recurring: true },
  { id: 'EXP-2024-002', category: 'Loyer', amount: 3500.00, date: '2024-01-01', supplier: 'Immobilière Tunis', recurring: true },
  { id: 'EXP-2024-003', category: 'Charges Automobile', amount: 850.00, date: '2024-01-15', supplier: 'Station Service', recurring: false },
  { id: 'EXP-2024-004', category: 'Honoraires', amount: 2500.00, date: '2024-01-20', supplier: 'Cabinet Comptable', recurring: false },
  { id: 'EXP-2024-005', category: 'Frais de Déplacement', amount: 1200.00, date: '2024-01-22', supplier: 'Divers', recurring: false }
];

export const mockProjects = [
  { id: 1, name: 'Refonte Site Web - Club Africain', customer: 'Club Africain', status: 'in-progress', budget: 25000.00, spent: 18500.00, hours: 120, startDate: '2024-01-01', endDate: '2024-03-31' },
  { id: 2, name: 'Application Mobile E-commerce', customer: 'TRID SARL', status: 'in-progress', budget: 45000.00, spent: 32000.00, hours: 280, startDate: '2023-12-01', endDate: '2024-02-28' },
  { id: 3, name: 'Système de Gestion Interne', customer: 'SBS Consulting', status: 'planning', budget: 65000.00, spent: 5000.00, hours: 40, startDate: '2024-02-01', endDate: '2024-06-30' },
  { id: 4, name: 'Campagne Marketing Digital', customer: 'B&G Services', status: 'completed', budget: 15000.00, spent: 14800.00, hours: 95, startDate: '2023-11-01', endDate: '2024-01-15' }
];

export const mockPayments = [
  { id: 'PAY-2024-001', invoice: 'INV-2024-002', customer: 'TRID SARL', amount: 8900.00, date: '2024-01-25', method: 'Virement bancaire' },
  { id: 'PAY-2024-002', invoice: 'INV-2024-004', customer: 'SBS Consulting', amount: 11750.00, date: '2024-01-28', method: 'Chèque' },
  { id: 'PAY-2024-003', invoice: 'INV-2024-003', customer: 'BluePrinters Lab', amount: 12500.00, date: '2024-01-30', method: 'Espèces' }
];

export const mockDashboardStats = {
  marginRate: { value: 100, change: 0, period: 'vs mois dernier' },
  marginNet: { value: 14.3, change: -2.1, period: 'vs mois dernier' },
  dso: { value: 21, change: 5, period: 'Jours' },
  renewal: { value: 89.2, change: 3.5, period: 'vs mois dernier' },
  invoices: { amount: 290000, count: 48, paid: 250000 },
  quotes: { amount: 55000, count: 12 },
  deliveryNotes: { count: 0 },
  paymentsReceived: { amount: 255000, count: 35 },
  paymentsSent: { amount: 12000, count: 8 },
  unpaidInvoices: { amount: 722000, count: 145 }
};

export const mockChartData = {
  monthlyRevenue: [
    { month: 'Jan', value: 45000 },
    { month: 'Fév', value: 52000 },
    { month: 'Mar', value: 48000 },
    { month: 'Avr', value: 61000 },
    { month: 'Mai', value: 55000 },
    { month: 'Juin', value: 67000 },
    { month: 'Juil', value: 72000 },
    { month: 'Aoû', value: 58000 },
    { month: 'Sep', value: 79000 },
    { month: 'Oct', value: 85000 },
    { month: 'Nov', value: 91000 },
    { month: 'Déc', value: 88000 }
  ],
  expenseCategories: [
    { category: 'Salaires Et Salaires Des Emplo...', value: 45, color: '#10b981' },
    { category: 'Administration Fiscale', value: 20, color: '#3b82f6' },
    { category: 'Charges Automobile', value: 15, color: '#f59e0b' },
    { category: 'Honoraires', value: 12, color: '#ef4444' },
    { category: 'Frais De Déplacement', value: 8, color: '#8b5cf6' }
  ]
};