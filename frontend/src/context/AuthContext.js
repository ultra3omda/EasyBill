import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved user in localStorage
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { access_token, user: userData } = response.data;
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', access_token);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async (tokenData) => {
    try {
      // tokenData peut contenir access_token (useGoogleLogin) ou credential (GoogleLogin)
      const payload = tokenData.access_token
        ? { access_token: tokenData.access_token }
        : { credential: tokenData.credential };
      const response = await authAPI.googleLogin(payload);
      
      const { access_token, user: userData } = response.data;
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', access_token);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const loginWithFacebook = async () => {
    try {
      // Mock Facebook OAuth for now - in production this would use actual Facebook OAuth
      const response = await authAPI.facebookLogin({ 
        access_token: 'mock_facebook_token_' + Date.now(),
        email: 'user@facebook.com',
        name: 'Facebook User',
        id: 'facebook_user_' + Date.now()
      });
      
      const { access_token, user: userData } = response.data;
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', access_token);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Facebook login error:', error);
      throw error;
    }
  };

  const register = async (name, email, password, company) => {
    try {
      const response = await authAPI.register({
        full_name: name,
        email,
        password,
        company_name: company
      });
      
      const { access_token, user: userData } = response.data;
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', access_token);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, loginWithFacebook, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};