import React, { useState, useEffect, useRef } from 'react';
import { Box, Container, Typography, CircularProgress, Alert, Paper, Button, ButtonGroup, IconButton, useTheme, Dialog } from '@mui/material';
import { ThreeDRotation, Videocam, Close } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import axios from 'axios';

// Импорт компонентов
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import Navbar from '../components/Navbar';
import CombinedViewer from '../components/CombinedViewer';
import VideoViewer from '../components/VideoViewer';

const API_URL = 'http://localhost:5000/api';

// Функция для преобразования элементов в правильный формат
const normalizeElements = (elements) => {
    // Элемент по умолчанию, который будет возвращен, если не найдены корректные элементы
    const DEFAULT_ELEMENT = {
        id: 'default-element',
        type: 'rectangle',
        position: { x: 100, y: 100 },
        size: { width: 200, height: 100 },
        style: {
            opacity: 1,
            backgroundColor: '#e0e0e0',
            borderColor: '#cccccc',
            borderWidth: 1,
            zIndex: 0
        },
        content: '',
        keyframes: [],
        modelUrl: null,
        modelPath: null,
        glbUrl: null,
        model3dUrl: null
    };

    if (!elements || !Array.isArray(elements)) {
        console.warn('Elements is not an array or undefined:', elements);
        // Возвращаем элемент по умолчанию, чтобы избежать ошибки "No valid elements"
        return [DEFAULT_ELEMENT];
    }

    console.log('Raw elements from server:', JSON.stringify(elements, null, 2));

    // Если элементы приходят в виде строки JSON, попробуем распарсить
    let parsedElements = elements;
    if (elements.length === 1 && typeof elements[0] === 'string') {
        try {
            const parsed = JSON.parse(elements[0]);
            if (Array.isArray(parsed)) {
                parsedElements = parsed;
                console.log('Successfully parsed elements from JSON string');
            }
        } catch (e) {
            console.error('Failed to parse elements JSON string:', e);
        }
    }

    // Создаем уникальные ID для элементов, если их нет
    let idCounter = 1;

    const normalized = parsedElements.map(el => {
        // Если элемент вообще null или undefined, создаем базовый элемент
        if (!el) {
            const newId = `generated-${idCounter++}`;
            console.log('Created new element with ID:', newId);
            return {
                id: newId,
                type: 'rectangle',
                position: { x: 100, y: 100 },
                size: { width: 100, height: 100 },
                style: { opacity: 1, backgroundColor: '#cccccc' },
                content: '',
                keyframes: [],
                modelUrl: null,
                modelPath: null,
                glbUrl: null,
                model3dUrl: null
            };
        }

        // Проверяем наличие обязательных полей
        let elementId = el.id;

        // Если нет id, проверяем _id или генерируем новый
        if (!elementId) {
            if (el._id) {
                elementId = el._id;
                console.log('Used _id as id for element:', elementId);
            } else {
                elementId = `generated-${idCounter++}`;
                console.log('Generated new id for element:', elementId);
            }
        }

        // Определяем тип элемента
        let elementType = el.type;
        if (!elementType) {
            if (el.originalType) {
                elementType = el.originalType;
                console.log('Used originalType as type for element:', elementType);
            } else {
                elementType = 'rectangle'; // Тип по умолчанию
                console.log('Used default type for element:', elementId);
            }
        }

        // Создаем базовый элемент с обязательными полями
        const normalizedElement = {
            id: elementId,
            type: elementType,
            position: el.position || { x: 100, y: 100 },
            size: el.size || { width: 100, height: 100 },
            style: el.style || { opacity: 1, backgroundColor: '#cccccc' },
            content: el.content || '',
            keyframes: el.keyframes || [],
            // Сохраняем свойства 3D-модели
            modelUrl: el.modelUrl || null,
            modelPath: el.modelPath || null,
            glbUrl: el.glbUrl || null,
            model3dUrl: el.model3dUrl || null
        };

        // Проверяем и исправляем позицию
        if (!normalizedElement.position.x || isNaN(normalizedElement.position.x)) {
            normalizedElement.position.x = 100;
        }
        if (!normalizedElement.position.y || isNaN(normalizedElement.position.y)) {
            normalizedElement.position.y = 100;
        }

        // Проверяем и исправляем размер
        if (!normalizedElement.size.width || isNaN(normalizedElement.size.width)) {
            normalizedElement.size.width = 100;
        }
        if (!normalizedElement.size.height || isNaN(normalizedElement.size.height)) {
            normalizedElement.size.height = 100;
        }

        return normalizedElement;
    });

    // Если не найдено корректных элементов, добавляем элемент по умолчанию
    if (normalized.length === 0) {
        console.warn('No elements found after normalization, adding a default element');
        normalized.push(DEFAULT_ELEMENT);
    }

    // Дополнительная проверка, чтобы убедиться, что все элементы имеют необходимые поля
    const validElements = normalized.filter(el => el && el.id && el.type && el.position);
    if (validElements.length === 0) {
        console.warn('No valid elements after normalization, using default element');
        return [DEFAULT_ELEMENT];
    }

    console.log('Final normalized elements:', validElements);
    return validElements;
};

