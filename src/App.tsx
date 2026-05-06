/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import SplashScreen from './components/SplashScreen';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Groups from './pages/Groups';
import Profile from './pages/Profile';
import GroupDetail from './pages/GroupDetail';
import CreateGroup from './pages/CreateGroup';
import JoinGroup from './pages/JoinGroup';
import Layout from './components/Layout';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { Toaster } from 'react-hot-toast';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash once per session
    const isSplashShown = sessionStorage.getItem('splash_shown');
    return !isSplashShown;
  });

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('splash_shown', 'true');
  };

  return (
    <AuthProvider>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-100 selection:text-blue-900 transition-colors duration-300">
          <PWAInstallPrompt />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/join/:id" element={<JoinGroup />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/groups" element={<Groups />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/group/:id" element={<GroupDetail />} />
                      <Route path="/create-group" element={<CreateGroup />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
          <Toaster 
            position="bottom-center" 
            toastOptions={{
              className: 'dark:bg-gray-800 dark:text-white dark:border-gray-700',
              style: {
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '700'
              }
            }} 
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

