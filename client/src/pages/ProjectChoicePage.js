import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    alpha,
    IconButton,
    Container,
    Grid,
    Paper,
    Chip
} from '@mui/material';
import {
    Build as ConstructorIcon,
    Visibility as ViewerIcon,
    ArrowBack as BackIcon,
    Group as TeamIcon,
    FolderOpen as ProjectIcon,
    PlayArrow as PlayIcon,
    Settings as SettingsIcon,
    Security as SecurityIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { styled, keyframes } from '@mui/material/styles';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { COLORS } from '../constants/colors';

const API_URL = 'http://localhost:5000/api';

// Анимации
const slideInFromLeft = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(0); }
`;

const slideInFromRight = keyframes`
  0% { transform: translateX(100%); }
  100% { transform: translateX(0); }
`;

const slideInFromTop = keyframes`
  0% { transform: translateY(-50px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px ${alpha(COLORS.primary, 0.3)}; }
  50% { box-shadow: 0 0 40px ${alpha(COLORS.primary, 0.6)}; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

// Анимации (как в TeamManagement)
const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

// Декоративные круги (как в TeamManagement)
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

// Основная стилизованная карточка (как StyledPaper в TeamManagement)
const MainCard = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(6),
    borderRadius: '24px',
    backgroundColor: 'rgba(17, 21, 54, 0.9)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
    border: '1px solid rgba(138, 43, 226, 0.2)',
    position: 'relative',
    overflow: 'hidden',
    animation: `${fadeIn} 0.8s ease-out forwards`,
    backdropFilter: 'blur(20px)',
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
    },
    '&::after': {
        content: '""',
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '200%',
        height: '200%',
        background: `radial-gradient(circle, ${alpha(COLORS.primary, 0.05)} 0%, transparent 70%)`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
    }
}));

// Навигационная панель проекта
const ProjectHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(4),
    padding: theme.spacing(2, 3),
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
}));

// Заголовок страницы
const PageTitle = styled(Typography)(({ theme }) => ({
    fontWeight: 700,
    color: '#FFFFFF',
    marginBottom: theme.spacing(1),
    position: 'relative',
    display: 'inline-block',
    textAlign: 'center',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: -8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '60%',
        height: 3,
        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
        borderRadius: 2
    }
}));

// Контейнер для вариантов выбора
const ChoicesContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    marginTop: theme.spacing(4),
    [theme.breakpoints.up('md')]: {
        flexDirection: 'row',
        gap: theme.spacing(4),
    }
}));

// Карточка варианта выбора
const ChoiceCard = styled(Box)(({ theme, variant, disabled }) => ({
    flex: 1,
    padding: theme.spacing(4),
    borderRadius: '20px',
    background: variant === 'constructor'
        ? `linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(75, 0, 130, 0.15) 100%)`
        : `linear-gradient(135deg, rgba(32, 178, 170, 0.15) 0%, rgba(0, 128, 128, 0.15) 100%)`,
    border: variant === 'constructor'
        ? `2px solid ${alpha(COLORS.secondary, 0.3)}`
        : `2px solid ${alpha(COLORS.tertiary, 0.3)}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    opacity: disabled ? 0.5 : 1,
    animation: `${fadeIn} 0.6s ease-out forwards`,

    '&::before': {
        content: '""',
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: '22px',
        background: variant === 'constructor'
            ? `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`
            : `linear-gradient(135deg, ${COLORS.tertiary}, ${COLORS.teal})`,
        opacity: 0,
        transition: 'opacity 0.3s ease',
        zIndex: -1,
    },

    '&:hover:not(:disabled)': {
        transform: 'translateY(-8px) scale(1.02)',
        boxShadow: variant === 'constructor'
            ? `0 20px 40px ${alpha(COLORS.secondary, 0.3)}`
            : `0 20px 40px ${alpha(COLORS.tertiary, 0.3)}`,
        '&::before': {
            opacity: 1,
        }
    },

    ...(disabled && {
        filter: 'grayscale(0.7)',
        '&:hover': {
            transform: 'none',
            boxShadow: 'none',
        }
    })
}));

// Иконка варианта
const ChoiceIcon = styled(Box)(({ theme, variant }) => ({
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: variant === 'constructor'
        ? `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`
        : `linear-gradient(135deg, ${COLORS.tertiary}, ${COLORS.teal})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    marginBottom: theme.spacing(3),
    animation: `${float} 3s ease-in-out infinite`,
    boxShadow: variant === 'constructor'
        ? `0 0 30px ${alpha(COLORS.secondary, 0.4)}`
        : `0 0 30px ${alpha(COLORS.tertiary, 0.4)}`,
}));

