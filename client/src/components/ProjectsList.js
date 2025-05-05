import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProjectsList.css';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, IconButton, Snackbar, Alert } from '@mui/material';
import { Delete } from '@mui/icons-material';

const ProjectsList = ({ onSelectProject, setShowProjects }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

    const API_URL = 'http://localhost:5000/api';

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/projects`);
            setProjects(response.data);
        } catch (err) {
            console.error('Error fetching projects:', err);
            setError('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [API_URL]);

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
            await axios.delete(`${API_URL}/projects/${projectToDelete._id}`);

            // Update projects list
            setProjects(projects.filter(p => p._id !== projectToDelete._id));

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
                            key={project._id}
                            className="project-card"
                            onClick={() => handleProjectSelect(project._id)}
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
                                size="small"
                                color="error"
                                onClick={(e) => openDeleteConfirm(e, project)}
                                sx={{
                                    position: 'absolute',
                                    top: '5px',
                                    right: '5px',
                                    backgroundColor: 'rgba(255,255,255,0.7)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                    }
                                }}
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={closeDeleteConfirm}
            >
                <DialogTitle>Удаление проекта</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Вы уверены, что хотите удалить проект "{projectToDelete?.name}"? Это действие невозможно отменить.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteConfirm}>Отмена</Button>
                    <Button onClick={handleDeleteProject} color="error" variant="contained">
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Notification */}
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