// Определяем компонент модального окна просмотрщика модели
const ModelViewerModal = ({ isOpen, onClose, elementId, modelUrl, elementKeyframes, videoUrl }) => {
    console.log('ModelViewerModal render:', { isOpen, elementId, modelUrl });

    // Создаем расширенные ключевые кадры с modelPath
    const enhancedKeyframes = React.useMemo(() => {
        // Начинаем с существующих ключевых кадров или пустого массива
        const baseKeyframes = elementKeyframes || [];

        // Извлекаем имя файла из modelUrl
        let filename = null;
        if (modelUrl) {
            const parts = modelUrl.split('/');
            filename = parts[parts.length - 1];
        }

        // Создаем прямой элемент с modelPath, чтобы гарантировать его отображение
        const directElement = {
            id: elementId,
            elementId: elementId,
            modelPath: modelUrl, // Используем полный исходный путь
            // Также включаем альтернативные свойства, используемые разными компонентами
            modelUrl: modelUrl,
            glbUrl: modelUrl,
            model3dUrl: modelUrl,
            // Включаем базовые обязательные свойства
            type: '3d',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            style: { opacity: 1 },
            // Добавляем ключевой кадр, чтобы сделать его видимым
            keyframes: [
                {
                    time: 0,
                    position: { x: 0, y: 0 },
                    opacity: 1,
                    scale: 1,
                    modelPath: modelUrl
                }
            ]
        };

        // Добавляем наш элемент в массив ключевых кадров
        const newKeyframes = [directElement, ...baseKeyframes];

        console.log('Enhanced keyframes for 3D model:', newKeyframes);
        return newKeyframes;
    }, [elementId, modelUrl, elementKeyframes]);

    // Убедитесь, что у вас всегда есть URL модели по умолчанию
    const effectiveModelUrl = modelUrl || '/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb';

    // Логируем дополнительную отладочную информацию
    console.log('ModelViewerModal detailed props:', {
        isOpen,
        elementId,
        modelUrl,
        effectiveModelUrl,
        hasKeyframes: elementKeyframes && elementKeyframes.length > 0,
        keyframesCount: elementKeyframes ? elementKeyframes.length : 0,
        enhancedKeyframesCount: enhancedKeyframes.length
    });

    if (!isOpen) return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 2000,
                backgroundColor: 'rgba(0, 0, 0, 0.85)'
            }}
        >
            {/* Close button in top-right corner */}
            <IconButton
                onClick={onClose}
                sx={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    zIndex: 2100,
                    color: 'white',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    '&:hover': {
                        backgroundColor: 'rgba(106, 58, 255, 0.4)'
                    }
                }}
            >
                <Close />
            </IconButton>

            <CombinedViewer
                isVisible={true}
                onClose={onClose}
                videoUrl={videoUrl}
                elementKeyframes={enhancedKeyframes}
                elementId={elementId || "default-element"}
                modelUrl={effectiveModelUrl}
                selectedModelUrl={effectiveModelUrl}
                glbAnimationUrl={effectiveModelUrl}
                embedded={false}
                debug={true}
                forceDisplayModel={true}
            />
        </Box>
    );
};

