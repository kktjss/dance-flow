import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, IconButton, Snackbar, Alert, TextField, Typography, Box, Tooltip, Chip, CircularProgress, Paper } from '@mui/material';
import { Delete, Edit, AccessTime, FolderOpen, Description, ErrorOutline, ArrowBack } from '@mui/icons-material';
import { projectService } from '../services/api';

// Стили компонента
const styles = {
    container: {
        backgroundColor: 'rgba(32, 38, 52, 0.95)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        width: '80%',
        maxWidth: '1200px',
        maxHeight: '80vh',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1000,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
    },
    closeButton: {
        background: 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '24px',
        cursor: 'pointer',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        transition: 'all 0.2s',
        '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white'
        }
    },
    projectsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px',
        padding: '24px',
        overflowY: 'auto',
        maxHeight: 'calc(80vh - 70px)'
    },
    projectCard: {
        backgroundColor: 'rgba(43, 51, 70, 0.7)',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
            backgroundColor: 'rgba(51, 59, 81, 0.9)',
            transform: 'translateY(-3px)',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)'
        }
    },
    projectTitle: {
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '8px',
        color: 'white',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    projectDescription: {
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: '12px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        position: 'relative'
    },
    projectInfo: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '12px'
    },
    projectDate: {
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.5)',
        display: 'flex',
        alignItems: 'center'
    },
    projectActions: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        display: 'flex',
        gap: '4px',
        opacity: 0,
        transition: 'opacity 0.2s',
        '$projectCard:hover &': {
            opacity: 1
        }
    },
    statusContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: 'rgba(255, 255, 255, 0.7)'
    },
    // Особая обработка для hover-эффекта действий проекта
    projectCardWithActions: {
        '& .project-actions': {
            opacity: 0,
            transition: 'opacity 0.2s'
        },
        '&:hover .project-actions': {
            opacity: 1
        }
    },
    backButton: {
        color: 'rgba(255, 255, 255, 0.7)',
        '&:hover': {
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)'
        }
    }
};

