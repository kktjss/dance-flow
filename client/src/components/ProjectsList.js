import React, { useState, useEffect } from 'react';
import './ProjectsList.css';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, IconButton, Snackbar, Alert } from '@mui/material';
import { Delete } from '@mui/icons-material';
import { projectService } from '../services/api';

const ProjectsList = ({ onSelectProject, setShowProjects }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

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

    // Function to close notification
    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    return (
        <div className="projects-list-container">
            <div className="projects-list-header">
                <h2>Мои проекты</h2>
                <button className="close-button" onClick={() => setShowProjects(false)}>×</button>
            </div>

            {loading ? (
                <div className="loading">Загрузка проектов...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : projects.length === 0 ? (
                <div className="no-projects">Нет доступных проектов</div>
            ) : (
                <div className="projects-grid">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            className="project-card"
                            onClick={() => handleProjectSelect(project.id)}
                        >
                            <div className="project-title">{project.name || 'Без названия'}</div>
                            <div className="project-info">
                                {project.elements ? `${project.elements.length} элементов` : 'Элементы не загружены'}
                            </div>
                            <div className="project-date">
                                {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
                            </div>
                            <IconButton
                                className="delete-button"
                                onClick={(e) => openDeleteConfirm(e, project)}
                                size="small"
                                sx={{
                                    position: 'absolute',
                                    top: 5,
                                    right: 5,
                                    opacity: 0.7,
                                    '&:hover': { opacity: 1 }
                                }}
                            >
                                <Delete />
                            </IconButton>
                        </div>
                    ))}
                </div>
            )}

            <Dialog
                open={deleteConfirmOpen}
                onClose={closeDeleteConfirm}
            >
                <DialogTitle>Подтверждение удаления</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Вы уверены, что хотите удалить проект "{projectToDelete?.name}"? Это действие нельзя отменить.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteConfirm}>Отмена</Button>
                    <Button onClick={handleDeleteProject} color="error" autoFocus>
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleCloseNotification}
                    severity={notification.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default ProjectsList; 