const ProjectViewPage = () => {
    // State for project data
    const [project, setProject] = useState({
        _id: null,
        name: '',
        description: '',
        duration: 60,
        audioUrl: null,
        elements: [],
        loading: true
    });

    const [selectedElement, setSelectedElement] = useState(null);
    const [normalizedElements, setNormalizedElements] = useState([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState(null);
    const [viewerMode, setViewerMode] = useState('canvas'); // 'canvas', '3d', or 'video'
    const [showCombinedViewer, setShowCombinedViewer] = useState(false);
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);
    const [view3DMode, setView3DMode] = useState(false); // New state for 3D viewer
    const [model3dUrl, setModel3dUrl] = useState('/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb'); // New state for model URL
    const [modelDialogOpen, setModelDialogOpen] = useState(false);
    const [selectedModelUrl, setSelectedModelUrl] = useState(null);

    const { projectId } = useParams();

    const theme = useTheme();

    // Load project on mount
    useEffect(() => {
        if (projectId) {
            loadProject(projectId);
        }
    }, [projectId]);

    // Animation effect when no audio is present
    useEffect(() => {
        if (!project.audioUrl && isPlaying) {
            const animateTime = (timestamp) => {
                if (!lastTimeRef.current) {
                    lastTimeRef.current = timestamp;
                }

                const elapsed = timestamp - lastTimeRef.current;

                if (elapsed > 33) { // ~30fps
                    const newTime = Math.min(currentTime + elapsed / 1000, project.duration || 60);
                    setCurrentTime(newTime);

                    if (newTime >= (project.duration || 60)) {
                        setIsPlaying(false);
                        setCurrentTime(0);
                    }

                    lastTimeRef.current = timestamp;
                }

                if (isPlaying) {
                    animationRef.current = requestAnimationFrame(animateTime);
                }
            };

            lastTimeRef.current = null;
            animationRef.current = requestAnimationFrame(animateTime);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, project.duration, project.audioUrl, currentTime]);

    // Load project from API
    const loadProject = async (id) => {
        try {
            setError(null);
            setProject(prev => ({ ...prev, loading: true }));

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Требуется авторизация');
            }

            const response = await axios.get(`${API_URL}/projects/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response || !response.data) {
                throw new Error('No project data returned');
            }

            console.log('Project data received:', response.data);

            // Process keyframesJson if available
            let elementsToNormalize = response.data.elements || [];

            if (response.data.keyframesJson) {
                try {
                    console.log('KeyframesJson found, parsing...');
                    const keyframesData = JSON.parse(response.data.keyframesJson);

                    // Add keyframes to corresponding elements
                    if (keyframesData && typeof keyframesData === 'object') {
                        elementsToNormalize = elementsToNormalize.map(element => {
                            if (element.id && keyframesData[element.id]) {
                                console.log(`Adding ${keyframesData[element.id].length} keyframes to element ${element.id}`);
                                return {
                                    ...element,
                                    keyframes: keyframesData[element.id]
                                };
                            }
                            return element;
                        });
                    }
                } catch (err) {
                    console.error('Error parsing keyframesJson:', err);
                }
            }

            // Normalize elements
            if (elementsToNormalize.length > 0) {
                const normalized = normalizeElements(elementsToNormalize);
                console.log('Normalized elements:', normalized);
                setNormalizedElements(normalized);
            } else {
                setNormalizedElements([]);
            }

            // Set project data with a default duration if none is provided
            setProject({
                ...response.data,
                duration: response.data.duration || 60,
                loading: false
            });
        } catch (err) {
            console.error('Error loading project:', err);
            setError(`Не удалось загрузить проект. ${err.message}`);
            setProject(prev => ({ ...prev, loading: false }));
        }
    };

    // Handle time update from player
    const handleTimeUpdate = (time) => {
        console.log('Time updated to:', time);
        setCurrentTime(time);
    };

    // Handle play/pause
    const handlePlayPause = (playing) => {
        console.log('Play state changed to:', playing);
        setIsPlaying(playing);
    };

    // Handle duration change from Player
    const handleDurationChange = (newDuration) => {
        console.log('ProjectViewPage: Duration changed to:', newDuration);
        setProject(prev => ({
            ...prev,
            duration: newDuration
        }));
    };

    // Show Combined Viewer
    const handleShowCombinedViewer = () => {
        setShowCombinedViewer(true);
        // Pause animation when showing viewer
        if (isPlaying) {
            setIsPlaying(false);
        }
    };

    // Hide Combined Viewer
    const handleHideCombinedViewer = () => {
        setShowCombinedViewer(false);
        setViewerMode('canvas');
    };

    // Switch viewer mode
    const handleModeChange = (mode) => {
        console.log('Changing viewer mode to:', mode);
        setViewerMode(mode);

        // Don't show CombinedViewer for video mode
        // Instead, we'll render VideoViewer directly in the content area
        if (mode === 'video') {
            console.log('Video URL:', videoUrl);
            // Don't call handleShowCombinedViewer() here anymore
        }
    };

    // Get video URL from project data
    const getVideoUrl = () => {
        // Check if project has video
        if (project.videoUrl) {
            return project.videoUrl;
        }

        // Check if any element has video
        if (project.elements && project.elements.length > 0) {
            const elementWithVideo = project.elements.find(el => el.videoUrl);
            if (elementWithVideo) {
                return elementWithVideo.videoUrl;
            }
        }

        // No video found
        return null;
    };

    const videoUrl = getVideoUrl();

    // Handle element selection
    const handleElementSelect = (element) => {
        console.log('Element selected:', element);

        // Debug full element content to find any 3D model properties
        if (element) {
            console.log('Full element data:', JSON.stringify(element, null, 2));
        }

        setSelectedElement(element);

        // If element is selected, briefly display a message to inform user
        if (element) {
            // Using browser's native toast functionality for simplicity
            const toast = document.createElement('div');
            toast.textContent = `Выбран элемент: ${element.id}`;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = '#4caf50';
            toast.style.color = 'white';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '4px';
            toast.style.zIndex = '1000';
            toast.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            document.body.appendChild(toast);

            // Remove the toast after 2 seconds
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 2000);
        }
    };

    // Check if element has a 3D model
    const has3DModel = (element) => {
        if (!element) {
            console.log('Element is null or undefined');
            return false;
        }

        // Check if the element has any 3D model properties
        if (element.modelUrl || element.modelPath || element.glbUrl || element.model3dUrl) {
            console.log('Element has 3D model properties:', {
                modelUrl: element.modelUrl,
                modelPath: element.modelPath,
                glbUrl: element.glbUrl,
                model3dUrl: element.model3dUrl
            });
            return true;
        }

        // Check if the element type is '3d'
        if (element.type === '3d' || element.is3d) {
            console.log('Element has 3D type');
            return true;
        }

        // Check the original project elements for this ID
        if (project && project.elements) {
            const originalElement = project.elements.find(el =>
                el.id === element.id || el._id === element.id);

            if (originalElement) {
                if (originalElement.modelUrl || originalElement.modelPath ||
                    originalElement.glbUrl || originalElement.model3dUrl ||
                    originalElement.type === '3d' || originalElement.is3d) {
                    console.log('Found 3D model in original project element');
                    return true;
                }
            }
        }

        console.log('Element does not have a 3D model');
        return false;
    };

    // NEW: Handle opening the 3D model dialog
    const handleOpen3DDialog = () => {
        console.log('Opening 3D dialog for element:', selectedElement);

        if (!selectedElement) {
            console.error('No element selected');
            return;
        }

        try {
            // Get raw model URLs directly from the element properties
            const modelUrl = selectedElement.modelUrl || null;
            const modelPath = selectedElement.modelPath || null;

            console.log('Raw model URLs:', { modelUrl, modelPath });

            // Choose the most appropriate URL with a clear priority order
            // IMPORTANT: We want to PRESERVE the original URL format
            let effectiveUrl = null;

            // First prefer modelPath if it exists (keep original format)
            if (modelPath) {
                effectiveUrl = modelPath;
                console.log('Using modelPath as is:', effectiveUrl);
            }
            // Then try modelUrl (keep original format) 
            else if (modelUrl) {
                effectiveUrl = modelUrl;  // Keep the FULL URL including server part
                console.log('Using modelUrl as is:', effectiveUrl);
            }
            // Fallback to other properties or default
            else {
                effectiveUrl = selectedElement.glbUrl ||
                    selectedElement.model3dUrl ||
                    '/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb';
                console.log('Using fallback URL:', effectiveUrl);
            }

            console.log('Final model URL for 3D view:', effectiveUrl);

            // Set the model URL and open the dialog
            setSelectedModelUrl(effectiveUrl);
            setModelDialogOpen(true);

            // Log the complete set of data for debugging
            console.log('ModelViewerModal receiving:', {
                isOpen: true,
                elementId: selectedElement.id,
                modelUrl: effectiveUrl,
                hasKeyframes: selectedElement.keyframes && selectedElement.keyframes.length > 0,
                keyframesCount: selectedElement.keyframes ? selectedElement.keyframes.length : 0,
                elementKeyframes: selectedElement.keyframes || []
            });

        } catch (err) {
            console.error('Error preparing 3D model:', err);

            // Show an error notification
            const toast = document.createElement('div');
            toast.textContent = `Ошибка загрузки 3D модели: ${err.message}`;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = '#f44336';
            toast.style.color = 'white';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '4px';
            toast.style.zIndex = '1000';
            toast.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            document.body.appendChild(toast);

            // Remove the toast after 3 seconds
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 3000);
        }
    };

    // NEW: Handle closing the 3D model dialog
    const handleClose3DDialog = () => {
        console.log('Closing 3D dialog');
        setModelDialogOpen(false);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {project.loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h4" component="h1">
                                    {project.name}
                                </Typography>
                                {project.description && (
                                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                                        {project.description}
                                    </Typography>
                                )}
                            </Box>

                            {/* Player */}
                            <Box sx={{ mb: 2 }}>
                                <Player
                                    duration={project.duration || 60}
                                    audioUrl={project.audioUrl}
                                    currentTime={currentTime}
                                    onTimeUpdate={handleTimeUpdate}
                                    onPlayPause={handlePlayPause}
                                    onDurationChange={handleDurationChange}
                                    isPlaying={isPlaying}
                                    readOnly={true}
                                />
                                {process.env.NODE_ENV !== 'production' && (
                                    <div style={{ fontSize: '12px', color: 'gray', marginTop: '4px' }}>
                                        Duration: {project.duration || 'Not set'}, Audio: {project.audioUrl ? 'Yes' : 'No'}
                                    </div>
                                )}
                            </Box>

                            {/* Canvas/3D/Video Container */}
                            <Paper
                                elevation={3}
                                sx={{
                                    position: 'relative',
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? 'rgba(32, 38, 52, 0.85)'  // Lighter, more neutral dark blue
                                        : 'rgba(240, 245, 255, 0.9)', // Very light blue-gray in light mode
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    height: 'calc(100vh - 300px)',
                                    minHeight: '600px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? '0 8px 24px 0 rgba(0, 0, 0, 0.2)'
                                        : '0 8px 24px 0 rgba(0, 0, 0, 0.1)',
                                    border: `1px solid ${theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : 'rgba(30, 144, 255, 0.15)'}`,
                                    backdropFilter: 'blur(8px)',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        boxShadow: theme.palette.mode === 'dark'
                                            ? '0 12px 28px 0 rgba(0, 0, 0, 0.4)'
                                            : '0 12px 28px 0 rgba(0, 0, 0, 0.15)',
                                    }
                                }}
                            >
                                {/* Mode selection buttons */}
                                <Box sx={{
                                    p: 1,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    borderBottom: `1px solid ${theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.08)'
                                        : 'rgba(0, 0, 0, 0.08)'}`,
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? 'rgba(26, 32, 46, 0.95)' // Darker blue for contrast
                                        : 'rgba(240, 245, 255, 0.95)'
                                }}>
                                    <ButtonGroup variant="contained">
                                        <Button
                                            onClick={() => handleModeChange('canvas')}
                                            variant={viewerMode === 'canvas' ? 'contained' : 'outlined'}
                                            color={viewerMode === 'canvas' ? 'primary' : 'inherit'}
                                            sx={{
                                                borderRadius: '8px',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                borderColor: theme.palette.mode === 'dark'
                                                    ? 'rgba(30, 144, 255, 0.3)'
                                                    : undefined,
                                                backgroundColor: viewerMode === 'canvas'
                                                    ? theme.palette.mode === 'dark'
                                                        ? 'rgba(30, 144, 255, 0.2)'
                                                        : undefined
                                                    : undefined
                                            }}
                                        >
                                            Анимация
                                        </Button>
                                        <Button
                                            startIcon={<Videocam />}
                                            onClick={() => handleModeChange('video')}
                                            variant={viewerMode === 'video' ? 'contained' : 'outlined'}
                                            color={viewerMode === 'video' ? 'primary' : 'inherit'}
                                            disabled={!videoUrl}
                                            sx={{
                                                borderRadius: '8px',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                borderColor: theme.palette.mode === 'dark'
                                                    ? 'rgba(30, 144, 255, 0.3)'
                                                    : undefined,
                                                backgroundColor: viewerMode === 'video'
                                                    ? theme.palette.mode === 'dark'
                                                        ? 'rgba(30, 144, 255, 0.2)'
                                                        : undefined
                                                    : undefined
                                            }}
                                        >
                                            Видео
                                        </Button>
                                    </ButtonGroup>
                                </Box>

                                {/* Content area */}
                                <Box sx={{
                                    flexGrow: 1,
                                    position: 'relative',
                                    // Добавляем фоновую сетку как в ConstructorPage
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? 'rgba(32, 38, 52, 0.85)'  // Lighter, more neutral dark blue
                                        : 'rgba(240, 245, 255, 0.9)', // Very light blue-gray in light mode
                                    backgroundImage: `
                                        linear-gradient(to right, ${theme.palette.mode === 'dark'
                                            ? 'rgba(160, 140, 255, 0.07)'
                                            : 'rgba(106, 58, 255, 0.05)'} 1px, rgba(0, 0, 0, 0) 1px),
                                        linear-gradient(to bottom, ${theme.palette.mode === 'dark'
                                            ? 'rgba(160, 140, 255, 0.07)'
                                            : 'rgba(106, 58, 255, 0.05)'} 1px, rgba(0, 0, 0, 0) 1px)
                                    `,
                                    backgroundSize: '20px 20px'
                                }}>
                                    {/* Canvas View - only render when it's the active view */}
                                    {viewerMode === 'canvas' && (
                                        <>
                                            <Canvas
                                                elements={normalizedElements}
                                                currentTime={currentTime}
                                                isPlaying={isPlaying}
                                                readOnly={true}
                                                selectedElement={selectedElement}
                                                onElementSelect={handleElementSelect}
                                            />
                                        </>
                                    )}

                                    {/* Video View - added directly to main content area */}
                                    {viewerMode === 'video' && videoUrl && (
                                        <Box sx={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            position: 'relative'
                                        }}>
                                            <VideoViewer
                                                videoUrl={videoUrl}
                                                isVisible={true}
                                                embedded={true}
                                                currentTime={currentTime}
                                                isPlaying={isPlaying}
                                            />
                                        </Box>
                                    )}

                                    {/* No video message */}
                                    {viewerMode === 'video' && !videoUrl && (
                                        <Box sx={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}>
                                            <Typography variant="h5" sx={{ mb: 2 }}>
                                                Видео не доступно
                                            </Typography>
                                            <Alert severity="info" sx={{ maxWidth: '600px' }}>
                                                Для этого проекта не указано видео. Вы можете добавить видео в режиме редактирования.
                                            </Alert>
                                        </Box>
                                    )}
                                </Box>
                            </Paper>

                            {/* NEW: Standalone 3D Model Dialog */}
                            <ModelViewerModal
                                isOpen={modelDialogOpen}
                                onClose={handleClose3DDialog}
                                elementId={selectedElement?.id || "default-element"}
                                modelUrl={selectedModelUrl || '/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb'}
                                elementKeyframes={selectedElement?.keyframes || []}
                                videoUrl={videoUrl}
                            />

                            {/* Debug output for development - make it visible */}
                            {process.env.NODE_ENV !== 'production' && (
                                <div style={{
                                    position: 'fixed',
                                    bottom: '10px',
                                    right: '10px',
                                    background: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    padding: '10px',
                                    fontSize: '12px',
                                    zIndex: 9999,
                                    maxWidth: '400px',
                                    maxHeight: '200px',
                                    overflow: 'auto',
                                    borderRadius: '4px'
                                }}>
                                    <pre>
                                        {JSON.stringify({
                                            modelDialogOpen,
                                            selectedModelUrl,
                                            selectedElementId: selectedElement?.id,
                                            hasKeyframes: selectedElement?.keyframes?.length > 0,
                                            modelProperties: selectedElement ? {
                                                modelUrl: selectedElement.modelUrl,
                                                modelPath: selectedElement.modelPath,
                                                glbUrl: selectedElement.glbUrl,
                                                model3dUrl: selectedElement.model3dUrl
                                            } : null
                                        }, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </>
                    )}
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectViewPage; 