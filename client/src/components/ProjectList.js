import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Paper,
    Divider,
    CircularProgress,
    FormControlLabel,
    Switch
} from '@mui/material';
import { Delete, Edit, Add, Lock, Public } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

const ProjectList = ({ onSelectProject, onCreateNewProject }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(true);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const navigate = useNavigate();

    // Fetch projects on component mount
    useEffect(() => {
        loadProjects();
    }, []);

    // Load projects from the server
    const loadProjects = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            if (!token) {
                console.error('No authentication token found');
                setError('Authentication required. Please log in.');
                return;
            }

            console.log('Loading projects with token:', token.substring(0, 10) + '...');

            // Log the full request details
            console.log('Making request to:', `${API_URL}/projects`);
            console.log('With headers:', {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await axios.get(`${API_URL}/projects`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Projects loaded:', response.data);
            console.log('Number of projects:', response.data.length);
            console.log('Project details:', response.data.map(p => ({
                id: p._id,
                name: p.name,
                owner: p.owner,
                isPrivate: p.isPrivate
            })));

            setProjects(response.data);
            setError(null);
        } catch (err) {
            console.error('Error loading projects:', err);
            console.error('Error details:', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status
            });
            setError('Failed to load projects. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Create a new project
    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        try {
            const token = localStorage.getItem('token');

            if (!token) {
                console.error('No authentication token found');
                setError('Authentication required. Please log in.');
                return;
            }

            console.log('Creating project with token:', token.substring(0, 10) + '...');

            const newProject = {
                name: newProjectName.trim(),
                description: newProjectDescription.trim() || '',
                duration: 60,
                elements: [],
                isPrivate
            };

            console.log('Sending project creation request:', {
                url: `${API_URL}/projects`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                data: newProject
            });

            const response = await axios.post(`${API_URL}/projects`, newProject, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Project created successfully:', response.data);

            setProjects([...projects, response.data]);
            setNewProjectDialogOpen(false);
            setNewProjectName('');
            setNewProjectDescription('');
            setIsPrivate(true);

            // Select the newly created project
            onSelectProject(response.data);
        } catch (err) {
            console.error('Error creating project:', err);
            console.error('Error details:', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
                headers: err.config?.headers
            });
            setError('Failed to create project. Please try again.');
        }
    };

    // Delete a project
    const handleDeleteProject = async (projectId) => {
        if (!window.confirm('Вы уверены, что хотите удалить этот проект?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(projects.filter(project => project._id !== projectId));
            setDeleteConfirmOpen(false);
            setProjectToDelete(null);
        } catch (err) {
            console.error('Error deleting project:', err);
            setError('Failed to delete project. Please try again.');
        }
    };

    // Select a project
    const handleSelectProject = async (project) => {
        try {
            setLoading(true);

            // Получаем полные данные проекта с сервера
            const response = await axios.get(`${API_URL}/projects/${project._id}`);
            console.log(`Loaded project "${response.data.name}" with ${response.data.elements?.length || 0} elements`);

            // Передаем напрямую, без модификаций
            onSelectProject(response.data);

            setError(null);
        } catch (err) {
            console.error('Error loading project details:', err);
            setError('Failed to load project details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Create new blank project
    const handleNewBlankProject = () => {
        setNewProjectDialogOpen(true);
    };

    const confirmDelete = (project) => {
        setProjectToDelete(project);
        setDeleteConfirmOpen(true);
    };

    return (
        <Paper sx={{ width: '100%', p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Проекты
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={handleNewBlankProject}
                >
                    Новый проект
                </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>
                    {error}
                </Typography>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                    {projects.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                            У вас пока нет проектов. Создайте новый!
                        </Typography>
                    ) : (
                        <List>
                            {projects.map((project) => (
                                <ListItem
                                    key={project._id}
                                    button
                                    onClick={() => handleSelectProject(project)}
                                    sx={{
                                        borderBottom: '1px solid #f0f0f0',
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                        }
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {project.name}
                                                {project.isPrivate ? (
                                                    <Lock fontSize="small" color="action" />
                                                ) : (
                                                    <Public fontSize="small" color="action" />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <React.Fragment>
                                                <Typography variant="body2" component="span" color="text.secondary">
                                                    {project.description || 'Нет описания'}
                                                </Typography>
                                                <br />
                                                <Typography variant="caption" color="text.secondary">
                                                    Создан: {new Date(project.createdAt).toLocaleString()}
                                                </Typography>
                                            </React.Fragment>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                confirmDelete(project);
                                            }}
                                            title="Удалить проект"
                                        >
                                            <Delete />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            )}

            {/* New Project Dialog */}
            <Dialog open={newProjectDialogOpen} onClose={() => setNewProjectDialogOpen(false)}>
                <DialogTitle>Создать новый проект</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Название проекта"
                        type="text"
                        fullWidth
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Описание (необязательно)"
                        type="text"
                        fullWidth
                        multiline
                        rows={2}
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={isPrivate}
                                onChange={(e) => setIsPrivate(e.target.checked)}
                            />
                        }
                        label="Приватный проект"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewProjectDialogOpen(false)}>Отмена</Button>
                    <Button
                        onClick={handleCreateProject}
                        color="primary"
                        disabled={!newProjectName.trim()}
                    >
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
            >
                <DialogTitle>Подтвердите удаление</DialogTitle>
                <DialogContent>
                    <Typography>
                        Вы уверены, что хотите удалить проект "{projectToDelete?.name}"?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Отмена</Button>
                    <Button
                        onClick={() => handleDeleteProject(projectToDelete._id)}
                        color="error"
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default ProjectList; 