import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    Button,
    Paper,
    Avatar,
    useTheme,
    alpha,
} from '@mui/material';
import {
    VideoLibrary as VideoIcon,
    Group as GroupIcon,
    Create as CreateIcon,
    ThreeDRotation as ThreeDIcon,
    MusicNote as MusicIcon,
    Timeline as TimelineIcon,
    Celebration as CelebrationIcon,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import { styled, keyframes } from '@mui/material/styles';
import { COLORS } from '../constants/colors';

// No need to add additional colors since we moved them to constants/colors.js
const EXTENDED_COLORS = COLORS;

// Animations
const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

const float = keyframes`
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
`;

// Decorative elements
const DecorativeCircle = styled(Box)(({ size = 120, top, left, color = EXTENDED_COLORS.primary, delay = 0 }) => ({
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

const FloatingIcon = styled(Box)(({ theme, delay = 0 }) => ({
    position: 'absolute',
    opacity: 0.06,
    pointerEvents: 'none',
    color: theme.palette.primary.main,
    animation: `${float} 6s ${delay}s ease-in-out infinite`,
    zIndex: 0,
}));

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(4),
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
        background: `linear-gradient(90deg, ${EXTENDED_COLORS.primary}, ${EXTENDED_COLORS.tertiary})`,
    }
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: '12px',
    fontWeight: 600,
    fontFamily: '"Inter", "Golos Text", sans-serif',
    background: `linear-gradient(90deg, ${EXTENDED_COLORS.primary}, ${EXTENDED_COLORS.tertiary})`,
    backgroundSize: '200% 200%',
    animation: `${gradientShift} 5s ease infinite`,
    color: EXTENDED_COLORS.white,
    transition: 'all 0.3s ease',
    boxShadow: `0 8px 20px rgba(138, 43, 226, 0.4)`,
    '&:hover': {
        boxShadow: `0 10px 25px rgba(138, 43, 226, 0.6)`,
        transform: 'translateY(-2px)'
    }
}));

const FeatureCard = styled(Card)(({ theme, index }) => ({
    borderRadius: '16px',
    backgroundColor: 'rgba(32, 38, 52, 0.8)',
    border: '1px solid rgba(30, 144, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    animation: `${fadeIn} ${0.3 + (index * 0.1)}s ease-out forwards`,
    height: '100%',
    '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: '0 15px 30px rgba(0, 0, 0, 0.4)',
        '& .MuiCardContent-root': {
            background: `linear-gradient(135deg, rgba(30, 144, 255, 0.1) 0%, rgba(64, 224, 208, 0.1) 100%)`,
        }
    },
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '3px',
        background: index % 3 === 0 ? `linear-gradient(90deg, ${EXTENDED_COLORS.secondary}, ${EXTENDED_COLORS.tertiary})` :
            index % 3 === 1 ? `linear-gradient(90deg, ${EXTENDED_COLORS.tertiary}, ${EXTENDED_COLORS.teal})` :
                `linear-gradient(90deg, ${EXTENDED_COLORS.teal}, ${EXTENDED_COLORS.secondary})`,
    }
}));

const FeatureIcon = styled(Box)(({ theme }) => ({
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: alpha(EXTENDED_COLORS.primary, 0.1),
    marginBottom: theme.spacing(2),
    color: EXTENDED_COLORS.primary,
    boxShadow: `0 4px 20px ${alpha(EXTENDED_COLORS.primary, 0.2)}`,
    transition: 'all 0.3s ease',
    '&:hover': {
        transform: 'rotate(10deg)',
        backgroundColor: alpha(EXTENDED_COLORS.primary, 0.2),
    }
}));

