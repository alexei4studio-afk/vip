import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ClientProvider, useClient } from './contexts/ClientContext';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';

function ProtectedDashboard() {
  const { clientId: urlClientId } = useParams<{ clientId: string }>();
  const { isAuthenticated, clientId } = useClient();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (urlClientId !== clientId) {
    return <Navigate to={`/dashboard/${clientId}`} replace />;
  }

  return <DashboardPage />;
}

function App() {
  return (
    <ClientProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard/:clientId" element={<ProtectedDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ClientProvider>
  );
}

export default App;
