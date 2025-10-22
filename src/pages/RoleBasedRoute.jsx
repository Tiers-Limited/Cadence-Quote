import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';


const RoleBasedRoute = ({ allowedRoles = ['contractor_admin'], children }) => {
  const { isAuthenticated, user } = useAuth();

  console.log('User Role:', user?.role, isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return userRole === 'business_admin' ? (
      <Navigate to="/coming-soon" replace />
    ) : (
      <Navigate to="/login" replace />
    );
  }

  return children ? children : <Outlet />;
};

export default RoleBasedRoute;