import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemText,
    Divider,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Paper,
    CircularProgress,
    Alert,
    Avatar,
    Chip,
    useTheme
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    Add as AddIcon,
    Notifications as NotificationsIcon,
    Timeline as TimelineIcon,
    History as HistoryIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';
import { styled, keyframes } from '@mui/material/styles';
import Navbar from '../components/Navbar';
import ChoreographyList from '../components/ChoreographyList';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { COLORS } from '../constants/colors';

// Анимации
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

// Стилизованные компоненты
const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(4),
    borderRadius: '20px',
    backgroundColor: 'rgba(17, 21, 54, 0.9)',
    boxShadow: `0 10px 30px rgba(0, 0, 0, 0.2)`,
    border: '1px solid rgba(30, 144, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
    animation: `${fadeIn} 0.5s ease-out forwards`,
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '3px',
        background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
    }
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: '12px',
    fontWeight: 600,
    fontFamily: '"Inter", "Golos Text", sans-serif',
    background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
    backgroundSize: '200% 200%',
    animation: `${gradientShift} 5s ease infinite`,
    color: COLORS.white,
    transition: 'all 0.3s ease',
    boxShadow: `0 8px 20px rgba(30, 144, 255, 0.3)`,
    '&:hover': {
        boxShadow: `0 10px 25px rgba(30, 144, 255, 0.5)`,
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
            borderColor: COLORS.secondaryLight,
        },
        '&.Mui-focused fieldset': {
            borderColor: COLORS.secondary,
            boxShadow: `0 0 10px rgba(30, 144, 255, 0.3)`,
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

const StyledDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        backgroundColor: 'rgba(17, 21, 54, 0.95)',
        color: COLORS.white,
        borderRadius: '20px',
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.4)`,
        border: `1px solid rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.2)`,
        overflow: 'hidden',
        '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '3px',
            background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        }
    },
    '& .MuiDialogTitle-root': {
        color: COLORS.white,
        fontFamily: '"Inter", "Golos Text", sans-serif',
        fontWeight: 700,
    },
    '& .MuiDialogContent-root': {
        color: 'rgba(255, 255, 255, 0.9)',
    }
}));

const UserInfoCard = styled(Box)(({ theme }) => ({
    padding: theme.spacing(3),
    borderRadius: '20px',
    backgroundColor: 'rgba(17, 21, 54, 0.9)',
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

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontFamily: '"Inter", "Golos Text", sans-serif',
    fontWeight: 700,
    color: COLORS.white,
    position: 'relative',
    marginBottom: theme.spacing(3),
    paddingLeft: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: '4px',
        height: '70%',
        background: `linear-gradient(180deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        borderRadius: '2px',
    }
}));

const FloatingIcon = styled(Box)(({ delay = 0 }) => ({
    position: 'absolute',
    opacity: 0.2,
    color: COLORS.tertiary,
    animation: `${pulseAnimation} 3s ${delay}s infinite ease-in-out`,
    zIndex: 0,
}));

const StyledHistoryItem = styled(ListItem)(({ theme }) => ({
    borderRadius: '12px',
    marginBottom: theme.spacing(1.5),
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        transform: 'translateY(-2px)',
    }
}));

