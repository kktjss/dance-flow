import React, { useState, useEffect } from 'react';
import './ProjectsList.css';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, IconButton, Snackbar, Alert, TextField, Typography, Box, Tooltip, Chip, CircularProgress } from '@mui/material';
import { Delete, Edit, AccessTime, FolderOpen, Description, ErrorOutline, ArrowBack } from '@mui/icons-material';
import { projectService } from '../services/api';

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
        onSelectProject(projectId);
        setShowProjects(false);
    };

    // Function to open delete confirmation dialog
    const openDeleteConfirm = (e, project) => {
        e.stopPropagation(); // Prevent card click event
        setProjectToDelete(project);
        setDeleteConfirmOpen(true);
    };

    // Function to close delete confirmation dialog
    const closeDeleteConfirm = () => {
        setDeleteConfirmOpen(false);
        setProjectToDelete(null);
    };

    // Function to delete a project
    const handleDeleteProject = async () => {
        if (!projectToDelete) return;

        try {
            await projectService.deleteProject(projectToDelete.id);

            // Update projects list
            setProjects(projects.filter(p => p.id !== projectToDelete.id));

            // Show success notification
            setNotification({
                open: true,
                message: `Проект "${projectToDelete.name}" успешно удален`,
                severity: 'success'
            });

            closeDeleteConfirm();
        } catch (err) {
            console.error('Error deleting project:', err);

            // Show error notification
            setNotification({
                open: true,
                message: `Ошибка при удалении проекта: ${err.message}`,
                severity: 'error'
            });

            closeDeleteConfirm();
        }
    };

    // Function to open edit dialog
    const openEditDialog = (e, project) => {
        e.stopPropagation(); // Prevent card click event
        setProjectToEdit(project);
        setEditFormData({
            name: project.name || '',
            description: project.description || ''
        });
        setEditDialogOpen(true);
    };

    // Function to close edit dialog
    const closeEditDialog = () => {
        setEditDialogOpen(false);
        setProjectToEdit(null);
    };

    // Handle form input changes
    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData({
            ...editFormData,
            [name]: value
        });
    };

    // Function to save project changes
    const handleSaveProject = async () => {
        if (!projectToEdit) return;

        try {
            await projectService.updateProject(projectToEdit.id, editFormData);

            // Update projects list with edited project
            setProjects(projects.map(p =>
                p.id === projectToEdit.id
                    ? { ...p, name: editFormData.name, description: editFormData.description }
                    : p
            ));

            // Show success notification
            setNotification({
                open: true,
                message: `Проект "${editFormData.name}" успешно обновлен`,
                severity: 'success'
            });

            closeEditDialog();
        } catch (err) {
            console.error('Error updating project:', err);

            // Show error notification
            setNotification({
                open: true,
                message: `Ошибка при обновлении проекта: ${err.message}`,
                severity: 'error'
            });
        }
    };

    // Function to close notification
    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    // Function to format date in a readable way
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    };

    return (
        <div className={`projects-list-container ${isDialog ? 'in-dialog' : ''}`}>
            <div className="projects-list-header">
                {isDialog && (
                    <IconButton
                        onClick={() => setShowProjects(false)}
                        edge="start"
                        sx={{ mr: 1 }}
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
                    <button className="close-button" onClick={() => setShowProjects(false)}>×</button>
                )}
            </div>

            {loading ? (
                <div className="loading">
                    <CircularProgress size={40} color="primary" sx={{ mb: 2 }} />
                    <Typography>Загрузка проектов...</Typography>
                </div>
            ) : error ? (
                <div className="error">
                    <ErrorOutline sx={{ fontSize: 40, mb: 2, color: 'error.main' }} />
                    <Typography color="error">{error}</Typography>
                </div>
            ) : projects.length === 0 ? (
                <div className="no-projects">
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <FolderOpen sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <Typography variant="h6">Нет доступных проектов</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Создайте новый проект или импортируйте существующий
                        </Typography>
                    </Box>
                </div>
            ) : (
                <div className="projects-grid">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            className="project-card"
                            onClick={() => handleProjectSelect(project.id)}
                        >
                            <div className="project-title">{project.name || 'Без названия'}</div>
                            {project.description && (
                                <div className="project-description">
                                    <Description sx={{ fontSize: 14, mr: 0.5, opacity: 0.7, verticalAlign: 'middle' }} />
                                    {project.description}
                                </div>
                            )}
                            <div className="project-info">
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
                            </div>
                            <div className="project-date">
                                <AccessTime sx={{ fontSize: 14, mr: 0.5, opacity: 0.7 }} />
                                {formatDate(project.updatedAt || project.createdAt)}
                            </div>
                            <div className="project-actions">
                                <Tooltip title="Редактировать">
                                    <IconButton
                                        className="edit-button"
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
                                        className="delete-button"
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
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirmation dialog */}
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

            {/* Edit project dialog */}
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

            {/* Notification snackbar */}
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
        </div>
    );
};

export default ProjectsList; 