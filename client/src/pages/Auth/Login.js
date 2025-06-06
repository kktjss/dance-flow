import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    TextField,
    Button,
    Paper,
    Link,
    Alert,
    Grid,
    Divider,
    CircularProgress,
    useTheme,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { COLORS } from '../../constants/colors';

// Анимации
const glowingBorder = keyframes`
  0% { border-image-source: linear-gradient(45deg, ${COLORS.primary}, ${COLORS.tertiary}, ${COLORS.primary}); }
  25% { border-image-source: linear-gradient(90deg, ${COLORS.tertiary}, ${COLORS.primary}, ${COLORS.tertiary}); }
  50% { border-image-source: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.tertiary}, ${COLORS.primary}); }
  75% { border-image-source: linear-gradient(180deg, ${COLORS.tertiary}, ${COLORS.primary}, ${COLORS.tertiary}); }
  100% { border-image-source: linear-gradient(225deg, ${COLORS.primary}, ${COLORS.tertiary}, ${COLORS.primary}); }
`;

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Стилизованные компоненты
const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(5),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    borderRadius: '20px',
    backgroundColor: 'rgba(21, 25, 50, 0.95)',
    boxShadow: `0 10px 30px rgba(0, 0, 0, 0.4)`,
    border: '1px solid rgba(138, 43, 226, 0.2)',
    position: 'relative',
    overflow: 'hidden',
    animation: `${fadeIn} 0.5s ease-out forwards`,
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
    }
}));

const StyledButton = styled(Button)(({ theme }) => ({
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1.5, 0),
    borderRadius: '12px',
    fontWeight: 600,
    fontFamily: '"Inter", "Golos Text", sans-serif',
    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
    backgroundSize: '200% 200%',
    animation: `${gradientShift} 5s ease infinite`,
    color: COLORS.white,
    transition: 'all 0.3s ease',
    boxShadow: `0 8px 20px rgba(138, 43, 226, 0.4)`,
    '&:hover': {
        boxShadow: `0 10px 25px rgba(138, 43, 226, 0.6)`,
        transform: 'translateY(-2px)'
    }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        color: 'rgba(255, 255, 255, 0.9)',
        transition: 'all 0.3s ease',
        '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        '&:hover fieldset': {
            borderColor: COLORS.primaryLight,
        },
        '&.Mui-focused fieldset': {
            borderColor: COLORS.primary,
            boxShadow: `0 0 10px rgba(138, 43, 226, 0.3)`,
        },
    },
    '& .MuiInputLabel-root': {
        color: 'rgba(255, 255, 255, 0.7)',
        '&.Mui-focused': {
            color: COLORS.tertiary,
        },
    },
    '& .MuiOutlinedInput-input': {
        padding: '14px 16px',
    },
}));

// Декоративные элементы
const DecorativeCircle = styled(Box)(({ size = 120, top, left, color = COLORS.primary, delay = 0 }) => ({
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color}55 0%, ${color}00 70%)`,
    top: top,
    left: left,
    opacity: 0.7,
    pointerEvents: 'none',
    animation: `${fadeIn} 1s ${delay}s ease-out forwards`,
}));

const DecorativeLine = styled(Box)(({ theme }) => ({
    position: 'absolute',
    width: '100%',
    height: '1px',
    background: `linear-gradient(90deg, rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0) 0%, rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0.5) 50%, rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0) 100%)`,
}));

// Компонент логотипа
const LogoDanceFlow = ({ variant = "h1", component = "span", color = "primary", ...props }) => (
    <Typography
        variant={variant}
        component={component}
        sx={{
            fontWeight: 800,
            fontFamily: '"Inter", "Golos Text", sans-serif',
            letterSpacing: '-0.02em',
            display: 'inline-block',
            color: COLORS.white,
            ...props.sx
        }}
    >
        Dance
        <Box
            component="span"
            sx={{
                background: `linear-gradient(90deg, ${COLORS[color]}, ${COLORS.tertiary})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: `0 0 15px rgba(${parseInt(COLORS.tertiary.slice(1, 3), 16)}, ${parseInt(COLORS.tertiary.slice(3, 5), 16)}, ${parseInt(COLORS.tertiary.slice(5, 7), 16)}, 0.4)`,
                position: 'relative',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '3px',
                    background: `linear-gradient(90deg, ${COLORS[color]}, ${COLORS.tertiary})`,
                    opacity: 0.5,
                    borderRadius: '2px',
                    transform: 'translateY(5px)',
                }
            }}
        >
            Flow
        </Box>
    </Typography>
);

