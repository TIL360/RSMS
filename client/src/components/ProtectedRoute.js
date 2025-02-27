import React, { useContext } from 'react'; 
import { Navigate } from 'react-router-dom'; 
import userContext from './context/UserContext';

const ProtectedRoute = ({ children }) => { 
    const { token } = useContext(userContext);
  

    return token ? children : <Navigate to="/login" />;
};


export default ProtectedRoute;