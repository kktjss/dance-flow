import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    Container,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    boxShadow: 'none',
    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
}));

const StyledButton = styled(Button)(({ theme }) => ({
    marginLeft: theme.spacing(2),
    borderRadius: '20px',
    textTransform: 'none',
    fontWeight: 500,
}));

const NavButton = styled(Button)(({ theme, active }) => ({
    marginLeft: theme.spacing(2),
    borderRadius: '20px',
    textTransform: 'none',
    fontWeight: 500,
    backgroundColor: active ? theme.palette.primary.light : 'transparent',
    color: active ? theme.palette.primary.main : theme.palette.primary.main,
    '&:hover': {
        backgroundColor: active ? theme.palette.primary.light : theme.palette.action.hover,
    },
}));

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        setIsAuthenticated(!!token);
    }, []);

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <StyledAppBar position="fixed">
            <Container maxWidth="lg">
                <Toolbar disableGutters>
                    <Typography
                        variant="h6"
                        component="div"
                        sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 700 }}
                        onClick={() => navigate(isAuthenticated ? '/auth-home' : '/')}
                        style={{ cursor: 'pointer' }}
                    >
                        DanceFlow
                    </Typography>
                    <Box>
                        {isAuthenticated ? (
                            <>
                                <NavButton
                                    color="primary"
                                    variant="text"
                                    onClick={() => navigate('/projects')}
                                    active={isActive('/projects')}
                                >
                                    Проекты
                                </NavButton>
                                <NavButton
                                    color="primary"
                                    variant="text"
                                    onClick={() => navigate('/teams')}
                                    active={isActive('/teams')}
                                >
                                    Команды
                                </NavButton>
                                <NavButton
                                    color="primary"
                                    variant="text"
                                    onClick={() => navigate('/constructor')}
                                    active={isActive('/constructor')}
                                >
                                    Конструктор
                                </NavButton>
                                <NavButton
                                    color="primary"
                                    variant="text"
                                    onClick={() => navigate('/dashboard')}
                                    active={isActive('/dashboard')}
                                >
                                    Личный кабинет
                                </NavButton>
                            </>
                        ) : (
                            <>
                                <StyledButton color="primary" variant="text" onClick={() => navigate('/login')}>
                                    Войти
                                </StyledButton>
                                <StyledButton color="primary" variant="contained" onClick={() => navigate('/register')}>
                                    Регистрация
                                </StyledButton>
                            </>
                        )}
                    </Box>
                </Toolbar>
            </Container>
        </StyledAppBar>
    );
}

export default Navbar; 