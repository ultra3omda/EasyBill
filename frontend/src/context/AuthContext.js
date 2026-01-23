import React, { createContext, useState, useContext, useEffect } from 'react';

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
    // Mock login - will be replaced with real API call
    const mockUser = {
      id: '1',
      email: email,
      name: 'Chaibi Alaa',
      company: 'Iberis Demo',
      role: 'admin'
    };
    
    const mockToken = 'mock-jwt-token-' + Date.now();
    
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', mockToken);
    
    return { success: true, user: mockUser };
  };

  const loginWithGoogle = async () => {
    // Mock Google login - will be replaced with real OAuth
    const mockUser = {
      id: '2',
      email: 'user@gmail.com',
      name: 'Google User',
      company: 'Iberis Demo',
      role: 'admin',
      avatar: 'https://ui-avatars.com/api/?name=Google+User'
    };
    
    const mockToken = 'mock-google-token-' + Date.now();
    
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', mockToken);
    
    return { success: true, user: mockUser };
  };

  const register = async (name, email, password, company) => {
    // Mock registration - will be replaced with real API call
    const mockUser = {
      id: Date.now().toString(),
      email: email,
      name: name,
      company: company,
      role: 'admin'
    };
    
    const mockToken = 'mock-jwt-token-' + Date.now();
    
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', mockToken);
    
    return { success: true, user: mockUser };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};