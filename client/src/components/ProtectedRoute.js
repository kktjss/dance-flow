import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CircularProgress, Box } from '@mui/material';

/**
 * Компонент для защиты маршрутов от неавторизованных пользователей
 * @param {Object} props - пропсы компонента
 * @param {React.ReactNode} props.children - дочерние компоненты
 * @param {string} props.redirectPath - путь для перенаправления неавторизованных пользователей
 * @param {string} props.requiredRole - роль, необходимая для доступа к маршруту
 * @returns {React.ReactElement} - защищенный компонент или редирект
 */
const ProtectedRoute = ({ children, redirectPath = '/login', requiredRole = null }) => {
    const { isAuthenticated, isLoading, user } = useSelector(state => state.auth);

    // Показываем индикатор загрузки, пока проверяем аутентификацию
    if (isLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh'
                }}
                data-testid="auth-loading"
            >
                <CircularProgress />
            </Box>
        );
    }

    // Проверяем аутентификацию
    if (!isAuthenticated) {
        return <Navigate to={redirectPath} replace />;
    }

    // Проверяем роль, если она требуется
    if (requiredRole && (!user || user.role !== requiredRole)) {
        return <Navigate to="/" replace />;
    }

    // Пользователь аутентифицирован и имеет необходимую роль
    return children;
};

export default ProtectedRoute; 