import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';


const RoleBasedRoute = ({ allowedRoles = ['contractor_admin'], children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    // Redirect based on user role
    if (userRole === 'business_admin') {
      return <Navigate to="/coming-soon" replace />;
    }
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children ? children : <Outlet />;
};

export default RoleBasedRoute;