import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spin } from 'antd';

const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role)) {
    // Redirect based on user role
    if (user?.role === 'contractor_admin') {
      return <Navigate to="/dashboard" replace />;
    }
    if (user?.role === 'business_admin') {
      return <Navigate to="/coming-soon" replace />;
    }
    // If not authorized and not a known role, go to login
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default RoleProtectedRoute;