function Login() {
    const navigate = useNavigate();
    const theme = useTheme();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            console.log('Attempting login for:', formData.username);

            const response = await axios.post('http://localhost:5000/api/auth/login', {
                username: formData.username,
                password: formData.password,
            });

            console.log('Login successful, received data:', {
                hasToken: !!response.data.token,
                hasUser: !!response.data.user
            });

            // Сохраняем токен и данные пользователя
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Перенаправляем на дашборд
            navigate('/dashboard');
        } catch (error) {
            console.error('Login error:', error);

            if (error.response) {
                console.log('Error response:', error.response.status, error.response.data);

                // Обработка конкретных ошибок
                if (error.response.status === 401) {
                    setError('Неверное имя пользователя или пароль');
                } else if (error.response.status === 500) {
                    setError('Ошибка сервера. Пожалуйста, попробуйте позже.');
                } else {
                    setError(
                        error.response.data.error ||
                        error.response.data.message ||
                        `Ошибка сервера: ${error.response.status}`
                    );
                }
            } else if (error.request) {
                // Запрос был отправлен, но ответ не получен
                setError('Не удалось соединиться с сервером. Проверьте подключение к интернету.');
            } else {
                // Ошибка при настройке запроса
                setError('Ошибка при входе: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkLight} 100%)`,
        }}>
            <Navbar />
            <Container component="main" maxWidth="sm" sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                        py: 4,
                    }}
                >
                    {/* Декоративные элементы */}
                    <DecorativeCircle top="-50px" left="-80px" size={200} color={COLORS.primary} delay={0.2} />
                    <DecorativeCircle top="30%" left="90%" size={150} color={COLORS.tertiary} delay={0.4} />
                    <DecorativeCircle top="80%" left="5%" size={100} color={COLORS.secondary} delay={0.6} />

                    <Box sx={{ mb: 5, textAlign: 'center', animation: `${fadeIn} 0.7s ease-out forwards` }}>
                        <LogoDanceFlow variant="h3" component="h1" sx={{ mb: 2 }} />
                        <Typography
                            variant="h5"
                            sx={{
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontFamily: '"Inter", "Golos Text", sans-serif',
                                fontWeight: 400,
                            }}
                        >
                            Добро пожаловать
                        </Typography>
                    </Box>

                    <StyledPaper>
                        <Typography
                            component="h2"
                            variant="h4"
                            sx={{
                                color: COLORS.white,
                                mb: 3,
                                fontWeight: 700,
                                fontFamily: '"Inter", "Golos Text", sans-serif',
                                position: 'relative',
                                '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: '-10px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '40px',
                                    height: '3px',
                                    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                                    borderRadius: '2px',
                                }
                            }}
                        >
                            Вход
                        </Typography>

                        {error && (
                            <Alert
                                severity="error"
                                sx={{
                                    width: '100%',
                                    mt: 2,
                                    mb: 2,
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(17, 21, 54, 0.95)',
                                    color: '#FFFFFF',
                                    border: '1px solid rgba(244, 67, 54, 0.3)',
                                    boxShadow: '0 8px 25px rgba(244, 67, 54, 0.2)',
                                    backdropFilter: 'blur(10px)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '3px',
                                        background: 'linear-gradient(90deg, #f44336, #ff5722)',
                                        borderRadius: '12px 12px 0 0',
                                    },
                                    '& .MuiAlert-icon': {
                                        color: '#ff867c',
                                        fontSize: '22px'
                                    },
                                    '& .MuiAlert-message': {
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        fontWeight: 500
                                    }
                                }}
                            >
                                {error}
                            </Alert>
                        )}

                        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3, width: '100%' }}>
                            <StyledTextField
                                required
                                fullWidth
                                id="username"
                                label="Имя пользователя"
                                name="username"
                                autoComplete="username"
                                autoFocus
                                value={formData.username}
                                onChange={handleChange}
                            />

                            <StyledTextField
                                required
                                fullWidth
                                name="password"
                                label="Пароль"
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                value={formData.password}
                                onChange={handleChange}
                            />

                            <Grid container justifyContent="flex-end" sx={{ mt: 1 }}>
                                <Grid item>
                                    <Link
                                        component="button"
                                        variant="body2"
                                        onClick={() => { }}
                                        sx={{
                                            color: COLORS.tertiaryLight,
                                            textDecoration: 'none',
                                            '&:hover': {
                                                textDecoration: 'underline'
                                            }
                                        }}
                                    >
                                        Забыли пароль?
                                    </Link>
                                </Grid>
                            </Grid>

                            <StyledButton
                                type="submit"
                                fullWidth
                                variant="contained"
                                disabled={loading}
                            >
                                {loading ? (
                                    <CircularProgress size={24} sx={{ color: COLORS.white }} />
                                ) : (
                                    'Войти'
                                )}
                            </StyledButton>

                            <Box sx={{ textAlign: 'center', mt: 3 }}>
                                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                    Нет аккаунта?{' '}
                                    <Link
                                        component="button"
                                        variant="body2"
                                        onClick={() => navigate('/register')}
                                        sx={{
                                            color: COLORS.tertiary,
                                            textDecoration: 'none',
                                            fontWeight: 600,
                                            '&:hover': {
                                                textDecoration: 'underline'
                                            }
                                        }}
                                    >
                                        Зарегистрируйтесь
                                    </Link>
                                </Typography>
                            </Box>
                        </Box>
                    </StyledPaper>
                </Box>
            </Container>
            <Footer />
        </Box>
    );
}

export default Login; 