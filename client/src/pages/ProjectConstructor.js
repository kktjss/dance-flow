import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Container, Typography, Paper, CircularProgress, Alert, Button,
    TextField, IconButton, Snackbar, alpha
} from '@mui/material';
import { Edit, Save, Cancel } from '@mui/icons-material';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { API_BASE_URL } from '../constants';
import { styled, keyframes } from '@mui/material/styles';
import { COLORS } from '../constants/colors';

// Animations
const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

// Decorative elements
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

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    borderRadius: '20px',
    backgroundColor: 'rgba(17, 21, 54, 0.9)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
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
    borderRadius: '12px',
    fontWeight: 600,
    textTransform: 'none',
    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
    color: '#FFFFFF',
    transition: 'all 0.3s ease',
    boxShadow: `0 4px 15px rgba(138, 43, 226, 0.3)`,
    '&:hover': {
        boxShadow: `0 8px 20px rgba(138, 43, 226, 0.5)`,
        transform: 'translateY(-2px)'
    }
}));

const StyledOutlinedButton = styled(Button)(({ theme }) => ({
    borderRadius: '12px',
    fontWeight: 600,
    textTransform: 'none',
    borderColor: alpha(COLORS.primary, 0.3),
    color: theme.palette.mode === 'dark' ? '#FFFFFF' : COLORS.primary,
    '&:hover': {
        borderColor: COLORS.primary,
        backgroundColor: alpha(COLORS.primary, 0.08),
        transform: 'translateY(-2px)',
    }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        color: 'rgba(255, 255, 255, 0.9)',
        '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        '&:hover fieldset': {
            borderColor: COLORS.primaryLight,
        },
        '&.Mui-focused fieldset': {
            borderColor: COLORS.primary,
        },
    },
    '& .MuiInputLabel-root': {
        color: 'rgba(255, 255, 255, 0.7)',
    }
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontWeight: 700,
    marginBottom: theme.spacing(2),
    position: 'relative',
    display: 'inline-block',
    color: '#FFFFFF',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: -4,
        left: 0,
        width: 40,
        height: 3,
        background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.tertiary})`,
        borderRadius: 1.5
    }
}));

const ProjectConstructor = () => {
    const { teamId, projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '' });
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('Требуется авторизация');
                    setLoading(false);
                    return;
                }

                console.log('Fetching project data...', { teamId, projectId });

                // Непосредственно загружаем проект по ID, минуя проверку команды
                try {
                    console.log(`Requesting project with ID: ${projectId}`);
                    const response = await axios.get(
                        `${API_BASE_URL}/api/projects/${projectId}`,
                        {
                            headers: { Authorization: `Bearer ${token}` }
                        }
                    );

                    console.log('Project data response:', response.data);

                    // Проверим и исправим формат ID проекта
                    const projectData = { ...response.data };
                    if (!projectData._id && projectData.id) {
                        console.log('Fixing project data: copying id to _id');
                        projectData._id = projectData.id;
                    }

                    // Базовая проверка данных проекта
                    if (!projectData.name) {
                        console.warn('Project has no name:', projectData);
                        projectData.name = `Проект ${projectData._id || projectData.id || 'без имени'}`;
                    }

                    console.log('Processed project data:', projectData);
                    setProject(projectData);
                    setEditData({
                        name: projectData.name || '',
                        description: projectData.description || ''
                    });
                    setError(null);
                } catch (projectError) {
                    console.error('Error fetching project data:', projectError);
                    console.error('Project error response:', projectError.response?.data);

                    // Информативная обработка различных ошибок проекта
                    if (projectError.response?.status === 404) {
                        throw new Error('Проект не найден');
                    } else if (projectError.response?.status === 403) {
                        throw new Error('У вас нет доступа к этому проекту');
                    } else {
                        throw new Error(projectError.response?.data?.message ||
                            projectError.response?.data?.error ||
                            projectError.message ||
                            'Произошла ошибка при загрузке проекта');
                    }
                }
            } catch (err) {
                console.error('Error in project loading flow:', err);
                console.error('Error details:', {
                    message: err.message,
                    responseStatus: err.response?.status,
                    responseData: err.response?.data
                });

                let errorMessage = 'Не удалось загрузить проект. Пожалуйста, попробуйте позже.';

                if (err.response) {
                    console.error('Server response:', err.response.data);
                    errorMessage = err.response.data?.message || err.response.data?.error || err.message || errorMessage;
                } else if (err.request) {
                    console.error('No response received:', err.request);
                    errorMessage = 'Сервер не отвечает. Пожалуйста, проверьте подключение к интернету.';
                } else if (err.message) {
                    errorMessage = err.message;
                }

                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [teamId, projectId]);

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData({
            ...editData,
            [name]: value
        });
    };

    const startEditing = () => {
        setEditData({
            name: project.name || '',
            description: project.description || ''
        });
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
    };

    const saveProjectDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Требуется авторизация');
                return;
            }

            const projectID = project._id || project.id;
            const response = await axios.put(
                `${API_BASE_URL}/api/projects/${projectID}`,
                {
                    name: editData.name,
                    description: editData.description
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            // Update local project data
            setProject({
                ...project,
                name: editData.name,
                description: editData.description
            });

            setIsEditing(false);
            setNotification({
                open: true,
                message: 'Данные проекта успешно обновлены',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error updating project:', err);
            setNotification({
                open: true,
                message: `Ошибка при обновлении проекта: ${err.response?.data?.error || err.message}`,
                severity: 'error'
            });
        }
    };

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', bgcolor: '#121620' }}>
            {/* Decorative elements */}
            <DecorativeCircle size={300} top="10%" left="-100px" color={COLORS.primary} delay={0.2} />
            <DecorativeCircle size={200} top="60%" left="80%" color={COLORS.tertiary} delay={0.4} />

            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    {error && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                            {error}
                        </Alert>
                    )}

                    <StyledPaper sx={{ p: 4 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress sx={{ color: COLORS.primary }} />
                            </Box>
                        ) : project ? (
                            <Box sx={{ animation: `${fadeIn} 0.5s ease-out forwards` }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                                    {isEditing ? (
                                        <StyledTextField
                                            name="name"
                                            label="Название проекта"
                                            value={editData.name}
                                            onChange={handleEditChange}
                                            fullWidth
                                            variant="outlined"
                                            sx={{ mr: 2 }}
                                        />
                                    ) : (
                                        <SectionTitle variant="h4" component="h1">
                                            {project.name}
                                        </SectionTitle>
                                    )}

                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        {isEditing ? (
                                            <>
                                                <IconButton color="primary" onClick={saveProjectDetails}>
                                                    <Save />
                                                </IconButton>
                                                <IconButton color="default" onClick={cancelEditing}>
                                                    <Cancel />
                                                </IconButton>
                                            </>
                                        ) : (
                                            <>
                                                <IconButton color="primary" onClick={startEditing}>
                                                    <Edit />
                                                </IconButton>
                                                <StyledOutlinedButton
                                                    variant="outlined"
                                                    onClick={() => {
                                                        const projectID = project._id || project.id;
                                                        console.log(`Navigating to view project: ${projectID}`);
                                                        navigate(`/teams/${teamId}/projects/${projectID}/viewer`);
                                                    }}
                                                >
                                                    Посмотреть
                                                </StyledOutlinedButton>
                                                <StyledButton
                                                    variant="contained"
                                                    onClick={() => {
                                                        const projectID = project._id || project.id;
                                                        console.log(`Navigating to main constructor for project: ${projectID}`);
                                                        navigate(`/constructor/${projectID}`);
                                                    }}
                                                >
                                                    Редактировать
                                                </StyledButton>
                                            </>
                                        )}
                                    </Box>
                                </Box>

                                {isEditing ? (
                                    <StyledTextField
                                        name="description"
                                        label="Описание проекта"
                                        value={editData.description}
                                        onChange={handleEditChange}
                                        fullWidth
                                        multiline
                                        rows={4}
                                        variant="outlined"
                                        sx={{ mb: 3 }}
                                    />
                                ) : (
                                    <Typography variant="body1" color="text.secondary" paragraph
                                        sx={{
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            borderLeft: `4px solid ${alpha(COLORS.tertiary, 0.5)}`,
                                            pl: 2,
                                            py: 1
                                        }}
                                    >
                                        {project.description || 'Нет описания'}
                                    </Typography>
                                )}

                                <Box sx={{ mt: 4, p: 3, bgcolor: alpha(COLORS.primary, 0.1), borderRadius: '12px' }}>
                                    <SectionTitle variant="h6" gutterBottom>
                                        Информация о проекте
                                    </SectionTitle>
                                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 1 }}>
                                        Создан: {new Date(project.createdAt).toLocaleDateString()}
                                    </Typography>
                                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                        Последнее обновление: {new Date(project.updatedAt).toLocaleDateString()}
                                    </Typography>
                                </Box>
                            </Box>
                        ) : (
                            <Typography color="error">
                                Проект не найден
                            </Typography>
                        )}
                    </StyledPaper>
                </Container>
            </Box>

            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleCloseNotification}
                    severity={notification.severity}
                    sx={{ width: '100%', borderRadius: '10px' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ProjectConstructor; 