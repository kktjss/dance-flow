import React, { useState, useEffect } from 'react';
import { Box, Button, Container, Grid, Paper, Tab, Tabs, Typography, IconButton, TextField, InputAdornment, Menu, MenuItem } from '@mui/material';
import { Save, FolderOpen, Upload as UploadIcon, AccessTime, ContentCopy } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Import components
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import ToolPanel from '../components/ToolPanel';
import PropertyPanel from '../components/PropertyPanel';
import ProjectList from '../components/ProjectList';
import ModelViewer from '../components/ModelViewer';

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
    const [isEditingDuration, setIsEditingDuration] = useState(false);
    const [isRecordingKeyframes, setIsRecordingKeyframes] = useState(false);
    const [copyMenuAnchor, setCopyMenuAnchor] = useState(null);
    const [clipboardElement, setClipboardElement] = useState(null);
    const [clipboardKeyframes, setClipboardKeyframes] = useState(null);

    // Expose jumpToTime function to the window for PropertyPanel's keyframe navigation
    useEffect(() => {
        window.jumpToTime = (time) => {
            setCurrentTime(Math.min(project.duration, Math.max(0, time)));
        };

        return () => {
            delete window.jumpToTime;
        };
    }, [project.duration]);

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
        // Switch to properties tab when an element is selected
        if (element) {
            setTabIndex(1);
        }
    };

    // Handle adding a new element to the canvas
    const handleAddElement = (element) => {
        setProject(prev => ({
            ...prev,
            elements: [...prev.elements, element]
        }));

        // Auto-select the newly added element
        setSelectedElement(element);
        setTabIndex(1);
    };

    // Open Copy menu
    const handleOpenCopyMenu = (event) => {
        if (selectedElement) {
            setCopyMenuAnchor(event.currentTarget);
        }
    };

    // Close Copy menu
    const handleCloseCopyMenu = () => {
        setCopyMenuAnchor(null);
    };

    // Copy element properties (without animations)
    const handleCopyElementProperties = () => {
        if (selectedElement) {
            const elementProperties = {
                type: selectedElement.type,
                size: { ...selectedElement.size },
                style: { ...selectedElement.style },
                content: selectedElement.content
            };

            setClipboardElement(elementProperties);
            handleCloseCopyMenu();
        }
    };

    // Copy element animations (keyframes)
    const handleCopyElementAnimations = () => {
        if (selectedElement && selectedElement.keyframes) {
            // Deep copy keyframes
            const keyframesCopy = JSON.parse(JSON.stringify(selectedElement.keyframes));
            setClipboardKeyframes(keyframesCopy);
            handleCloseCopyMenu();
        }
    };

    // Paste element properties to selected element
    const handlePasteElementProperties = () => {
        if (selectedElement && clipboardElement) {
            const updatedElement = {
                ...selectedElement,
                size: { ...clipboardElement.size },
                style: { ...clipboardElement.style }
            };

            // Paste content only if types match
            if (selectedElement.type === clipboardElement.type &&
                (selectedElement.type === 'text' || selectedElement.type === 'image')) {
                updatedElement.content = clipboardElement.content;
            }

            handleElementUpdate(updatedElement);
        }
    };

    // Paste animations to selected element
    const handlePasteElementAnimations = () => {
        if (selectedElement && clipboardKeyframes) {
            // Create a new version of the element with copied keyframes
            const updatedElement = {
                ...selectedElement,
                keyframes: JSON.parse(JSON.stringify(clipboardKeyframes))
            };

            handleElementUpdate(updatedElement);
        }
    };

    // Check if we can paste properties or animations
    const canPasteProperties = Boolean(clipboardElement && selectedElement);
    const canPasteAnimations = Boolean(clipboardKeyframes && selectedElement);

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

        // Update the selected element as well
        if (selectedElement && selectedElement.id === updatedElement.id) {
            setSelectedElement(updatedElement);
        }
    };

    // Handle bulk update to all elements
    const handleElementsUpdate = (updatedElements) => {
        setProject(prev => ({ ...prev, elements: updatedElements }));

        // Update selected element if it's in the updated list
        if (selectedElement) {
            const updatedSelectedElement = updatedElements.find(elem => elem.id === selectedElement.id);
            if (updatedSelectedElement) {
                setSelectedElement(updatedSelectedElement);
            }
        }
    };

    // Handle project duration change
    const handleDurationChange = (e) => {
        const newDuration = Math.max(1, parseInt(e.target.value) || 1);
        setProject(prev => ({ ...prev, duration: newDuration }));

        // If current time is beyond the new duration, reset it
        if (currentTime > newDuration) {
            setCurrentTime(0);
        }
    };

    // Toggle keyframe recording mode
    const toggleKeyframeRecording = () => {
        setIsRecordingKeyframes(prev => !prev);
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
        setSelectedElement(null); // Clear selected element when switching projects
    };

    // Auto-update project duration based on audio
    useEffect(() => {
        const audioElement = document.createElement('audio');
        if (project.audioUrl) {
            audioElement.src = project.audioUrl;
            audioElement.addEventListener('loadedmetadata', () => {
                if (audioElement.duration) {
                    setProject(prev => ({
                        ...prev,
                        duration: Math.ceil(audioElement.duration)
                    }));
                }
            });
        }

        return () => {
            audioElement.src = '';
        };
    }, [project.audioUrl]);

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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        {!project.audioUrl && (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <AccessTime color="action" sx={{ mr: 1 }} />
                                {isEditingDuration ? (
                                    <TextField
                                        label="Длительность"
                                        type="number"
                                        size="small"
                                        value={project.duration}
                                        onChange={handleDurationChange}
                                        onBlur={() => setIsEditingDuration(false)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setIsEditingDuration(false);
                                            }
                                        }}
                                        autoFocus
                                        InputProps={{
                                            endAdornment: <InputAdornment position="end">сек</InputAdornment>,
                                        }}
                                        sx={{ width: 150 }}
                                    />
                                ) : (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        onClick={() => setIsEditingDuration(true)}
                                        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                    >
                                        Длительность: {project.duration} сек (нажмите чтобы изменить)
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {!project.audioUrl && (
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
                        )}
                    </Box>

                    <Player
                        audioUrl={project.audioUrl}
                        duration={project.duration}
                        currentTime={currentTime}
                        onTimeUpdate={handleTimeUpdate}
                        isPlaying={isPlaying}
                        onPlayPause={handlePlayPause}
                    />
                </Grid>

                {/* Canvas and tools */}
                <Grid item xs={12} md={9}>
                    {/* Canvas controls */}
                    <Box
                        sx={{
                            mb: 1,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                        }}
                    >
                        <Box sx={{ flexGrow: 1 }}>
                            {selectedElement && (
                                <Typography variant="body2" color="text.secondary">
                                    Выбран: {selectedElement.type}
                                </Typography>
                            )}
                        </Box>

                        {selectedElement && (
                            <>
                                <IconButton
                                    color="primary"
                                    aria-label="copy"
                                    onClick={handleOpenCopyMenu}
                                    title="Копировать свойства"
                                >
                                    <ContentCopy />
                                </IconButton>

                                <Menu
                                    anchorEl={copyMenuAnchor}
                                    open={Boolean(copyMenuAnchor)}
                                    onClose={handleCloseCopyMenu}
                                >
                                    <MenuItem onClick={handleCopyElementProperties}>
                                        Копировать стиль и размер
                                    </MenuItem>
                                    {selectedElement && selectedElement.keyframes && selectedElement.keyframes.length > 0 && (
                                        <MenuItem onClick={handleCopyElementAnimations}>
                                            Копировать анимацию
                                        </MenuItem>
                                    )}
                                </Menu>

                                {canPasteProperties && (
                                    <Button
                                        size="small"
                                        onClick={handlePasteElementProperties}
                                        sx={{ mr: 1 }}
                                    >
                                        Вставить стиль
                                    </Button>
                                )}

                                {canPasteAnimations && (
                                    <Button
                                        size="small"
                                        onClick={handlePasteElementAnimations}
                                    >
                                        Вставить анимацию
                                    </Button>
                                )}
                            </>
                        )}
                    </Box>

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
                            selectedElement={selectedElement}
                            onElementSelect={handleElementSelect}
                        />
                    </Box>

                    {/* Animation tips */}
                    <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(25, 118, 210, 0.08)', borderRadius: 1 }}>
                        <Typography variant="body2" color="primary">
                            Совет по анимации: для создания анимации переместите плеер на нужное время,
                            затем перетащите объект в нужное положение.
                        </Typography>
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