import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateQuotation from './pages/CreateQuotation.jsx';
import QuotationHistory from './pages/QuotationHistory.jsx';
import QuotationPreview from './pages/QuotationPreview.jsx';
import Login from './pages/Login.jsx';
import Leads from './pages/Leads.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import UsersAdmin from './pages/admin/Users.jsx';
import SettingsAdmin from './pages/admin/Settings.jsx';
import MastersAdmin from './pages/admin/Masters.jsx';
import GoldRatesAdmin from './pages/admin/GoldRates.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import RequireRole from './auth/RequireRole.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',                element: <Dashboard /> },
      { path: 'quotations/new',           element: <CreateQuotation /> },
      { path: 'quotations',               element: <QuotationHistory /> },
      { path: 'quotations/:quoteId',      element: <QuotationPreview /> },
      { path: 'leads',                    element: <Leads /> },
      { path: 'leads/:id',                element: <LeadDetail /> },
      { path: 'customers',                element: <Customers /> },
      { path: 'customers/:id',            element: <CustomerDetail /> },
      { path: 'admin/users',      element: <RequireRole roles={ADMIN_ROLES}><UsersAdmin /></RequireRole> },
      { path: 'admin/settings',   element: <RequireRole roles={ADMIN_ROLES}><SettingsAdmin /></RequireRole> },
      { path: 'admin/masters',    element: <RequireRole roles={ADMIN_ROLES}><MastersAdmin /></RequireRole> },
      { path: 'admin/gold-rates', element: <RequireRole roles={ADMIN_ROLES}><GoldRatesAdmin /></RequireRole> }
    ]
  }
]);
