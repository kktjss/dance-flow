import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Home from './pages/Home';
import ChoreographyBuilder from './pages/ChoreographyBuilder';
import TeamManagement from './pages/TeamManagement';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Dashboard from './pages/Dashboard';
import AuthHome from './pages/AuthHome';
import ChoreographyConstructor from './components/ChoreographyConstructor';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

// Простой компонент для защиты маршрутов
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('token');

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    return children;
};

// Компонент для перенаправления авторизованных пользователей
const PublicRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('token');

    if (isAuthenticated) {
        return <Navigate to="/auth-home" />;
    }

    return children;
};

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <PublicRoute>
                                <Home />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/auth-home"
                        element={
                            <ProtectedRoute>
                                <AuthHome />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <Login />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/register"
                        element={
                            <PublicRoute>
                                <Register />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/builder"
                        element={
                            <ProtectedRoute>
                                <ChoreographyBuilder />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teams"
                        element={
                            <ProtectedRoute>
                                <TeamManagement />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/constructor"
                        element={
                            <ProtectedRoute>
                                <ChoreographyConstructor />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </Router>
        </ThemeProvider>
    );
}

export default App; 