const UserInfoCard = styled(Box)(({ theme }) => ({
    padding: theme.spacing(4),
    borderRadius: '20px',
    backgroundColor: 'rgba(32, 38, 52, 0.8)',
    border: '1px solid rgba(30, 144, 255, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: theme.spacing(4),
    boxShadow: `0 10px 20px rgba(0, 0, 0, 0.2)`,
    animation: `${fadeIn} 0.5s ease-out forwards`,
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, rgba(30, 144, 255, 0.05) 0%, rgba(64, 224, 208, 0.05) 100%)`,
        zIndex: -1,
    }
}));

const LogoDanceFlow = ({ variant = "h1", component = "span", color = "primary", ...props }) => (
    <Typography
        variant={variant}
        component={component}
        sx={{
            fontFamily: '"Inter", "Golos Text", sans-serif',
            fontWeight: 800,
            color: color === "primary" ? EXTENDED_COLORS.primary : EXTENDED_COLORS.white,
            display: 'inline-block',
            background: `linear-gradient(90deg, ${EXTENDED_COLORS.primary}, ${EXTENDED_COLORS.tertiary})`,
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
            ...props.sx
        }}
        {...props}
    >
        Dance Flow
    </Typography>
);

function AuthHome() {
    const theme = useTheme();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    useEffect(() => {
        try {
            const userData = localStorage.getItem('user');
            if (userData && userData !== 'undefined' && userData !== 'null') {
                setUser(JSON.parse(userData));
            } else {
                console.log('No valid user data found in localStorage, redirecting to login');
                navigate('/login');
            }
        } catch (error) {
            console.error('Error parsing user data from localStorage:', error);
            // Очищаем поврежденные данные
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            navigate('/login');
        }
    }, [navigate]);

    // Features list
    const features = [
        {
            title: "Создать хореографию",
            description: "Используйте наш визуальный конструктор для создания и редактирования танцевальных композиций",
            icon: <CreateIcon sx={{ fontSize: 30 }} />,
            action: () => navigate('/constructor'),
            actionText: "Создать",
            color: EXTENDED_COLORS.primary
        },
        {
            title: "Управление командами",
            description: "Создавайте команды и сотрудничайте с другими хореографами в реальном времени",
            icon: <GroupIcon sx={{ fontSize: 30 }} />,
            action: () => navigate('/teams'),
            actionText: "Управлять",
            color: EXTENDED_COLORS.tertiary
        },
        {
            title: "3D-моделирование",
            description: "Создавайте и просматривайте постановки с использованием 3D-моделей танцоров",
            icon: <ThreeDIcon sx={{ fontSize: 30 }} />,
            action: () => navigate('/constructor?mode=3d'),
            actionText: "Попробовать",
            color: EXTENDED_COLORS.teal
        },
        {
            title: "Библиотека хореографий",
            description: "Просматривайте свои сохраненные хореографии и работайте с ними",
            icon: <VideoIcon sx={{ fontSize: 30 }} />,
            action: () => navigate('/dashboard'),
            actionText: "Смотреть",
            color: EXTENDED_COLORS.primary
        },
    ];

    if (!user) {
        return null;
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: `linear-gradient(135deg, #121620 0%, #1e2940 100%)`,
            position: 'relative',
        }}>
            {/* Decorative elements */}
            <DecorativeCircle top="20%" left="-5%" size={300} color={EXTENDED_COLORS.primary} delay={0.2} />
            <DecorativeCircle top="60%" left="95%" size={200} color={EXTENDED_COLORS.tertiary} delay={0.4} />
            <DecorativeCircle top="90%" left="10%" size={150} color={EXTENDED_COLORS.secondary} delay={0.6} />

            <FloatingIcon sx={{ top: '15%', right: '10%' }}>
                <TimelineIcon sx={{ fontSize: 100 }} />
            </FloatingIcon>

            <FloatingIcon sx={{ bottom: '20%', left: '8%', opacity: 0.15 }} delay={1}>
                <MusicIcon sx={{ fontSize: 80 }} />
            </FloatingIcon>

            <Navbar />
            <Container component="main" maxWidth="lg" sx={{ py: 6, mt: 4, position: 'relative', zIndex: 2 }}>
                <Box sx={{ textAlign: 'center', mb: 5, animation: `${fadeIn} 0.7s ease-out forwards` }}>
                    <LogoDanceFlow variant="h3" component="h1" sx={{ mb: 2 }} />
                    <Typography
                        variant="h5"
                        sx={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: '"Inter", "Golos Text", sans-serif',
                            fontWeight: 400,
                        }}
                    >
                        Создавайте удивительные танцевальные постановки
                    </Typography>
                </Box>

                <UserInfoCard>
                    <Avatar
                        sx={{
                            width: 100,
                            height: 100,
                            bgcolor: `${EXTENDED_COLORS.tertiary}50`,
                            color: EXTENDED_COLORS.white,
                            fontSize: '2.5rem',
                            fontWeight: 'bold',
                            mb: 2,
                            border: `3px solid ${EXTENDED_COLORS.tertiary}`,
                        }}
                    >
                        {user.username.substring(0, 1).toUpperCase()}
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: EXTENDED_COLORS.white }}>
                        Привет, {user.username}!
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 3, textAlign: 'center' }}>
                        Добро пожаловать в ваш танцевальный центр. Что вы хотели бы создать сегодня?
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <StyledButton
                            startIcon={<CreateIcon />}
                            onClick={() => navigate('/constructor')}
                            sx={{ px: 3 }}
                        >
                            Создать хореографию
                        </StyledButton>
                        <StyledButton
                            startIcon={<CelebrationIcon />}
                            onClick={() => navigate('/dashboard')}
                            sx={{ px: 3 }}
                        >
                            Мои проекты
                        </StyledButton>
                    </Box>
                </UserInfoCard>

                <Box sx={{ mt: 4, mb: 2 }}>
                    <Typography variant="h5" sx={{
                        fontWeight: 700,
                        color: EXTENDED_COLORS.white,
                        position: 'relative',
                        display: 'inline-block',
                        mb: 3,
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: -8,
                            left: 0,
                            width: 40,
                            height: 3,
                            background: `linear-gradient(to right, ${EXTENDED_COLORS.primary}, ${EXTENDED_COLORS.tertiary})`,
                            borderRadius: 1.5
                        }
                    }}>
                        Начните работу
                    </Typography>
                </Box>

                <Grid container spacing={3}>
                    {features.map((feature, index) => (
                        <Grid item xs={12} sm={6} md={3} key={index}>
                            <FeatureCard index={index}>
                                <CardContent sx={{
                                    p: 3,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    transition: 'all 0.3s ease',
                                }}>
                                    <FeatureIcon>
                                        {feature.icon}
                                    </FeatureIcon>
                                    <Typography variant="h6" sx={{
                                        fontWeight: 600,
                                        mb: 1,
                                        color: EXTENDED_COLORS.white
                                    }}>
                                        {feature.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        mb: 2,
                                        flexGrow: 1
                                    }}>
                                        {feature.description}
                                    </Typography>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        sx={{
                                            borderColor: alpha(feature.color, 0.3),
                                            color: feature.color,
                                            borderRadius: 2,
                                            textTransform: 'none',
                                            '&:hover': {
                                                borderColor: feature.color,
                                                backgroundColor: alpha(feature.color, 0.1),
                                            }
                                        }}
                                        onClick={feature.action}
                                    >
                                        {feature.actionText}
                                    </Button>
                                </CardContent>
                            </FeatureCard>
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{
                    mt: 6,
                    p: 4,
                    borderRadius: 4,
                    backgroundColor: alpha(EXTENDED_COLORS.primary, 0.1),
                    border: `1px dashed ${alpha(EXTENDED_COLORS.tertiary, 0.3)}`,
                    textAlign: 'center',
                    animation: `${pulseAnimation} 8s ease-in-out infinite`,
                }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: EXTENDED_COLORS.tertiary, mb: 1 }}>
                        💡 Совет дня
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        Используйте сочетание клавиш Ctrl+Space для показа/скрытия панели инструментов в конструкторе хореографий.
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
}

export default AuthHome; 