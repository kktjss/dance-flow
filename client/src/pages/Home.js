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
  0% { border-image-source: linear-gradient(45deg, ${COLORS.primary}, ${COLORS.tertiary}, ${COLORS.primary}); }
  25% { border-image-source: linear-gradient(90deg, ${COLORS.tertiary}, ${COLORS.primary}, ${COLORS.tertiary}); }
  50% { border-image-source: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.tertiary}, ${COLORS.primary}); }
  75% { border-image-source: linear-gradient(180deg, ${COLORS.tertiary}, ${COLORS.primary}, ${COLORS.tertiary}); }
  100% { border-image-source: linear-gradient(225deg, ${COLORS.primary}, ${COLORS.tertiary}, ${COLORS.primary}); }
`;

const floatAnimation = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
  100% { transform: translateY(0px); }
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

// Стилизованные компоненты с анимациями
const StyledCard = styled(Card)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.4s cubic-bezier(0.17, 0.67, 0.83, 0.67)',
    backgroundColor: 'rgba(30, 15, 55, 0.95)', // Темно-фиолетовый фон
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
        background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.tertiary})`,
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
        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
        transition: 'width 0.4s ease-out',
    },
    '&:hover': {
        transform: 'translateY(-12px) scale(1.02)',
        boxShadow: `0 20px 30px rgba(138, 43, 226, 0.3)`,
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

const AnimatedDot = styled(Box)(({ size = 6, delay = 0, color = COLORS.primary }) => ({
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
        background: `linear-gradient(45deg, ${COLORS.primary}, ${COLORS.tertiary}, ${COLORS.secondary})`,
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
        background: `linear-gradient(135deg, rgba(10, 14, 36, 0.8) 0%, rgba(138, 43, 226, 0.7) 100%)`,
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
        background: 'linear-gradient(90deg, #6366F1, #3B82F6)',
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
        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
        transition: 'width 0.8s ease-out',
        transitionDelay: '0.3s',
    }
}));

// Diagonal section divider component
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

// Wave animation for the canvas section
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