// Кнопка действия
const ActionButton = styled(Box)(({ theme, variant, disabled }) => ({
    marginTop: theme.spacing(3),
    padding: theme.spacing(1.5, 3),
    borderRadius: '25px',
    background: !disabled ? (variant === 'constructor'
        ? `linear-gradient(45deg, ${COLORS.secondary}, ${COLORS.primary})`
        : `linear-gradient(45deg, ${COLORS.tertiary}, ${COLORS.teal})`) : 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    border: disabled ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',

    '&:hover': {
        ...(disabled ? {} : {
            transform: 'translateY(-3px)',
            boxShadow: variant === 'constructor'
                ? `0 10px 25px ${alpha(COLORS.secondary, 0.4)}`
                : `0 10px 25px ${alpha(COLORS.tertiary, 0.4)}`,
        })
    }
}));

// Информационный баннер
const InfoBanner = styled(Box)(({ theme }) => ({
    background: `linear-gradient(90deg, ${alpha(COLORS.tertiary, 0.1)}, ${alpha(COLORS.teal, 0.1)})`,
    border: `1px solid ${alpha(COLORS.tertiary, 0.3)}`,
    borderRadius: '12px',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(4),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
}));

const ProjectChoicePage = () => {
    const { teamId, projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [team, setTeam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null);

    // Функция для определения роли пользователя в команде
    const getUserRole = (team, userId) => {
        if (!team || !userId) {
            return null;
        }

        // Нормализация ID пользователя
        if (typeof userId === 'object') {
            userId = userId._id || userId.id;
        }

        // Проверяем, является ли пользователь владельцем
        if (team.owner) {
            const ownerId = typeof team.owner === 'object' ?
                (team.owner._id || team.owner.id) : team.owner;

            if (ownerId === userId) {
                return 'owner';
            }
        }

        // Проверяем роль в списке участников
        if (team.members && Array.isArray(team.members)) {
            const member = team.members.find(m => {
                if (!m || !m.userId) return false;

                const memberId = typeof m.userId === 'object' ?
                    (m.userId._id || m.userId.id) : m.userId;

                return memberId === userId;
            });

            return member ? member.role : null;
        }

        return null;
    };

    // Проверяем, может ли пользователь использовать конструктор
    const canUseConstructor = (role) => {
        return role === 'owner' || role === 'editor';
    };

    // Определяем, показывать ли только просмотр
    const isViewerOnly = !canUseConstructor(userRole) && userRole;

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error('Не найден токен авторизации');
                }

                // Получаем данные о проекте и команде параллельно
                const [projectResponse, teamResponse] = await Promise.all([
                    axios.get(`${API_URL}/projects/${projectId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    axios.get(`${API_URL}/teams/${teamId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                setProject(projectResponse.data);
                setTeam(teamResponse.data);

                // Определяем роль текущего пользователя
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    const userId = user._id || user.id;
                    const role = getUserRole(teamResponse.data, userId);
                    setUserRole(role);

                    console.log('User role determined:', role);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError(err.response?.data?.message || err.message || 'Ошибка загрузки данных');
            } finally {
                setLoading(false);
            }
        };

        if (teamId && projectId) {
            fetchData();
        }
    }, [teamId, projectId]);

    const handleGoToConstructor = () => {
        navigate(`/teams/${teamId}/projects/${projectId}/constructor`);
    };

    const handleGoToViewer = () => {
        navigate(`/teams/${teamId}/projects/${projectId}/viewer`);
    };

    const handleGoBack = () => {
        navigate('/teams');
    };

    if (loading) {
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: `linear-gradient(135deg, #0a0e24 0%, #111536 100%)`,
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Navbar />
                <CircularProgress size={80} sx={{ color: COLORS.tertiary, mb: 3 }} />
                <Typography variant="h5" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Загрузка проекта...
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: `linear-gradient(135deg, #0a0e24 0%, #111536 100%)`,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 3
            }}>
                <Navbar />
                <Alert
                    severity="error"
                    sx={{
                        maxWidth: 600,
                        borderRadius: '16px',
                        backgroundColor: 'rgba(17, 21, 54, 0.9)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(244, 67, 54, 0.3)',
                        '& .MuiAlert-icon': { color: COLORS.tertiary },
                        '& .MuiAlert-message': { fontSize: '1.2rem' }
                    }}
                >
                    {error}
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: `linear-gradient(135deg, #0a0e24 0%, #111536 100%)`,
            position: 'relative',
        }}>
            {/* Декоративные элементы как в TeamManagement */}
            <DecorativeCircle top="10%" left="-8%" size={250} color={COLORS.primary} delay={0.2} />
            <DecorativeCircle top="60%" left="85%" size={180} color={COLORS.tertiary} delay={0.4} />
            <DecorativeCircle top="85%" left="5%" size={120} color={COLORS.secondary} delay={0.6} />

            <Navbar />

            <Container component="main" maxWidth="lg" sx={{ py: 6, mt: 4, position: 'relative', zIndex: 2 }}>
                <MainCard>
                    {/* Навигация проекта */}
                    <ProjectHeader>
                        <IconButton
                            onClick={handleGoBack}
                            sx={{
                                color: '#FFFFFF',
                                background: alpha(COLORS.primary, 0.2),
                                '&:hover': { background: alpha(COLORS.primary, 0.3) }
                            }}
                        >
                            <BackIcon />
                        </IconButton>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <TeamIcon sx={{ color: COLORS.secondary, fontSize: 20 }} />
                            <Typography variant="body1" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                                {team?.name}
                            </Typography>
                            <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                /
                            </Typography>
                            <ProjectIcon sx={{ color: COLORS.tertiary, fontSize: 20 }} />
                            <Typography variant="body1" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                                {project?.name}
                            </Typography>
                        </Box>

                        <Chip
                            icon={<SecurityIcon />}
                            label={userRole === 'owner' ? 'Владелец' : userRole === 'editor' ? 'Редактор' : 'Просмотр'}
                            sx={{
                                background: userRole === 'owner'
                                    ? `linear-gradient(45deg, ${COLORS.primary}, ${COLORS.secondary})`
                                    : userRole === 'editor'
                                        ? `linear-gradient(45deg, ${COLORS.secondary}, ${COLORS.primary})`
                                        : `linear-gradient(45deg, ${COLORS.tertiary}, ${COLORS.teal})`,
                                color: '#FFFFFF',
                                fontWeight: 600,
                                '& .MuiChip-icon': { color: '#FFFFFF' }
                            }}
                        />
                    </ProjectHeader>

                    {/* Информационный баннер для viewer-only */}
                    {isViewerOnly && (
                        <InfoBanner>
                            <SecurityIcon sx={{ color: COLORS.tertiary }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                                Ваша роль ограничивает доступ только к просмотру проекта.
                                Права на редактирование имеют владельцы и редакторы команды.
                            </Typography>
                        </InfoBanner>
                    )}

                    {/* Заголовок */}
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <PageTitle variant="h4">
                            Выберите режим работы
                        </PageTitle>
                        <Typography variant="body1" sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '1.1rem',
                            mt: 2
                        }}>
                            Определите, как вы хотите взаимодействовать с проектом
                        </Typography>
                    </Box>

                    {/* Варианты выбора */}
                    <ChoicesContainer>
                        {/* Конструктор - только если есть доступ */}
                        {canUseConstructor(userRole) && (
                            <ChoiceCard
                                variant="constructor"
                                onClick={handleGoToConstructor}
                            >
                                <ChoiceIcon variant="constructor">
                                    <ConstructorIcon sx={{ fontSize: 40, color: '#FFFFFF' }} />
                                </ChoiceIcon>

                                <Typography variant="h5" sx={{
                                    fontWeight: 700,
                                    color: '#FFFFFF',
                                    textAlign: 'center',
                                    mb: 2
                                }}>
                                    Конструктор
                                </Typography>

                                <Typography variant="body1" sx={{
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    textAlign: 'center',
                                    lineHeight: 1.6,
                                    mb: 1
                                }}>
                                    Полный доступ к редактированию
                                </Typography>

                                <Typography variant="body2" sx={{
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    textAlign: 'center',
                                    lineHeight: 1.4,
                                    fontSize: '0.9rem'
                                }}>
                                    Создавайте, изменяйте и настраивайте все элементы проекта
                                </Typography>

                                <ActionButton variant="constructor">
                                    <SettingsIcon sx={{ fontSize: 20 }} />
                                    Перейти к редактированию
                                </ActionButton>
                            </ChoiceCard>
                        )}

                        {/* Просмотр */}
                        <ChoiceCard
                            variant="viewer"
                            onClick={handleGoToViewer}
                        >
                            <ChoiceIcon variant="viewer">
                                <ViewerIcon sx={{ fontSize: 40, color: '#FFFFFF' }} />
                            </ChoiceIcon>

                            <Typography variant="h5" sx={{
                                fontWeight: 700,
                                color: '#FFFFFF',
                                textAlign: 'center',
                                mb: 2
                            }}>
                                {isViewerOnly ? 'Просмотр проекта' : 'Режим просмотра'}
                            </Typography>

                            <Typography variant="body1" sx={{
                                color: 'rgba(255, 255, 255, 0.8)',
                                textAlign: 'center',
                                lineHeight: 1.6,
                                mb: 1
                            }}>
                                {isViewerOnly ? 'Презентационный режим' : 'Демонстрация без редактирования'}
                            </Typography>

                            <Typography variant="body2" sx={{
                                color: 'rgba(255, 255, 255, 0.6)',
                                textAlign: 'center',
                                lineHeight: 1.4,
                                fontSize: '0.9rem'
                            }}>
                                {isViewerOnly
                                    ? 'Просматривайте готовый проект в оптимизированном интерфейсе'
                                    : 'Посмотрите на проект глазами зрителя'
                                }
                            </Typography>

                            <ActionButton variant="viewer">
                                <PlayIcon sx={{ fontSize: 20 }} />
                                {isViewerOnly ? 'Открыть проект' : 'Начать просмотр'}
                            </ActionButton>
                        </ChoiceCard>
                    </ChoicesContainer>
                </MainCard>
            </Container>
        </Box>
    );
};

export default ProjectChoicePage; 