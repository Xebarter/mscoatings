import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { bindOfflineSync } from '@/lib/offline/sync';
import { warmOfflineCache } from '@/lib/firestore';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/Login';
import PendingApprovalPage from '@/pages/PendingApproval';
import DashboardPage from '@/pages/Dashboard';
import POSPage from '@/pages/POS';
import ProductsPage from '@/pages/Products';
import ProductEditPage from '@/pages/ProductEdit';
import InventoryPage from '@/pages/Inventory';
import OrdersPage from '@/pages/Orders';
import OrderDetailPage from '@/pages/OrderDetail';
import SaleDetailPage from '@/pages/SaleDetail';
import FieldSalesPage from '@/pages/FieldSales';
import FieldPickDetailPage from '@/pages/FieldPickDetail';
import FieldAgentDetailPage from '@/pages/FieldAgentDetail';
import ReportsPage from '@/pages/Reports';
import MessagesPage from '@/pages/Messages';
import ExpensesPage from '@/pages/Expenses';
import CreditPage from '@/pages/Credit';
import CreditCustomerDetailPage from '@/pages/CreditCustomerDetail';
import LoadingSpinner from '@/components/LoadingSpinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, hasAccess, accessStatus, loading } = useAuth();
  const online = useOnline();

  useEffect(() => {
    if (user && hasAccess && online) {
      void warmOfflineCache();
    }
  }, [user, hasAccess, online]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (accessStatus === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (!hasAccess) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  useEffect(() => bindOfflineSync(), []);

  return (
    <HashRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            background: '#0f172a',
            color: '#fff',
            fontSize: '14px',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pending" element={<PendingApprovalPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductEditPage />} />
          <Route path="products/:id" element={<ProductEditPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="sales/:id" element={<SaleDetailPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="field-sales" element={<FieldSalesPage />} />
          <Route path="field-sales/picks/:id" element={<FieldPickDetailPage />} />
          <Route path="field-sales/agents/:id" element={<FieldAgentDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="credit" element={<CreditPage />} />
          <Route path="credit/:id" element={<CreditCustomerDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
