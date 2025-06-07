import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    CardActions,
    Box,
    Paper,
    Divider,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { COLORS } from '../constants/colors';

// Анимации keyframes
const glowingBorder = keyframes`
  0% { border-image-source: linear-gradient(45deg, ${COLORS.secondary}, ${COLORS.tertiary}, ${COLORS.secondary}); }
  25% { border-image-source: linear-gradient(90deg, ${COLORS.tertiary}, ${COLORS.secondary}, ${COLORS.tertiary}); }
  50% { border-image-source: linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.tertiary}, ${COLORS.secondary}); }
  75% { border-image-source: linear-gradient(180deg, ${COLORS.tertiary}, ${COLORS.secondary}, ${COLORS.tertiary}); }
  100% { border-image-source: linear-gradient(225deg, ${COLORS.secondary}, ${COLORS.tertiary}, ${COLORS.secondary}); }
`;

const floatAnimation = keyframes`
  0% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-10px) rotate(2deg);
  }
  75% {
    transform: translateY(10px) rotate(-2deg);
  }
  100% {
    transform: translateY(0) rotate(0deg);
  }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

const dashAnimation = keyframes`
  to {
    stroke-dashoffset: -300;
  }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const slideInLeft = keyframes`
  0% { transform: translateX(-100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
`;

const slideInRight = keyframes`
  0% { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
`;

const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

// Добавим новые анимации для SVG
const dancerPathAnimation = keyframes`
  0% {
    stroke-dashoffset: 1000;
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0.3;
  }
`;

const glowAnimation = keyframes`
  0% {
    filter: drop-shadow(0 0 2px ${COLORS.secondary});
  }
  50% {
    filter: drop-shadow(0 0 10px ${COLORS.tertiary});
  }
  100% {
    filter: drop-shadow(0 0 2px ${COLORS.secondary});
  }
`;

const waveAnimation = keyframes`
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0);
  }
`;

const pulseGlow = keyframes`
  0% {
    box-shadow: 0 0 10px ${COLORS.secondary}40;
  }
  50% {
    box-shadow: 0 0 30px ${COLORS.secondary}80;
  }
  100% {
    box-shadow: 0 0 10px ${COLORS.secondary}40;
  }
`;

const scanAnimation = keyframes`
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(100%);
    opacity: 0;
  }
`;

const analyzeAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
`;

const moveAnimation = keyframes`
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  25% {
    transform: translateY(-1%) rotate(-1deg) scale(1.01);
  }
  75% {
    transform: translateY(1%) rotate(1deg) scale(0.99);
  }
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
`;

const glowPulse = keyframes`
  0% {
    filter: drop-shadow(0 0 8px ${COLORS.secondary}40);
  }
  50% {
    filter: drop-shadow(0 0 15px ${COLORS.secondary}80);
  }
  100% {
    filter: drop-shadow(0 0 8px ${COLORS.secondary}40);
  }
`;

const dataFlowAnimation = keyframes`
  0% {
    stroke-dashoffset: 1000;
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0.3;
  }
`;

// Стилизованные компоненты с анимациями
const StyledCard = styled(Card)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.4s cubic-bezier(0.17, 0.67, 0.83, 0.67)',
    backgroundColor: 'rgba(17, 21, 54, 0.95)', // Темный фон
    color: COLORS.white,
    border: `1px solid rgba(255, 255, 255, 0.1)`,
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '4px',
        height: '100%',
        background: `linear-gradient(180deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        transition: 'all 0.4s cubic-bezier(0.17, 0.67, 0.83, 0.67)',
        borderTopLeftRadius: '16px',
        borderBottomLeftRadius: '16px',
    },
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: '0',
        width: '0%',
        height: '3px',
        background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        transition: 'width 0.4s ease-out',
    },
    '&:hover': {
        transform: 'translateY(-12px) scale(1.02)',
        boxShadow: `0 20px 30px rgba(30, 144, 255, 0.3)`,
        '&::before': {
            width: '100%',
            opacity: 0.1,
            transition: 'all 0.4s cubic-bezier(0.17, 0.67, 0.83, 0.67)',
        },
        '&::after': {
            width: '100%',
        }
    },
}));

const AnimatedDot = styled(Box)(({ size = 6, delay = 0, color = COLORS.secondary }) => ({
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    backgroundColor: color,
    animation: `${pulseAnimation} 3s ${delay}s infinite ease-in-out`,
    zIndex: 1,
}));

const AnimatedLine = styled(Box)(({ theme }) => ({
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 0,
    pointerEvents: 'none',
    '& svg': {
        position: 'absolute',
        width: '100%',
        height: '100%',
        '& path': {
            stroke: `rgba(138, 43, 226, 0.3)`,
            strokeWidth: '1px',
            strokeDasharray: '10, 15',
            fill: 'none',
            animation: `${dashAnimation} 20s linear infinite`,
        }
    }
}));

