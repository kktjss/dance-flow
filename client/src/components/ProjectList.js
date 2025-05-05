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
    CircularProgress
} from '@mui/material';
import { Delete, Edit, Add } from '@mui/icons-material';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const ProjectList = ({ onSelectProject, onCreateNewProject }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');

    // Fetch projects on component mount
    useEffect(() => {
        loadProjects();
    }, []);

    // Load projects from the server
    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/projects`);
            setProjects(response.data);
            setError(null);
        } catch (err) {
            console.error('Error loading projects:', err);
            setError('Failed to load projects. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Create a new project
    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        try {
            const newProject = {
                name: newProjectName.trim(),
                description: newProjectDescription.trim() || '',
                duration: 60,
                elements: []
            };

            const response = await axios.post(`${API_URL}/projects`, newProject);
            setProjects([...projects, response.data]);
            setNewProjectDialogOpen(false);
            setNewProjectName('');
            setNewProjectDescription('');

            // Select the newly created project
            onSelectProject(response.data);
        } catch (err) {
            console.error('Error creating project:', err);
            setError('Failed to create project. Please try again.');
        }
    };

    // Delete a project
    const handleDeleteProject = async (projectId, event) => {
        event.stopPropagation();

        if (!window.confirm('Вы уверены, что хотите удалить этот проект?')) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/projects/${projectId}`);
            setProjects(projects.filter(project => project._id !== projectId));
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
                                        primary={project.name}
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
                                            onClick={(e) => handleDeleteProject(project._id, e)}
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
        </Paper>
    );
};

export default ProjectList; 