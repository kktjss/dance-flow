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
import { COLORS } from '../constants/colors';

// Добавляем стилизованный компонент для логотипа DanceFlow
const LogoDanceFlow = ({ variant = "h6", component = "span", color = "primary", ...props }) => (
    <Typography
        variant={variant}
        component={component}
        sx={{
            fontWeight: 800,
            fontFamily: '"Inter", "Golos Text", sans-serif',
            letterSpacing: '-0.02em',
            display: 'inline-block',
            ...props.sx
        }}
    >
        Dance
        <Box
            component="span"
            sx={{
                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: `0 0 10px rgba(${parseInt(COLORS.tertiary.slice(1, 3), 16)}, ${parseInt(COLORS.tertiary.slice(3, 5), 16)}, ${parseInt(COLORS.tertiary.slice(5, 7), 16)}, 0.4)`,
                position: 'relative',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '2px',
                    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                    opacity: 0.5,
                    borderRadius: '2px',
                    transform: 'translateY(3px)',
                }
            }}
        >
            Flow
        </Box>
    </Typography>
);

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: `rgba(26, 32, 46, 0.95)`,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    borderBottom: `1px solid rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.2)`,
    position: 'relative',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '1px',
        background: `linear-gradient(90deg, rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0) 0%, rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 1) 50%, rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0) 100%)`,
    }
}));

const StyledButton = styled(Button)(({ theme }) => ({
    marginLeft: theme.spacing(2),
    borderRadius: '12px',
    textTransform: 'none',
    fontWeight: 600,
    fontFamily: '"Inter", "Golos Text", sans-serif',
    padding: '8px 16px',
    transition: 'all 0.3s ease',
    '&.MuiButton-contained': {
        background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.secondaryLight})`,
        color: COLORS.white,
        boxShadow: `0 6px 15px rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.3)`,
        '&:hover': {
            boxShadow: `0 8px 20px rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.5)`,
            transform: 'translateY(-2px)'
        }
    },
    '&.MuiButton-text': {
        color: 'rgba(255, 255, 255, 0.85)',
        '&:hover': {
            background: 'rgba(255, 255, 255, 0.1)',
            color: COLORS.white
        }
    }
}));

const NavButton = styled(Button)(({ theme, active }) => ({
    marginLeft: theme.spacing(2),
    borderRadius: '12px',
    textTransform: 'none',
    fontWeight: 600,
    fontFamily: '"Inter", "Golos Text", sans-serif',
    padding: '8px 16px',
    backgroundColor: active === 'true' ? `rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.2)` : 'transparent',
    color: active === 'true' ? COLORS.white : 'rgba(255, 255, 255, 0.85)',
    position: 'relative',
    transition: 'all 0.3s ease',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: '4px',
        left: '50%',
        width: active === 'true' ? '40px' : '0',
        height: '2px',
        transform: 'translateX(-50%)',
        background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        transition: 'width 0.3s ease',
        opacity: 0.7,
        borderRadius: '2px'
    },
    '&:hover': {
        backgroundColor: active === 'true' ? `rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.3)` : 'rgba(255, 255, 255, 0.1)',
        '&::after': {
            width: '30px'
        }
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

    const checkActive = (path) => {
        return location.pathname === path;
    };

    return (
        <StyledAppBar position="fixed">
            <Container maxWidth="lg">
                <Toolbar disableGutters>
                    <Box
                        sx={{
                            flexGrow: 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
                    >
                        <LogoDanceFlow
                            variant="h6"
                            component="div"
                            sx={{ fontWeight: 700 }}
                        />
                    </Box>
                    <Box>
                        {isAuthenticated ? (
                            <>
                                <NavButton
                                    color="primary"
                                    variant="text"
                                    onClick={() => navigate('/teams')}
                                    active={checkActive('/teams').toString()}
                                    data-active={checkActive('/teams').toString()}
                                >
                                    Команды
                                </NavButton>
                                <NavButton
                                    color="primary"
                                    variant="text"
                                    onClick={() => navigate('/constructor')}
                                    active={checkActive('/constructor').toString()}
                                    data-active={checkActive('/constructor').toString()}
                                >
                                    Конструктор
                                </NavButton>
                                <NavButton
                                    color="primary"
                                    variant="text"
                                    onClick={() => navigate('/dashboard')}
                                    active={checkActive('/dashboard').toString()}
                                    data-active={checkActive('/dashboard').toString()}
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