const DecorativeGrid = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    opacity: 0.3,
    backgroundImage: `linear-gradient(rgba(138, 43, 226, 0.3) 1px, transparent 1px), 
                      linear-gradient(90deg, rgba(138, 43, 226, 0.3) 1px, transparent 1px)`,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
    transformOrigin: 'center',
    animation: `${pulseAnimation} 15s infinite ease-in-out`,
}));

const GlowingButton = styled(Button)(({ theme }) => ({
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
    borderRadius: '12px',
    '&::before': {
        content: '""',
        position: 'absolute',
        top: '-2px',
        left: '-2px',
        right: '-2px',
        bottom: '-2px',
        zIndex: -1,
        background: `linear-gradient(45deg, ${COLORS.secondary}, ${COLORS.tertiary}, ${COLORS.secondaryLight})`,
        backgroundSize: '400% 400%',
        animation: `${gradientShift} 3s ease infinite`,
        borderRadius: '14px',
        opacity: 0,
        transition: 'opacity 0.3s ease',
    },
    '&:hover::before': {
        opacity: 1,
    }
}));

const HeroSection = styled(Paper)(({ theme }) => ({
    position: 'relative',
    backgroundColor: COLORS.dark,
    color: COLORS.white,
    marginBottom: theme.spacing(4),
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundImage: 'url(https://source.unsplash.com/random?dance,contemporary)',
    height: '90vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 0,
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `linear-gradient(135deg, rgba(10, 14, 36, 0.8) 0%, rgba(30, 144, 255, 0.7) 100%)`,
        zIndex: 1,
    },
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100px',
        background: `linear-gradient(0deg, ${COLORS.dark} 0%, rgba(10, 14, 36, 0) 100%)`,
        zIndex: 1,
    }
}));

const HeroContent = styled(Box)(({ theme, inView }) => ({
    position: 'relative',
    padding: theme.spacing(3),
    textAlign: 'center',
    zIndex: 2,
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 0.8s ease, transform 0.8s ease',
}));

const HeroTitle = styled(Typography)(({ theme, inView }) => ({
    fontSize: { xs: '2.5rem', md: '5rem' },
    fontWeight: 800,
    fontFamily: '"Inter", "Golos Text", sans-serif',
    background: 'linear-gradient(90deg, #ffffff 0%, #a5b4fc 100%)',
    backgroundClip: 'text',
    textFillColor: 'transparent',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    mb: 2,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : 'translateY(30px)',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    transitionDelay: '0.2s',
    position: 'relative',
    display: 'inline-block',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: '-10px',
        left: '0',
        width: '0%',
        height: '3px',
        background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        transition: 'width 1s ease-out',
        transitionDelay: '0.8s',
    },
    '&.visible::after': {
        width: '100%',
    }
}));

const HeroSubtitle = styled(Typography)(({ theme, inView }) => ({
    fontSize: { xs: '1.3rem', md: '1.7rem' },
    fontWeight: 400,
    letterSpacing: '0.02em',
    mb: 5,
    maxWidth: '800px',
    mx: 'auto',
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: '"Inter", "Golos Text", sans-serif',
    lineHeight: 1.4,
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : 'translateY(30px)',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    transitionDelay: '0.4s',
}));

const FeatureSection = styled(Box)(({ theme }) => ({
    padding: theme.spacing(8, 0),
    background: 'linear-gradient(180deg, #0a0e24 0%, #111536 100%)',
    position: 'relative',
    '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '1px',
        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0) 0%, rgba(99, 102, 241, 1) 50%, rgba(99, 102, 241, 0) 100%)',
    }
}));

const AnimatedSection = styled(Box)(({ theme }) => ({
    padding: theme.spacing(8, 0),
    background: 'linear-gradient(180deg, #111536 0%, #0a0e24 100%)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '1px',
        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0) 0%, rgba(99, 102, 241, 1) 50%, rgba(99, 102, 241, 0) 100%)',
    }
}));

const SectionTitle = styled(Typography)(({ theme, inView = false }) => ({
    fontFamily: '"Inter", "Golos Text", sans-serif',
    fontWeight: 'bold',
    position: 'relative',
    color: COLORS.white,
    display: 'inline-block',
    letterSpacing: '0.02em',
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : 'translateY(30px)',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: '-8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: inView ? '40px' : '0px',
        height: '3px',
        background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        transition: 'width 0.8s ease-out',
        transitionDelay: '0.3s',
    }
}));

// Компонент диагонального разделителя секций
const DiagonalDivider = styled(Box)(({ theme, position = 'top', color = '#111536', bgColor = '#0a0e24' }) => ({
    position: 'relative',
    height: '80px',
    backgroundColor: position === 'top' ? bgColor : color,
    '&::before': {
        content: '""',
        position: 'absolute',
        width: '100%',
        height: '100%',
        left: 0,
        top: 0,
        backgroundColor: position === 'top' ? color : bgColor,
        clipPath: position === 'top'
            ? 'polygon(0 0, 100% 0, 100% 100%, 0 0)'
            : 'polygon(0 100%, 100% 0, 100% 100%, 0 100%)',
        zIndex: 2,
    }
}));