// Используем встроенные цвета темы для стилизованного чипа
const StyledChip = styled(Chip)(({ theme }) => ({
    fontWeight: 600,
    marginRight: theme.spacing(1),
    borderRadius: '8px',
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

const API_URL = 'http://localhost:5000/api';

function Dashboard() {
    const navigate = useNavigate();
    const theme = useTheme();
    const [user, setUser] = useState(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
    const [settings, setSettings] = useState({
        username: '',
        email: '',
        notifications: true,
    });
    const [choreographies, setChoreographies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            setSettings({
                username: parsedUser.username,
                email: parsedUser.email,
                notifications: true,
            });
            fetchChoreographies();
            fetchHistory();
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const fetchChoreographies = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }
            const response = await axios.get(`${API_URL}/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChoreographies(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching choreographies:', err);
            setError('Не удалось загрузить хореографии. Пожалуйста, попробуйте позже.');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }
            const response = await axios.get(`${API_URL}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(response.data);
        } catch (err) {
            console.error('Error fetching history:', err);
            setError('Не удалось загрузить историю. Пожалуйста, попробуйте позже.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleDeleteChoreography = async (id) => {
        try {
            await axios.delete(`${API_URL}/projects/${id}`);
            setChoreographies(choreographies.filter(choreo => choreo._id !== id));
        } catch (err) {
            console.error('Error deleting choreography:', err);
            setError('Не удалось удалить хореографию. Пожалуйста, попробуйте позже.');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const handleDeleteAccount = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/');
        } catch (err) {
            console.error('Error deleting account:', err);
            setError('Не удалось удалить аккаунт. Пожалуйста, попробуйте позже.');
        }
    };

    const handleSettingsSave = () => {
        // TODO: Implement settings save
        setOpenSettings(false);
    };

    const getActionText = (action) => {
        switch (action) {
            case 'PROJECT_CREATED':
                return 'Создан проект';
            case 'PROJECT_UPDATED':
                return 'Обновлен проект';
            case 'TEAM_MEMBER_ADDED':
                return 'Добавлен участник команды';
            case 'TEAM_MEMBER_REMOVED':
                return 'Удален участник команды';
            case 'TEAM_PROJECT_UPDATED':
                return 'Обновлен командный проект';
            default:
                return action;
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'PROJECT_CREATED':
                return 'tertiary';
            case 'PROJECT_UPDATED':
                return 'secondary';
            case 'TEAM_MEMBER_ADDED':
                return 'secondary';
            case 'TEAM_MEMBER_REMOVED':
                return 'primary';
            case 'TEAM_PROJECT_UPDATED':
                return 'secondary';
            default:
                return 'default';
        }
    };

    if (!user) {
        return null;
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: `linear-gradient(135deg, #0a0e24 0%, #111536 100%)`,
            position: 'relative',
        }}>
            {/* Декоративные элементы */}
            <DecorativeCircle top="20%" left="-5%" size={300} color={COLORS.secondary} delay={0.2} />
            <DecorativeCircle top="60%" left="95%" size={200} color={COLORS.tertiary} delay={0.4} />
            <DecorativeCircle top="90%" left="10%" size={150} color={COLORS.secondary} delay={0.6} />

            <FloatingIcon sx={{ top: '15%', right: '10%' }}>
                <TimelineIcon sx={{ fontSize: 100 }} />
            </FloatingIcon>

            <FloatingIcon sx={{ bottom: '20%', left: '8%', opacity: 0.15 }} delay={1}>
                <NotificationsIcon sx={{ fontSize: 80 }} />
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
                        Личный кабинет
                    </Typography>
                </Box>

                {error && (
                    <Alert
                        severity="error"
                        sx={{
                            mb: 4,
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

                <UserInfoCard>
                    <Avatar
                        sx={{
                            width: 100,
                            height: 100,
                            bgcolor: `${COLORS.secondary}30`,
                            color: COLORS.white,
                            fontSize: '2.5rem',
                            fontWeight: 'bold',
                            mb: 2,
                            border: `3px solid ${COLORS.secondary}`,
                        }}
                    >
                        {user.username.substring(0, 1).toUpperCase()}
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: COLORS.white }}>
                        {user.username}
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 2 }}>
                        {user.email}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<SettingsIcon />}
                            onClick={() => setOpenSettings(true)}
                            sx={{
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                color: COLORS.white,
                                borderRadius: '12px',
                                '&:hover': {
                                    borderColor: COLORS.secondaryLight,
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                }
                            }}
                        >
                            Настройки
                        </Button>
                        <StyledButton
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/constructor')}
                            sx={{ px: 3 }}
                        >
                            Создать хореографию
                        </StyledButton>
                    </Box>
                </UserInfoCard>

                <Grid container spacing={4}>
                    {/* Мои хореографии */}
                    <Grid item xs={12} md={8}>
                        <StyledPaper sx={{ minHeight: 500 }}>
                            <SectionTitle variant="h5">
                                <TimelineIcon sx={{ mr: 1, color: COLORS.tertiary }} />
                                Мои хореографии
                            </SectionTitle>

                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress sx={{ color: COLORS.tertiary }} />
                                </Box>
                            ) : (
                                choreographies.length > 0 ? (
                                    <ChoreographyList
                                        choreographies={choreographies}
                                        onDelete={handleDeleteChoreography}
                                    />
                                ) : (
                                    <Box sx={{
                                        py: 8,
                                        textAlign: 'center',
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        borderRadius: '12px',
                                        border: '1px dashed rgba(30, 144, 255, 0.3)',
                                        backgroundColor: 'rgba(30, 144, 255, 0.05)',
                                        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
                                        backgroundSize: '20px 20px',
                                    }}>
                                        <Typography variant="h6" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.8)' }}>
                                            У вас пока нет хореографий
                                        </Typography>
                                        <StyledButton
                                            startIcon={<AddIcon />}
                                            onClick={() => navigate('/constructor')}
                                        >
                                            Создать первую хореографию
                                        </StyledButton>
                                    </Box>
                                )
                            )}
                        </StyledPaper>
                    </Grid>

                    {/* История */}
                    <Grid item xs={12} md={4}>
                        <StyledPaper sx={{ minHeight: 500 }}>
                            <SectionTitle variant="h5">
                                <HistoryIcon sx={{ mr: 1, color: COLORS.tertiary }} />
                                История
                            </SectionTitle>

                            {historyLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress sx={{ color: COLORS.tertiary }} />
                                </Box>
                            ) : (
                                <List sx={{ p: 0 }}>
                                    {history.map((item) => (
                                        <StyledHistoryItem key={item._id} disableGutters sx={{ px: 2, py: 1.5 }}>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                        <StyledChip
                                                            label={getActionText(item.action)}
                                                            size="small"
                                                            color={getActionColor(item.action)}
                                                        />
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            sx={{
                                                                color: 'rgba(255, 255, 255, 0.9)',
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            {item.projectId?.title || 'Проект'}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    <Box>
                                                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                                            {item.description}
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                display: 'block',
                                                                mt: 0.5,
                                                                color: 'rgba(255, 255, 255, 0.5)',
                                                                fontStyle: 'italic'
                                                            }}
                                                        >
                                                            {format(new Date(item.timestamp), 'd MMMM yyyy, HH:mm', { locale: ru })}
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </StyledHistoryItem>
                                    ))}
                                    {history.length === 0 && (
                                        <Box sx={{
                                            py: 4,
                                            textAlign: 'center',
                                            color: 'rgba(255, 255, 255, 0.7)',
                                            borderRadius: '12px',
                                            border: '1px dashed rgba(30, 144, 255, 0.2)',
                                            backgroundColor: 'rgba(30, 144, 255, 0.03)',
                                        }}>
                                            <HistoryIcon sx={{ fontSize: 50, opacity: 0.4, mb: 2, color: COLORS.secondary }} />
                                            <Typography>История пуста</Typography>
                                        </Box>
                                    )}
                                </List>
                            )}
                        </StyledPaper>
                    </Grid>
                </Grid>
            </Container>

            {/* Settings Dialog */}
            <StyledDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <SettingsIcon sx={{ mr: 1, color: COLORS.tertiary }} />
                        Настройки профиля
                    </Box>
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(32, 38, 52, 0.95)' }}>
                    <Box sx={{ p: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                            <Avatar
                                sx={{
                                    width: 80,
                                    height: 80,
                                    bgcolor: `${COLORS.secondary}30`,
                                    color: COLORS.white,
                                    fontSize: '2rem',
                                    fontWeight: 'bold',
                                    border: `2px solid ${COLORS.secondary}`,
                                }}
                            >
                                {settings.username.substring(0, 1).toUpperCase()}
                            </Avatar>
                        </Box>

                        <StyledTextField
                            label="Имя пользователя"
                            value={settings.username}
                            onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                            fullWidth
                            margin="normal"
                        />
                        <StyledTextField
                            label="Email"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                            fullWidth
                            margin="normal"
                        />

                        <Typography variant="subtitle1" sx={{ mt: 3, mb: 2, fontWeight: 600, color: COLORS.white }}>
                            Управление аккаунтом
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Button
                                variant="outlined"
                                startIcon={<LogoutIcon />}
                                onClick={handleLogout}
                                fullWidth
                                sx={{
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                    color: COLORS.white,
                                    borderRadius: '12px',
                                    padding: '10px 0',
                                    '&:hover': {
                                        borderColor: COLORS.primaryLight,
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                    }
                                }}
                            >
                                Выйти из аккаунта
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setOpenDeleteConfirm(true)}
                                fullWidth
                                sx={{
                                    borderRadius: '12px',
                                    padding: '10px 0',
                                }}
                            >
                                Удалить аккаунт
                            </Button>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ bgcolor: COLORS.darkLight, px: 3, py: 2 }}>
                    <Button
                        onClick={() => setOpenSettings(false)}
                        sx={{
                            borderRadius: '10px',
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                            }
                        }}
                    >
                        Отмена
                    </Button>
                    <StyledButton onClick={handleSettingsSave} sx={{ px: 3 }}>
                        Сохранить
                    </StyledButton>
                </DialogActions>
            </StyledDialog>

            <StyledDialog
                open={openDeleteConfirm}
                onClose={() => setOpenDeleteConfirm(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ color: '#f44336' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <DeleteIcon sx={{ mr: 1 }} />
                        Удалить аккаунт?
                    </Box>
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(32, 38, 52, 0.95)' }}>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        Вы уверены, что хотите удалить свой аккаунт? Это действие нельзя отменить. Все ваши проекты и данные будут удалены.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ bgcolor: 'rgba(32, 38, 52, 0.95)', px: 3, py: 2 }}>
                    <Button
                        onClick={() => setOpenDeleteConfirm(false)}
                        sx={{
                            borderRadius: '10px',
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                            }
                        }}
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={handleDeleteAccount}
                        variant="contained"
                        color="error"
                        sx={{
                            borderRadius: '10px',
                            fontWeight: 600,
                        }}
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </StyledDialog>
        </Box>
    );
}

export default Dashboard; 