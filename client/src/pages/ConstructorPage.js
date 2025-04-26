import React, { useState, useEffect } from 'react';
import { Box, Button, Container, Grid, Paper, Tab, Tabs, Typography, IconButton } from '@mui/material';
import { Save, FolderOpen, Upload as UploadIcon } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Import components
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import ToolPanel from '../components/ToolPanel';
import PropertyPanel from '../components/PropertyPanel';
import ProjectList from '../components/ProjectList';

const API_URL = 'http://localhost:5000/api';

const ConstructorPage = () => {
    // State for project data
    const [project, setProject] = useState({
        _id: null,
        name: 'Новый проект',
        description: '',
        duration: 60,
        audioUrl: null,
        elements: []
    });

    // State for UI
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedElement, setSelectedElement] = useState(null);
    const [tabIndex, setTabIndex] = useState(0);
    const [showProjects, setShowProjects] = useState(false);
    const [error, setError] = useState(null);

    // Handle time update from player
    const handleTimeUpdate = (time) => {
        setCurrentTime(time);
    };

    // Handle play/pause
    const handlePlayPause = (playing) => {
        setIsPlaying(playing);
    };

    // Handle element selection
    const handleElementSelect = (element) => {
        setSelectedElement(element);
    };

    // Handle adding a new element to the canvas
    const handleAddElement = (element) => {
        setProject(prev => ({
            ...prev,
            elements: [...prev.elements, element]
        }));
    };

    // Handle drag and drop from tool panel
    const handleDrop = (e) => {
        e.preventDefault();
        try {
            const elementData = JSON.parse(e.dataTransfer.getData('application/json'));
            if (elementData) {
                // Adjust position based on drop location
                const canvasBounds = e.currentTarget.getBoundingClientRect();
                elementData.position = {
                    x: e.clientX - canvasBounds.left,
                    y: e.clientY - canvasBounds.top
                };

                // Add to project
                handleAddElement(elementData);
            }
        } catch (err) {
            console.error('Error handling drop:', err);
        }
    };

    // Handle element property updates
    const handleElementUpdate = (updatedElement) => {
        setProject(prev => {
            const updatedElements = prev.elements.map(element =>
                element.id === updatedElement.id ? updatedElement : element
            );

            return { ...prev, elements: updatedElements };
        });
    };

    // Handle bulk update to all elements
    const handleElementsUpdate = (updatedElements) => {
        setProject(prev => ({ ...prev, elements: updatedElements }));
    };

    // Handle saving the project
    const handleSaveProject = async () => {
        try {
            if (project._id) {
                // Update existing project
                const response = await axios.put(`${API_URL}/projects/${project._id}`, project);
                setProject(response.data);
                alert('Проект успешно сохранен');
            } else {
                // Create new project
                const response = await axios.post(`${API_URL}/projects`, project);
                setProject(response.data);
                alert('Новый проект создан');
            }

            setError(null);
        } catch (err) {
            console.error('Error saving project:', err);
            setError('Failed to save project. Please try again.');
        }
    };

    // Handle uploading audio
    const handleAudioUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // For now, we'll use a local URL
        // In a real app, you'd upload to a server and get a URL
        const audioUrl = URL.createObjectURL(file);
        setProject(prev => ({ ...prev, audioUrl }));
    };

    // Handle project selection
    const handleSelectProject = (selectedProject) => {
        setProject(selectedProject);
        setShowProjects(false);
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
            {error && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
                    <Typography color="error">{error}</Typography>
                </Paper>
            )}

            {/* Project management buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" component="h1">
                    {project.name} {project._id && <Typography component="span" variant="body2" color="text.secondary">({project._id})</Typography>}
                </Typography>

                <Box>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Save />}
                        onClick={handleSaveProject}
                        sx={{ mr: 1 }}
                    >
                        Сохранить
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<FolderOpen />}
                        onClick={() => setShowProjects(prev => !prev)}
                    >
                        {showProjects ? 'Скрыть проекты' : 'Открыть проект'}
                    </Button>
                </Box>
            </Box>

            {/* Main content */}
            <Grid container spacing={2}>
                {/* Project list (conditionally shown) */}
                {showProjects && (
                    <Grid item xs={12}>
                        <ProjectList
                            onSelectProject={handleSelectProject}
                        />
                    </Grid>
                )}

                {/* Audio player */}
                <Grid item xs={12}>
                    <Player
                        audioUrl={project.audioUrl}
                        duration={project.duration}
                        currentTime={currentTime}
                        onTimeUpdate={handleTimeUpdate}
                        isPlaying={isPlaying}
                        onPlayPause={handlePlayPause}
                    />

                    {!project.audioUrl && (
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                            <Button
                                variant="outlined"
                                component="label"
                                startIcon={<UploadIcon />}
                                size="small"
                            >
                                Загрузить аудио
                                <input
                                    type="file"
                                    accept="audio/*"
                                    hidden
                                    onChange={handleAudioUpload}
                                />
                            </Button>
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                                Загрузите аудиофайл для синхронизации с анимацией
                            </Typography>
                        </Box>
                    )}
                </Grid>

                {/* Canvas and tools */}
                <Grid item xs={12} md={9}>
                    {/* Canvas */}
                    <Box
                        sx={{
                            position: 'relative',
                            backgroundColor: '#f5f5f5',
                            borderRadius: 1,
                            overflow: 'hidden'
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <Canvas
                            elements={project.elements}
                            currentTime={currentTime}
                            isPlaying={isPlaying}
                            onElementsChange={handleElementsUpdate}
                        />
                    </Box>
                </Grid>

                {/* Side panels */}
                <Grid item xs={12} md={3}>
                    <Paper sx={{ height: '100%' }}>
                        <Tabs
                            value={tabIndex}
                            onChange={(_, newValue) => setTabIndex(newValue)}
                            variant="fullWidth"
                        >
                            <Tab label="Инструменты" />
                            <Tab label="Свойства" />
                        </Tabs>

                        <Box sx={{ p: 2, height: 'calc(600px - 48px)', overflow: 'auto' }}>
                            {tabIndex === 0 && (
                                <ToolPanel onAddElement={handleAddElement} />
                            )}

                            {tabIndex === 1 && (
                                <PropertyPanel
                                    selectedElement={selectedElement}
                                    onElementUpdate={handleElementUpdate}
                                    currentTime={currentTime}
                                />
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default ConstructorPage; 