// Волновая анимация для секции холста
const WaveBox = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    '&::before, &::after': {
        content: '""',
        position: 'absolute',
        left: 0,
        width: '200%',
        height: '120%',
        backgroundRepeat: 'repeat-x',
        opacity: 0.2,
    },
    '&::before': {
        bottom: '-20%',
        background: 'radial-gradient(circle at 50% 100%, transparent 20%, #6366F1 21%, #6366F1 23%, transparent 24%) 0 0/80px 80px',
        animation: `${gradientShift} 20s linear infinite`,
    },
    '&::after': {
        bottom: '-40%',
        background: 'radial-gradient(circle at 50% 100%, transparent 24%, #3B82F6 25%, #3B82F6 28%, transparent 29%) 0 0/60px 60px',
        animation: `${gradientShift} 15s linear infinite reverse`,
    }
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
                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
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
                    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
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

// Компонент карточки возможностей - исправлено искажение
const FeatureCard = ({ title, description, onClick }) => {
    return (
        <StyledCard sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{
                flexGrow: 1,
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                minHeight: '240px'
            }}>
                <Typography
                    variant="h5"
                    component="h3"
                    gutterBottom
                    sx={{
                        fontWeight: 700,
                        fontFamily: '"Inter", "Golos Text", sans-serif',
                        color: COLORS.white,
                        mb: 3,
                        position: 'relative',
                        pl: 2,
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            width: '4px',
                            height: '70%',
                            transform: 'translateY(-50%)',
                            background: `linear-gradient(180deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                            borderRadius: '4px',
                        }
                    }}
                >
                    {title}
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6, fontFamily: '"Inter", "Golos Text", sans-serif' }}>
                    {description}
                </Typography>
            </CardContent>
            <CardActions sx={{ p: 3, borderTop: '1px solid rgba(255, 255, 255, 0.05)', mt: 'auto' }}>
                <Button
                    size="large"
                    sx={{
                        color: COLORS.tertiary,
                        fontFamily: '"Inter", "Golos Text", sans-serif',
                        fontWeight: 600,
                        position: 'relative',
                        borderRadius: '10px',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            width: '0',
                            height: '2px',
                            bottom: '-2px',
                            left: '0',
                            background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                            transition: 'width 0.2s',
                            borderRadius: '2px',
                        },
                        '&:hover': {
                            background: 'transparent',
                            '&::after': {
                                width: '100%'
                            }
                        }
                    }}
                    onClick={onClick}
                >
                    Подробнее
                </Button>
            </CardActions>
        </StyledCard>
    );
};

// Добавим компонент анимированной иллюстрации
const DanceAnimation = () => {
    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `${floatAnimation} 6s ease-in-out infinite`
            }}
        >
            <svg
                viewBox="0 0 200 200"
                style={{
                    width: '80%',
                    height: '80%',
                    animation: `${glowAnimation} 3s ease-in-out infinite`
                }}
            >
                {/* Стилизованная фигура танцора */}
                <path
                    d="M100,20 C120,20 130,40 130,60 C130,80 120,90 100,90 C80,90 70,80 70,60 C70,40 80,20 100,20"
                    fill="none"
                    stroke={COLORS.secondary}
                    strokeWidth="2"
                    strokeDasharray="1000"
                    style={{ animation: `${dancerPathAnimation} 4s ease-in-out infinite` }}
                />
                <path
                    d="M100,90 L100,140 M80,170 L100,140 L120,170 M70,120 L100,100 L130,120"
                    fill="none"
                    stroke={COLORS.tertiary}
                    strokeWidth="2"
                    strokeDasharray="1000"
                    style={{ animation: `${dancerPathAnimation} 4s ease-in-out infinite` }}
                />
                {/* Декоративные элементы */}
                <circle
                    cx="100"
                    cy="60"
                    r="5"
                    fill={COLORS.secondary}
                    style={{ animation: `${pulseAnimation} 2s ease-in-out infinite` }}
                />
                <circle
                    cx="85"
                    cy="120"
                    r="3"
                    fill={COLORS.tertiary}
                    style={{ animation: `${pulseAnimation} 2s ease-in-out infinite 0.3s` }}
                />
                <circle
                    cx="115"
                    cy="120"
                    r="3"
                    fill={COLORS.tertiary}
                    style={{ animation: `${pulseAnimation} 2s ease-in-out infinite 0.6s` }}
                />
            </svg>
            {/* Декоративные линии */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: -1,
                    '&::before, &::after': {
                        content: '""',
                        position: 'absolute',
                        width: '100%',
                        height: '1px',
                        background: `linear-gradient(90deg, transparent, ${COLORS.secondary}, transparent)`,
                        animation: `${gradientShift} 3s linear infinite`
                    },
                    '&::before': {
                        top: '30%'
                    },
                    '&::after': {
                        bottom: '30%'
                    }
                }}
            />
            {/* Фоновые частицы */}
            {Array.from({ length: 20 }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        position: 'absolute',
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: i % 2 ? COLORS.secondary : COLORS.tertiary,
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        animation: `${pulseAnimation} ${2 + Math.random() * 2}s ease-in-out infinite ${Math.random() * 2}s`
                    }}
                />
            ))}
        </Box>
    );
};

const MotionCapture = () => {
    const [frame, setFrame] = useState(0);

    // Базовые точки для фигуры человека
    const basePoints = {
        head: { x: 50, y: 15 },
        neck: { x: 50, y: 25 },
        shoulderLeft: { x: 35, y: 30 },
        shoulderRight: { x: 65, y: 30 },
        elbowLeft: { x: 25, y: 45 },
        elbowRight: { x: 75, y: 45 },
        handLeft: { x: 20, y: 60 },
        handRight: { x: 80, y: 60 },
        hip: { x: 50, y: 50 },
        kneeLeft: { x: 40, y: 70 },
        kneeRight: { x: 60, y: 70 },
        footLeft: { x: 35, y: 90 },
        footRight: { x: 65, y: 90 },
    };

    // Улучшенная анимация точек с более плавными движениями
    const points = Object.entries(basePoints).reduce((acc, [key, point]) => {
        // Более тонкая настройка движения для разных частей тела
        const xFreq = key.includes('Hand') ? 45 : key.includes('Foot') ? 55 : 50;
        const yFreq = key.includes('Hand') ? 50 : key.includes('Foot') ? 60 : 55;

        // Еще более уменьшенные амплитуды для более тонких движений
        const xAmp = key.includes('Hand') ? 0.8 :
            key.includes('Foot') ? 0.5 :
                key.includes('elbow') ? 0.6 :
                    key.includes('shoulder') ? 0.4 :
                        0.2;

        const yAmp = key.includes('Hand') ? 0.7 :
            key.includes('Foot') ? 0.4 :
                key.includes('elbow') ? 0.5 :
                    key.includes('shoulder') ? 0.3 :
                        0.15;

        // Добавляем небольшой фазовый сдвиг для более естественного движения
        const phaseShift = (point.x + point.y) / 50;

        // Добавляем плавное возвращение в начальную позицию
        const progress = (frame % 360) / 360;
        const easeInOut = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const xOffset = Math.sin((frame + point.y * 2 + phaseShift) / xFreq) * xAmp * (1 - easeInOut);
        const yOffset = Math.cos((frame + point.x * 2 + phaseShift) / yFreq) * yAmp * (1 - easeInOut);

        return {
            ...acc,
            [key]: {
                x: point.x + (key.includes('Left') ? -xOffset : key.includes('Right') ? xOffset : 0),
                y: point.y + yOffset
            }
        };
    }, {});

    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(f => (f + 1) % 360);
        }, 20); // Еще более плавная анимация
        return () => clearInterval(interval);
    }, []);

    const connections = [
        ['head', 'neck'],
        ['neck', 'shoulderLeft'],
        ['neck', 'shoulderRight'],
        ['shoulderLeft', 'elbowLeft'],
        ['shoulderRight', 'elbowRight'],
        ['elbowLeft', 'handLeft'],
        ['elbowRight', 'handRight'],
        ['neck', 'hip'],
        ['hip', 'kneeLeft'],
        ['hip', 'kneeRight'],
        ['kneeLeft', 'footLeft'],
        ['kneeRight', 'footRight'],
    ];

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: COLORS.dark,
                overflow: 'hidden',
            }}
        >
            {/* Фигура */}
            <Box
                sx={{
                    animation: `${moveAnimation} 8s ease-in-out infinite`, // Увеличили длительность для более плавного движения
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.2))',
                }}
            >
                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                        animation: `${glowPulse} 4s ease-in-out infinite`,
                    }}
                >
                    {/* Соединительные линии */}
                    {connections.map(([from, to], index) => (
                        <g key={index}>
                            <line
                                x1={`${points[from].x}%`}
                                y1={`${points[from].y}%`}
                                x2={`${points[to].x}%`}
                                y2={`${points[to].y}%`}
                                stroke={COLORS.secondary}
                                strokeWidth="0.8"
                                strokeDasharray="2"
                                style={{
                                    animation: `${pulseAnimation} 2s ease-in-out infinite`,
                                }}
                            />
                            <line
                                x1={`${points[from].x}%`}
                                y1={`${points[from].y}%`}
                                x2={`${points[to].x}%`}
                                y2={`${points[to].y}%`}
                                stroke={COLORS.tertiary}
                                strokeWidth="0.4"
                                strokeDasharray="1 5"
                                style={{
                                    animation: `${dataFlowAnimation} ${1 + index * 0.2}s linear infinite`,
                                }}
                            />
                        </g>
                    ))}

                    {/* Точки */}
                    {Object.entries(points).map(([key, { x, y }]) => (
                        <g key={key}>
                            <circle
                                cx={`${x}%`}
                                cy={`${y}%`}
                                r="1.8"
                                fill={COLORS.tertiary}
                                style={{
                                    animation: `${analyzeAnimation} ${2 + Math.random()}s ease-in-out infinite`,
                                }}
                            />
                            <circle
                                cx={`${x}%`}
                                cy={`${y}%`}
                                r="3.5"
                                fill="none"
                                stroke={COLORS.secondary}
                                strokeWidth="0.3"
                                style={{
                                    animation: `${pulseAnimation} ${2 + Math.random()}s ease-in-out infinite`,
                                }}
                            />
                            <circle
                                cx={`${x}%`}
                                cy={`${y}%`}
                                r="5"
                                fill="none"
                                stroke={COLORS.secondary}
                                strokeWidth="0.1"
                                style={{
                                    animation: `${pulseAnimation} ${3 + Math.random()}s ease-in-out infinite`,
                                }}
                            />
                        </g>
                    ))}
                </svg>
            </Box>

            {/* Эффект сканирования */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '20px',
                    background: `linear-gradient(180deg, 
                        transparent,
                        ${COLORS.secondary}40,
                        ${COLORS.secondary}80,
                        ${COLORS.secondary}40,
                        transparent
                    )`,
                    animation: `${scanAnimation} 3s linear infinite`,
                    opacity: 0.5,
                    filter: 'blur(4px)',
                }}
            />

            {/* Круговые индикаторы */}
            {[1.2, 1.4, 1.6, 1.8].map((size, index) => (
                <Box
                    key={index}
                    sx={{
                        position: 'absolute',
                        width: `${100 * size}%`,
                        height: `${100 * size}%`,
                        border: `1px solid ${COLORS.secondary}${20 - index * 5}`,
                        borderRadius: '50%',
                        animation: `${pulseAnimation} ${6 + index * 2}s ease-in-out infinite`,
                        opacity: 0.8 - index * 0.2,
                    }}
                />
            ))}

            {/* Координатные линии */}
            <Box
                sx={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    opacity: 0.15,
                    '&::before, &::after': {
                        content: '""',
                        position: 'absolute',
                        background: `linear-gradient(90deg, transparent, ${COLORS.secondary}, transparent)`,
                    },
                    '&::before': {
                        width: '100%',
                        height: '1px',
                        top: '50%',
                        animation: `${pulseAnimation} 4s ease-in-out infinite`,
                    },
                    '&::after': {
                        width: '1px',
                        height: '100%',
                        left: '50%',
                        background: `linear-gradient(180deg, transparent, ${COLORS.secondary}, transparent)`,
                        animation: `${pulseAnimation} 4s ease-in-out infinite`,
                    },
                }}
            />

            {/* Текстовые метки */}
            {['ANALYZING MOVEMENT', 'CAPTURING DATA', 'PROCESSING'].map((text, index) => (
                <Typography
                    key={index}
                    variant="caption"
                    sx={{
                        position: 'absolute',
                        color: COLORS.secondary,
                        opacity: 0.7,
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        animation: `${pulseAnimation} ${2 + index}s ease-in-out infinite`,
                        top: `${20 + index * 20}%`,
                        right: '10%',
                        textShadow: `0 0 10px ${COLORS.secondary}40`,
                        '&::before': {
                            content: '"[ "',
                            color: COLORS.tertiary,
                        },
                        '&::after': {
                            content: '" ]"',
                            color: COLORS.tertiary,
                        },
                        zIndex: 2,
                    }}
                >
                    {text}
                </Typography>
            ))}
        </Box>
    );
};

const TechGrid = () => {
    const gridSize = 12;
    const [activePoints, setActivePoints] = useState([]);

    useEffect(() => {
        const interval = setInterval(() => {
            const newPoints = [];
            const numPoints = Math.floor(Math.random() * 3) + 1;

            for (let i = 0; i < numPoints; i++) {
                newPoints.push({
                    x: Math.floor(Math.random() * gridSize),
                    y: Math.floor(Math.random() * gridSize),
                    scale: Math.random() * 0.5 + 1
                });
            }

            setActivePoints(newPoints);
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const getPointStyle = (x, y) => {
        const isActive = activePoints.find(p => p.x === x && p.y === y);
        const baseStyle = {
            width: '4px',
            height: '4px',
            backgroundColor: COLORS.secondary,
            borderRadius: '50%',
            transition: 'all 0.5s ease-out',
        };

        if (isActive) {
            return {
                ...baseStyle,
                transform: `scale(${isActive.scale})`,
                boxShadow: `0 0 20px ${COLORS.secondary}`,
                backgroundColor: COLORS.tertiary,
            };
        }

        return baseStyle;
    };

    const getLineOpacity = (x, y) => {
        const distances = activePoints.map(point =>
            Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2))
        );
        const minDistance = Math.min(...distances);
        return Math.max(0.1, 1 - minDistance / 5);
    };

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                perspective: '1000px',
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    transform: 'rotateX(60deg) rotateZ(45deg)',
                    transformStyle: 'preserve-3d',
                    animation: `${waveAnimation} 8s ease-in-out infinite`,
                }}
            >
                {Array.from({ length: gridSize }).map((_, y) => (
                    <Box
                        key={y}
                        sx={{
                            display: 'flex',
                            gap: '20px',
                            mb: '20px',
                        }}
                    >
                        {Array.from({ length: gridSize }).map((_, x) => (
                            <Box
                                key={x}
                                sx={{
                                    position: 'relative',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        right: '-20px',
                                        top: '2px',
                                        width: '20px',
                                        height: '1px',
                                        background: `rgba(99, 102, 241, ${getLineOpacity(x, y)})`,
                                        transformOrigin: 'left center',
                                    },
                                    '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        bottom: '-20px',
                                        left: '2px',
                                        width: '1px',
                                        height: '20px',
                                        background: `rgba(99, 102, 241, ${getLineOpacity(x, y)})`,
                                        transformOrigin: 'top center',
                                    },
                                }}
                            >
                                <Box sx={getPointStyle(x, y)} />
                            </Box>
                        ))}
                    </Box>
                ))}
            </Box>
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'radial-gradient(circle at center, transparent 0%, rgba(10, 14, 36, 0.8) 100%)',
                    animation: `${pulseGlow} 4s ease-in-out infinite`,
                    pointerEvents: 'none',
                }}
            />
        </Box>
    );
};

function Home() {
    const navigate = useNavigate();
    const [heroInView, setHeroInView] = useState(false);
    const heroTitleRef = useRef(null);
    const [featureSectionInView, setFeatureSectionInView] = useState(false);
    const [animatedSectionInView, setAnimatedSectionInView] = useState(false);
    const [finalSectionInView, setFinalSectionInView] = useState(false);

    const featureSectionRef = useRef(null);
    const animatedSectionRef = useRef(null);
    const finalSectionRef = useRef(null);

    useEffect(() => {
        setHeroInView(true);

        setTimeout(() => {
            if (heroTitleRef.current) {
                heroTitleRef.current.classList.add('visible');
            }
        }, 500);

        const createObserver = (ref, setInView) => {
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setInView(true);
                        observer.disconnect();
                    }
                },
                { threshold: 0.1 }
            );

            if (ref.current) {
                observer.observe(ref.current);
            }

            return observer;
        };

        const featureObserver = createObserver(featureSectionRef, setFeatureSectionInView);
        const animatedObserver = createObserver(animatedSectionRef, setAnimatedSectionInView);
        const finalObserver = createObserver(finalSectionRef, setFinalSectionInView);

        return () => {
            featureObserver.disconnect();
            animatedObserver.disconnect();
            finalObserver.disconnect();
        };
    }, []);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: COLORS.dark, color: COLORS.white }}>
            <Navbar />
            <Box sx={{ flexGrow: 1 }}>
                <HeroSection>
                    {/* Декоративные элементы */}
                    <DecorativeGrid />
                    <AnimatedDot size={10} delay={0.2} color={COLORS.secondary} sx={{ top: '15%', left: '10%' }} />
                    <AnimatedDot size={16} delay={0.5} color={COLORS.tertiary} sx={{ top: '60%', left: '85%' }} />
                    <AnimatedDot size={12} delay={0.8} color={COLORS.secondaryLight} sx={{ top: '25%', left: '80%' }} />
                    <AnimatedDot size={8} delay={1.2} color={COLORS.secondary} sx={{ top: '70%', left: '20%' }} />

                    <AnimatedLine>
                        <svg>
                            <path d="M0,50 Q250,180 500,50 T1000,50" />
                            <path d="M0,150 Q250,280 500,150 T1000,150" />
                            <path d="M0,250 Q250,380 500,250 T1000,250" />
                        </svg>
                    </AnimatedLine>

                    <HeroContent inView={heroInView}>
                        <Box ref={heroTitleRef} sx={{
                            opacity: heroInView ? 1 : 0,
                            transform: heroInView ? 'translateY(0)' : 'translateY(30px)',
                            transition: 'opacity 0.6s ease, transform 0.6s ease',
                            transitionDelay: '0.2s',
                            position: 'relative',
                            '&.visible::after': {
                                width: '100%',
                            },
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                bottom: '-10px',
                                left: '0',
                                width: '0%',
                                height: '3px',
                                background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                transition: 'width 1s ease-out',
                                transitionDelay: '0.8s',
                            }
                        }}>
                            <LogoDanceFlow
                                variant="h1"
                                component="h1"
                                color="secondary"
                                sx={{
                                    fontSize: { xs: '2.5rem', md: '5rem' },
                                    textTransform: 'uppercase',
                                    background: 'linear-gradient(90deg, #ffffff 0%, #a5b4fc 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            />
                        </Box>

                        <HeroSubtitle variant="h4" paragraph inView={heroInView}>
                            Создавайте, визуализируйте и совершенствуйте танцевальные постановки с силой и динамикой
                        </HeroSubtitle>
                        <GlowingButton
                            variant="contained"
                            size="large"
                            onClick={() => navigate('/constructor')}
                            sx={{
                                mt: 2,
                                fontSize: '1.1rem',
                                py: 1.5,
                                px: 5,
                                borderRadius: '12px',
                                background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                color: COLORS.white,
                                fontWeight: 600,
                                textTransform: 'none',
                                fontFamily: '"Inter", "Golos Text", sans-serif',
                                boxShadow: `0 10px 25px rgba(30, 144, 255, 0.5)`,
                                transition: 'all 0.3s ease',
                                position: 'relative',
                                overflow: 'hidden',
                                opacity: heroInView ? 1 : 0,
                                transform: heroInView ? 'translateY(0)' : 'translateY(30px)',
                                transitionDelay: '0.6s',
                                '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: '-100%',
                                    width: '100%',
                                    height: '100%',
                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                                    transition: 'all 0.5s ease',
                                },
                                '&:hover': {
                                    boxShadow: `0 15px 30px rgba(30, 144, 255, 0.7)`,
                                    transform: 'translateY(-3px)',
                                    '&::after': {
                                        left: '100%',
                                    }
                                }
                            }}
                        >
                            Начать создавать
                        </GlowingButton>
                    </HeroContent>
                </HeroSection>

                <DiagonalDivider position="top" color={COLORS.darkLight} bgColor={COLORS.dark} />

                <AnimatedSection ref={animatedSectionRef}>
                    <Container maxWidth="lg">
                        <Box sx={{ position: 'relative', zIndex: 2 }}>
                            <Box sx={{ textAlign: 'center', mb: 6 }}>
                                <SectionTitle
                                    variant="h3"
                                    component="h2"
                                    inView={animatedSectionInView}
                                >
                                    Революция в создании хореографии
                                </SectionTitle>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        color: 'rgba(255, 255, 255, 0.8)',
                                        maxWidth: '800px',
                                        mx: 'auto',
                                        mt: 3,
                                        fontFamily: '"Inter", "Golos Text", sans-serif',
                                        opacity: animatedSectionInView ? 1 : 0,
                                        transform: animatedSectionInView ? 'translateY(0)' : 'translateY(20px)',
                                        transition: 'opacity 0.6s ease, transform 0.6s ease',
                                        transitionDelay: '0.3s',
                                    }}
                                >
                                    Профессиональные инструменты для создания и визуализации танцевальных постановок
                                </Typography>
                            </Box>

                            <Grid container spacing={4} sx={{ mb: 8 }}>
                                <Grid item xs={12} md={4}>
                                    <Box sx={{
                                        textAlign: 'center',
                                        p: 3,
                                        opacity: animatedSectionInView ? 1 : 0,
                                        transform: animatedSectionInView ? 'translateY(0)' : 'translateY(30px)',
                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                        transitionDelay: '0.3s',
                                    }}>
                                        <Box sx={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '20px',
                                            background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 20px',
                                            position: 'relative',
                                            '&::after': {
                                                content: '""',
                                                position: 'absolute',
                                                width: '100%',
                                                height: '100%',
                                                borderRadius: '20px',
                                                background: 'inherit',
                                                filter: 'blur(20px)',
                                                opacity: 0.5,
                                                zIndex: -1,
                                            }
                                        }}>
                                            <Typography variant="h4" sx={{ color: COLORS.white, fontWeight: 'bold' }}>⚙️</Typography>
                                        </Box>
                                        <Typography variant="h6" sx={{ color: COLORS.white, mb: 2, fontWeight: 600 }}>
                                            Конструктор хореографии
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                            Создавайте и визуализируйте положение танцоров на сцене. Загружайте видео хореографий и храните их в одном месте.
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box sx={{
                                        textAlign: 'center',
                                        p: 3,
                                        opacity: animatedSectionInView ? 1 : 0,
                                        transform: animatedSectionInView ? 'translateY(0)' : 'translateY(30px)',
                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                        transitionDelay: '0.5s',
                                    }}>
                                        <Box sx={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '20px',
                                            background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 20px',
                                            position: 'relative',
                                            '&::after': {
                                                content: '""',
                                                position: 'absolute',
                                                width: '100%',
                                                height: '100%',
                                                borderRadius: '20px',
                                                background: 'inherit',
                                                filter: 'blur(20px)',
                                                opacity: 0.5,
                                                zIndex: -1,
                                            }
                                        }}>
                                            <Typography variant="h4" sx={{ color: COLORS.white, fontWeight: 'bold' }}>👥</Typography>
                                        </Box>
                                        <Typography variant="h6" sx={{ color: COLORS.white, mb: 2, fontWeight: 600 }}>
                                            Управление командами
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                            Создавайте команды, делитесь проектами с хореографиями и сотрудничайте с танцорами.
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box sx={{
                                        textAlign: 'center',
                                        p: 3,
                                        opacity: animatedSectionInView ? 1 : 0,
                                        transform: animatedSectionInView ? 'translateY(0)' : 'translateY(30px)',
                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                        transitionDelay: '0.7s',
                                    }}>
                                        <Box sx={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '20px',
                                            background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 20px',
                                            position: 'relative',
                                            '&::after': {
                                                content: '""',
                                                position: 'absolute',
                                                width: '100%',
                                                height: '100%',
                                                borderRadius: '20px',
                                                background: 'inherit',
                                                filter: 'blur(20px)',
                                                opacity: 0.5,
                                                zIndex: -1,
                                            }
                                        }}>
                                            <Typography variant="h4" sx={{ color: COLORS.white, fontWeight: 'bold' }}>3D</Typography>
                                        </Box>
                                        <Typography variant="h6" sx={{ color: COLORS.white, mb: 2, fontWeight: 600 }}>
                                            3D Визуализация
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                            Преобразуйте ваши движения в 3D-анимации.
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>

                            <Box
                                sx={{
                                    p: 4,
                                    borderRadius: '24px',
                                    background: `linear-gradient(135deg, rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.1), rgba(${parseInt(COLORS.tertiary.slice(1, 3), 16)}, ${parseInt(COLORS.tertiary.slice(3, 5), 16)}, ${parseInt(COLORS.tertiary.slice(5, 7), 16)}, 0.1))`,
                                    border: `1px solid rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.2)`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    opacity: animatedSectionInView ? 1 : 0,
                                    transform: animatedSectionInView ? 'translateY(0)' : 'translateY(30px)',
                                    transition: 'opacity 0.8s ease, transform 0.8s ease',
                                    transitionDelay: '0.9s',
                                }}
                            >
                                <Grid container spacing={4} alignItems="center">
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="h4" sx={{ color: COLORS.white, mb: 3, fontWeight: 700 }}>
                                            Почему хореографы выбирают DanceFlow?
                                        </Typography>
                                        <Box sx={{ mb: 3 }}>
                                            <Typography sx={{
                                                color: 'rgba(255, 255, 255, 0.9)',
                                                mb: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                '&::before': {
                                                    content: '""',
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                                    marginRight: '12px',
                                                }
                                            }}>
                                                Экономия времени на 70% при создании и визуализации постановок
                                            </Typography>
                                            <Typography sx={{
                                                color: 'rgba(255, 255, 255, 0.9)',
                                                mb: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                '&::before': {
                                                    content: '""',
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                                    marginRight: '12px',
                                                }
                                            }}>
                                                Улучшение качества постановок благодаря 3D-предпросмотру
                                            </Typography>
                                            <Typography sx={{
                                                color: 'rgba(255, 255, 255, 0.9)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                '&::before': {
                                                    content: '""',
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                                    marginRight: '12px',
                                                }
                                            }}>
                                                Эффективная коммуникация с командой в одном приложении
                                            </Typography>
                                        </Box>
                                        <Button
                                            variant="contained"
                                            size="large"
                                            onClick={() => navigate('/register')}
                                            sx={{
                                                mt: 2,
                                                background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                                borderRadius: '12px',
                                                textTransform: 'none',
                                                fontSize: '1.1rem',
                                                fontWeight: 600,
                                                padding: '12px 30px',
                                                '&:hover': {
                                                    background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: `0 8px 20px rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.4)`,
                                                }
                                            }}
                                        >
                                            Попробовать бесплатно
                                        </Button>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{
                                            position: 'relative',
                                            height: '400px',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            background: COLORS.dark,
                                            border: `1px solid ${COLORS.secondary}20`,
                                            boxShadow: `0 0 30px ${COLORS.secondary}20`,
                                        }}>
                                            <MotionCapture />
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Box>
                    </Container>
                </AnimatedSection>

                <DiagonalDivider position="bottom" color={COLORS.dark} bgColor={COLORS.darkLight} />

                <Footer />
            </Box>
        </Box>
    );
}

export default Home; 