const ProjectsList = ({ onSelectProject, setShowProjects, isDialog = false }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState(null);
    const [editFormData, setEditFormData] = useState({ name: '', description: '' });

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const data = await projectService.getProjects();
            setProjects(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching projects:', err);
            setError('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleProjectSelect = (projectId) => {
        console.log('Selected project ID:', projectId);
        // Проверяем, является ли projectId объектом, и если да, извлекаем ID
        if (typeof projectId === 'object' && projectId !== null) {
            const id = projectId._id || projectId.id;
            if (id) {
                console.log('Extracted ID from project object:', id);
                onSelectProject(id);
            } else {
                console.error('Could not extract ID from project object:', projectId);
            }
        } else {
            onSelectProject(projectId);
        }
        setShowProjects(false);
    };

    // Функция для открытия диалога подтверждения удаления
    const openDeleteConfirm = (e, project) => {
        e.stopPropagation(); // Предотвращаем событие клика по карточке
        setProjectToDelete(project);
        setDeleteConfirmOpen(true);
    };

    // Функция для закрытия диалога подтверждения удаления
    const closeDeleteConfirm = () => {
        setDeleteConfirmOpen(false);
        setProjectToDelete(null);
    };

    // Функция для удаления проекта
    const handleDeleteProject = async () => {
        if (!projectToDelete) return;

        try {
            await projectService.deleteProject(projectToDelete.id);

            // Обновляем список проектов
            setProjects(projects.filter(p => p.id !== projectToDelete.id));

            // Показываем уведомление об успехе
            setNotification({
                open: true,
                message: `Проект "${projectToDelete.name}" успешно удален`,
                severity: 'success'
            });

            closeDeleteConfirm();
        } catch (err) {
            console.error('Error deleting project:', err);

            // Показываем уведомление об ошибке
            setNotification({
                open: true,
                message: `Ошибка при удалении проекта: ${err.message}`,
                severity: 'error'
            });

            closeDeleteConfirm();
        }
    };

    // Функция для открытия диалога редактирования
    const openEditDialog = (e, project) => {
        e.stopPropagation(); // Предотвращаем событие клика по карточке
        setProjectToEdit(project);
        setEditFormData({
            name: project.name || '',
            description: project.description || ''
        });
        setEditDialogOpen(true);
    };

    // Функция для закрытия диалога редактирования
    const closeEditDialog = () => {
        setEditDialogOpen(false);
        setProjectToEdit(null);
    };

    // Обработка изменений в полях формы
    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData({
            ...editFormData,
            [name]: value
        });
    };

    // Функция для сохранения изменений проекта
    const handleSaveProject = async () => {
        if (!projectToEdit) return;

        try {
            await projectService.updateProject(projectToEdit.id, editFormData);

            // Обновляем список проектов с отредактированным проектом
            setProjects(projects.map(p =>
                p.id === projectToEdit.id
                    ? { ...p, name: editFormData.name, description: editFormData.description }
                    : p
            ));

            // Показываем уведомление об успехе
            setNotification({
                open: true,
                message: `Проект "${editFormData.name}" успешно обновлен`,
                severity: 'success'
            });

            closeEditDialog();
        } catch (err) {
            console.error('Error updating project:', err);

            // Показываем уведомление об ошибке
            setNotification({
                open: true,
                message: `Ошибка при обновлении проекта: ${err.message}`,
                severity: 'error'
            });
        }
    };

    // Функция для закрытия уведомления
    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    // Функция для форматирования даты в читаемом виде
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    };

    return (
        <Paper
            sx={{
                ...styles.container,
                ...(isDialog ? {
                    position: 'relative',
                    top: 'auto',
                    left: 'auto',
                    transform: 'none',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                    backdropFilter: 'none'
                } : {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backdropFilter: 'none'
                }),
                '@media (max-width: 600px)': {
                    width: '95%',
                    maxHeight: '90vh'
                }
            }}
            elevation={0}
        >
            <Box sx={styles.header}>
                {isDialog && (
                    <IconButton
                        onClick={() => setShowProjects(false)}
                        edge="start"
                        sx={{ ...styles.backButton, mr: 1 }}
                        aria-label="back"
                    >
                        <ArrowBack />
                    </IconButton>
                )}
                <Typography variant="h5" component="h2">
                    <FolderOpen sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Мои проекты
                </Typography>

                {!isDialog && (
                    <IconButton
                        onClick={() => setShowProjects(false)}
                        edge="end"
                        sx={styles.closeButton}
                        aria-label="close"
                    >
                        ×
                    </IconButton>
                )}
            </Box>

            {loading ? (
                <Box sx={styles.statusContainer}>
                    <CircularProgress size={40} color="primary" sx={{ mb: 2 }} />
                    <Typography>Загрузка проектов...</Typography>
                </Box>
            ) : error ? (
                <Box sx={styles.statusContainer}>
                    <ErrorOutline sx={{ fontSize: 40, mb: 2, color: 'error.main' }} />
                    <Typography color="error">{error}</Typography>
                </Box>
            ) : projects.length === 0 ? (
                <Box sx={styles.statusContainer}>
                    <FolderOpen sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6">Нет доступных проектов</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Создайте новый проект или импортируйте существующий
                    </Typography>
                </Box>
            ) : (
                <Box sx={styles.projectsGrid}>
                    {projects.map(project => (
                        <Box
                            key={project.id}
                            sx={{
                                ...styles.projectCard,
                                ...styles.projectCardWithActions
                            }}
                            onClick={() => handleProjectSelect(project.id)}
                        >
                            <Typography sx={styles.projectTitle}>
                                {project.name || 'Без названия'}
                            </Typography>
                            {project.description && (
                                <Box sx={styles.projectDescription}>
                                    <Description sx={{ fontSize: 14, mr: 0.5, opacity: 0.7, verticalAlign: 'middle' }} />
                                    {project.description}
                                </Box>
                            )}
                            <Box sx={styles.projectInfo}>
                                <Chip
                                    size="small"
                                    label={project.elements ? `${project.elements.length} элементов` : '0 элементов'}
                                    color="primary"
                                    variant="outlined"
                                    sx={{ mr: 1, fontSize: '0.75rem' }}
                                />
                                {project.videoUrl && (
                                    <Chip
                                        size="small"
                                        label="Видео"
                                        color="secondary"
                                        variant="outlined"
                                        sx={{ fontSize: '0.75rem' }}
                                    />
                                )}
                            </Box>
                            <Box sx={styles.projectDate}>
                                <AccessTime sx={{ fontSize: 14, mr: 0.5, opacity: 0.7 }} />
                                {formatDate(project.updatedAt || project.createdAt)}
                            </Box>
                            <Box className="project-actions" sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '4px' }}>
                                <Tooltip title="Редактировать">
                                    <IconButton
                                        onClick={(e) => openEditDialog(e, project)}
                                        size="small"
                                        color="primary"
                                        sx={{
                                            opacity: 0.7,
                                            '&:hover': { opacity: 1 }
                                        }}
                                    >
                                        <Edit fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Удалить">
                                    <IconButton
                                        onClick={(e) => openDeleteConfirm(e, project)}
                                        size="small"
                                        color="error"
                                        sx={{
                                            opacity: 0.7,
                                            '&:hover': { opacity: 1 }
                                        }}
                                    >
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Диалог подтверждения удаления */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={closeDeleteConfirm}
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-description"
            >
                <DialogTitle id="delete-dialog-title">Удаление проекта</DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-dialog-description">
                        Вы уверены, что хотите удалить проект{' '}
                        <strong>{projectToDelete?.name || 'Без названия'}</strong>?
                        Это действие невозможно отменить.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteConfirm} color="primary">
                        Отмена
                    </Button>
                    <Button onClick={handleDeleteProject} color="error" variant="contained">
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог редактирования проекта */}
            <Dialog
                open={editDialogOpen}
                onClose={closeEditDialog}
                aria-labelledby="edit-dialog-title"
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle id="edit-dialog-title">Редактирование проекта</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        name="name"
                        label="Название проекта"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={editFormData.name}
                        onChange={handleEditInputChange}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        id="description"
                        name="description"
                        label="Описание"
                        type="text"
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={editFormData.description}
                        onChange={handleEditInputChange}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeEditDialog} color="primary">
                        Отмена
                    </Button>
                    <Button onClick={handleSaveProject} color="primary" variant="contained">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Снэкбар уведомлений */}
            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert
                    onClose={handleCloseNotification}
                    severity={notification.severity}
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Paper>
    );
};

export default ProjectsList; 