// Добавим стилизованный компонент для логотипа DanceFlow
const LogoDanceFlow = ({ variant = "h1", component = "span", color = "primary", ...props }) => (
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

// Обновим компонент карточки возможностей - исправим "кривость"
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
                            background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.tertiary})`,
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
                            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
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

function Home() {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [heroInView, setHeroInView] = useState(false);
    const heroTitleRef = useRef(null);
    const [featureSectionInView, setFeatureSectionInView] = useState(false);
    const [animatedSectionInView, setAnimatedSectionInView] = useState(false);
    const [finalSectionInView, setFinalSectionInView] = useState(false);

    const featureSectionRef = useRef(null);
    const animatedSectionRef = useRef(null);
    const finalSectionRef = useRef(null);

    useEffect(() => {
        // Set hero in view immediately for better UX
        setHeroInView(true);

        setTimeout(() => {
            if (heroTitleRef.current) {
                heroTitleRef.current.classList.add('visible');
            }
        }, 500);

        // Create intersection observers for sections
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

        // Canvas animation code unchanged
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width = window.innerWidth;
        const height = canvas.height = 400;

        // Flow particles settings
        const particles = [];
        const particleCount = 120;

        // Create particles code unchanged
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 4 + 1,
                speedX: Math.random() * 3 - 1.5,
                speedY: Math.random() * 3 - 1.5,
                color: i % 5 === 0 ? '#6366F1' : i % 7 === 0 ? '#3B82F6' : '#ffffff',
                opacity: Math.random() * 0.7 + 0.3,
                edges: Math.floor(Math.random() * 3) + 3, // 3-5 edges for angular shapes
            });
        }

        // Draw the animation function unchanged
        function draw() {
            // Set semi-transparent background
            ctx.fillStyle = 'rgba(10, 14, 36, 0.15)';
            ctx.fillRect(0, 0, width, height);

            // Draw each particle
            particles.forEach(particle => {
                ctx.save();
                ctx.beginPath();

                // Create angular shapes instead of circles
                if (particle.edges === 3) { // Triangle
                    const size = particle.size * 1.5;
                    ctx.moveTo(particle.x, particle.y - size);
                    ctx.lineTo(particle.x + size, particle.y + size);
                    ctx.lineTo(particle.x - size, particle.y + size);
                } else if (particle.edges === 4) { // Square/Diamond
                    const rotation = Date.now() * 0.001 % (Math.PI * 2);
                    ctx.translate(particle.x, particle.y);
                    ctx.rotate(rotation);
                    ctx.rect(-particle.size, -particle.size, particle.size * 2, particle.size * 2);
                    ctx.translate(-particle.x, -particle.y);
                } else { // Pentagon
                    const size = particle.size;
                    ctx.moveTo(particle.x + size * Math.cos(0), particle.y + size * Math.sin(0));
                    for (let i = 1; i <= 5; i++) {
                        const angle = i * 2 * Math.PI / 5;
                        ctx.lineTo(particle.x + size * Math.cos(angle), particle.y + size * Math.sin(angle));
                    }
                }

                ctx.closePath();
                ctx.fillStyle = `${particle.color}${Math.floor(particle.opacity * 255).toString(16).padStart(2, '0')}`;
                ctx.fill();
                ctx.restore();

                // Update position with slight acceleration for more dynamic motion
                particle.speedX += (Math.random() - 0.5) * 0.1;
                particle.speedY += (Math.random() - 0.5) * 0.1;

                // Cap speed
                particle.speedX = Math.max(-2.5, Math.min(2.5, particle.speedX));
                particle.speedY = Math.max(-2.5, Math.min(2.5, particle.speedY));

                particle.x += particle.speedX;
                particle.y += particle.speedY;

                // Bounce off edges with slight random variation
                if (particle.x < 0 || particle.x > width) {
                    particle.speedX *= -1;
                    particle.speedX += (Math.random() - 0.5) * 0.5;
                }
                if (particle.y < 0 || particle.y > height) {
                    particle.speedY *= -1;
                    particle.speedY += (Math.random() - 0.5) * 0.5;
                }
            });

            // Draw connections between close particles with more angular line style
            particles.forEach((particle, i) => {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particle.x - particles[j].x;
                    const dy = particle.y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 80) {
                        ctx.beginPath();

                        // More angular connection lines
                        const midX = (particle.x + particles[j].x) / 2;
                        const midY = (particle.y + particles[j].y) / 2 + (Math.random() * 10 - 5);

                        ctx.moveTo(particle.x, particle.y);
                        ctx.lineTo(midX, midY);
                        ctx.lineTo(particles[j].x, particles[j].y);

                        ctx.strokeStyle = `rgba(99, 102, 241, ${0.3 * (1 - distance / 80)})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            });
        }

        const interval = setInterval(draw, 30);

        return () => {
            clearInterval(interval);
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
                    {/* Decorative elements */}
                    <DecorativeGrid />
                    <AnimatedDot size={10} delay={0.2} color={COLORS.primary} sx={{ top: '15%', left: '10%' }} />
                    <AnimatedDot size={16} delay={0.5} color={COLORS.secondary} sx={{ top: '60%', left: '85%' }} />
                    <AnimatedDot size={12} delay={0.8} color={COLORS.tertiary} sx={{ top: '25%', left: '80%' }} />
                    <AnimatedDot size={8} delay={1.2} color={COLORS.primary} sx={{ top: '70%', left: '20%' }} />

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
                                background: 'linear-gradient(90deg, #6366F1, #3B82F6)',
                                transition: 'width 1s ease-out',
                                transitionDelay: '0.8s',
                            }
                        }}>
                            <LogoDanceFlow
                                variant="h1"
                                component="h1"
                                color="primary"
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
                                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                                color: COLORS.white,
                                fontWeight: 600,
                                textTransform: 'none',
                                fontFamily: '"Inter", "Golos Text", sans-serif',
                                boxShadow: `0 10px 25px rgba(138, 43, 226, 0.5)`,
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
                                    boxShadow: `0 15px 30px rgba(138, 43, 226, 0.7)`,
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

                <FeatureSection ref={featureSectionRef}>
                    <Container maxWidth="lg">
                        <Box sx={{ textAlign: 'center', mb: 8 }}>
                            <SectionTitle
                                variant="h3"
                                component="h2"
                                gutterBottom
                                inView={featureSectionInView}
                            >
                                Возможности
                            </SectionTitle>
                            <Typography
                                variant="h6"
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    maxWidth: '700px',
                                    mx: 'auto',
                                    fontFamily: '"Inter", "Golos Text", sans-serif',
                                    fontWeight: 400,
                                    mt: 3,
                                    opacity: featureSectionInView ? 1 : 0,
                                    transform: featureSectionInView ? 'translateY(0)' : 'translateY(20px)',
                                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                                    transitionDelay: '0.3s',
                                }}
                            >
                                Инструменты, которые помогут воплотить ваши идеи в движение
                            </Typography>
                        </Box>

                        <Grid container spacing={5}>
                            <Grid item xs={12} md={4}>
                                <Box
                                    sx={{
                                        opacity: featureSectionInView ? 1 : 0,
                                        transform: featureSectionInView ? 'translateY(0)' : 'translateY(50px)',
                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                        transitionDelay: '0.2s',
                                        height: '100%'
                                    }}
                                >
                                    <FeatureCard
                                        title="Конструктор хореографии"
                                        description="Создавайте и визуализируйте танцевальные постановки с помощью продвинутых инструментов 3D-анимации. Загружайте видео и преобразуйте их в анимированные последовательности."
                                        onClick={() => navigate('/constructor')}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box
                                    sx={{
                                        opacity: featureSectionInView ? 1 : 0,
                                        transform: featureSectionInView ? 'translateY(0)' : 'translateY(50px)',
                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                        transitionDelay: '0.4s',
                                        height: '100%'
                                    }}
                                >
                                    <FeatureCard
                                        title="Управление командами"
                                        description="Создавайте команды, делитесь хореографией и сотрудничайте с танцорами. Управляйте правами доступа и отслеживайте прогресс участников."
                                        onClick={() => navigate('/teams')}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box
                                    sx={{
                                        opacity: featureSectionInView ? 1 : 0,
                                        transform: featureSectionInView ? 'translateY(0)' : 'translateY(50px)',
                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                        transitionDelay: '0.6s',
                                        height: '100%'
                                    }}
                                >
                                    <FeatureCard
                                        title="3D Визуализация"
                                        description="Преобразуйте ваши танцевальные движения в 3D-анимации. Применяйте движения к разным моделям и смотрите, как они будут выглядеть в пространстве."
                                        onClick={() => navigate('/constructor')}
                                    />
                                </Box>
                            </Grid>
                        </Grid>
                    </Container>
                </FeatureSection>

                <DiagonalDivider position="bottom" color={COLORS.darkLight} bgColor={COLORS.dark} />

                <AnimatedSection ref={animatedSectionRef}>
                    <Container maxWidth="lg">
                        <Box sx={{ position: 'relative', zIndex: 2 }}>
                            <Box sx={{ textAlign: 'center', mb: 6 }}>
                                <SectionTitle
                                    variant="h3"
                                    component="h2"
                                    inView={animatedSectionInView}
                                >
                                    Погружение в танец
                                </SectionTitle>
                            </Box>

                            <Box
                                sx={{
                                    height: 400,
                                    mb: 4,
                                    borderRadius: '24px',
                                    overflow: 'hidden',
                                    boxShadow: `0 10px 30px rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0.3)`,
                                    border: `1px solid rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0.2)`,
                                    position: 'relative',
                                    opacity: animatedSectionInView ? 1 : 0,
                                    transform: animatedSectionInView ? 'translateY(0)' : 'translateY(30px)',
                                    transition: 'opacity 0.8s ease, transform 0.8s ease',
                                    transitionDelay: '0.3s',
                                }}
                            >
                                <WaveBox />
                                <canvas
                                    ref={canvasRef}
                                    style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}
                                />
                            </Box>

                            <Box sx={{
                                textAlign: 'center',
                                maxWidth: '800px',
                                mx: 'auto',
                                mt: 6,
                                position: 'relative',
                                opacity: animatedSectionInView ? 1 : 0,
                                transform: animatedSectionInView ? 'translateY(0)' : 'translateY(20px)',
                                transition: 'opacity 0.8s ease, transform 0.8s ease',
                                transitionDelay: '0.6s',
                            }}>
                                <Typography
                                    variant="h5"
                                    sx={{
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        fontFamily: '"Inter", "Golos Text", sans-serif',
                                        fontWeight: 500,
                                        position: 'relative',
                                        display: 'inline-block',
                                        '&::before, &::after': {
                                            content: '""',
                                            position: 'absolute',
                                            width: '20px',
                                            height: '2px',
                                            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                                            top: '50%',
                                        },
                                        '&::before': {
                                            left: '-30px',
                                        },
                                        '&::after': {
                                            right: '-30px',
                                        }
                                    }}
                                >
                                    "Танец — это тайный язык души"
                                </Typography>
                            </Box>
                        </Box>
                    </Container>
                </AnimatedSection>

                <DiagonalDivider position="top" color={COLORS.dark} bgColor={COLORS.darkLight} />

                <Box sx={{ background: `linear-gradient(135deg, ${COLORS.darkLight} 0%, ${COLORS.dark} 100%)`, py: 8 }} ref={finalSectionRef}>
                    <Container maxWidth="lg">
                        <Grid container spacing={5} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Box sx={{
                                    opacity: finalSectionInView ? 1 : 0,
                                    transform: finalSectionInView ? 'translateX(0)' : 'translateX(-30px)',
                                    transition: 'opacity 0.8s ease, transform 0.8s ease',
                                }}>
                                    <Typography
                                        variant="h4"
                                        gutterBottom
                                        sx={{
                                            fontWeight: 700,
                                            fontFamily: '"Inter", "Golos Text", sans-serif',
                                            color: COLORS.white,
                                            position: 'relative',
                                            display: 'inline-block',
                                            mb: 3,
                                            '&::after': {
                                                content: '""',
                                                position: 'absolute',
                                                bottom: '-8px',
                                                left: 0,
                                                width: '60px',
                                                height: '3px',
                                                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                                            }
                                        }}
                                    >
                                        <LogoDanceFlow
                                            variant="h4"
                                            component="span"
                                            color="primary"
                                            sx={{ fontWeight: 700 }}
                                        />
                                        <Typography variant="h4" component="span" sx={{ ml: 2 }}>
                                            - Готовы начать?
                                        </Typography>
                                    </Typography>
                                    <Typography
                                        variant="h6"
                                        paragraph
                                        sx={{
                                            fontWeight: 400,
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            fontFamily: '"Inter", "Golos Text", sans-serif',
                                            mb: 4,
                                            mt: 3
                                        }}
                                    >
                                        Создайте свою первую танцевальную постановку прямо сейчас
                                    </Typography>
                                    <GlowingButton
                                        variant="contained"
                                        size="large"
                                        sx={{
                                            background: `linear-gradient(90deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
                                            color: COLORS.white,
                                            borderRadius: '12px',
                                            fontFamily: '"Inter", "Golos Text", sans-serif',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            py: 1.5,
                                            px: 4,
                                            boxShadow: `0 10px 25px rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0.4)`,
                                            transition: 'all 0.3s ease',
                                            position: 'relative',
                                            overflow: 'hidden',
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
                                                boxShadow: `0 15px 30px rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0.6)`,
                                                transform: 'translateY(-3px)',
                                                '&::after': {
                                                    left: '100%',
                                                }
                                            }
                                        }}
                                        onClick={() => navigate('/constructor')}
                                    >
                                        Начать бесплатно
                                    </GlowingButton>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Box
                                    sx={{
                                        p: 4,
                                        borderRadius: '20px',
                                        background: `rgba(${parseInt(COLORS.darkLight.slice(1, 3), 16)}, ${parseInt(COLORS.darkLight.slice(3, 5), 16)}, ${parseInt(COLORS.darkLight.slice(5, 7), 16)}, 0.9)`,
                                        border: `1px solid rgba(${parseInt(COLORS.primary.slice(1, 3), 16)}, ${parseInt(COLORS.primary.slice(3, 5), 16)}, ${parseInt(COLORS.primary.slice(5, 7), 16)}, 0.2)`,
                                        position: 'relative',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '4px',
                                            height: '100%',
                                            background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.tertiary} 100%)`,
                                            borderTopLeftRadius: '20px',
                                            borderBottomLeftRadius: '20px',
                                        },
                                        opacity: finalSectionInView ? 1 : 0,
                                        transform: finalSectionInView ? 'translateX(0)' : 'translateX(30px)',
                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                        transitionDelay: '0.3s',
                                    }}
                                >
                                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 2.5, fontFamily: '"Inter", "Golos Text", sans-serif', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                                        <Box component="span" sx={{ color: COLORS.primary, mr: 2, fontSize: '1.2rem', fontWeight: 'bold' }}>—</Box>
                                        Создавайте хореографию с помощью 3D-анимации
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 2.5, fontFamily: '"Inter", "Golos Text", sans-serif', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                                        <Box component="span" sx={{ color: COLORS.primary, mr: 2, fontSize: '1.2rem', fontWeight: 'bold' }}>—</Box>
                                        Управляйте командами и доступом
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 2.5, fontFamily: '"Inter", "Golos Text", sans-serif', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                                        <Box component="span" sx={{ color: COLORS.primary, mr: 2, fontSize: '1.2rem', fontWeight: 'bold' }}>—</Box>
                                        Делитесь постановками с другими
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontFamily: '"Inter", "Golos Text", sans-serif', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                                        <Box component="span" sx={{ color: COLORS.primary, mr: 2, fontSize: '1.2rem', fontWeight: 'bold' }}>—</Box>
                                        Отслеживайте прогресс и вносите изменения
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Container>
                </Box>
            </Box>
            <Footer />
        </Box>
    );
}

export default Home; 