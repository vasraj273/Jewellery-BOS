import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateQuotation from './pages/CreateQuotation.jsx';
import QuotationHistory from './pages/QuotationHistory.jsx';
import QuotationPreview from './pages/QuotationPreview.jsx';
import Login from './pages/Login.jsx';
import RequireAuth from './auth/RequireAuth.jsx';

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
      { path: 'quotations/:quoteId',      element: <QuotationPreview /> }
    ]
  }
]);
