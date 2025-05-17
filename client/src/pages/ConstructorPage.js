import React, { useState, useEffect } from 'react';
import { Box, Button, Container, Grid, Paper, Tab, Tabs, Typography, IconButton, TextField, InputAdornment, Menu, MenuItem, Snackbar, Alert, List, ListItem, ListItemIcon, ListItemText, ButtonGroup, useTheme } from '@mui/material';
import { Save, FolderOpen, Upload as UploadIcon, AccessTime, ContentCopy, VideoLibrary, Delete as DeleteIcon, MusicNote as MusicNoteIcon, CloudUpload, Close, Edit } from '@mui/icons-material';
import ThreeDRotation from '@mui/icons-material/ThreeDRotation';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { styled } from '@mui/material/styles';
import { COLORS } from '../constants/colors';

// Import components
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import ToolPanel from '../components/ToolPanel';
import PropertyPanel from '../components/PropertyPanel';
import ProjectsList from '../components/ProjectsList';
import ModelViewer from '../components/ModelViewer';
import CombinedViewer from '../components/CombinedViewer';
import VideoViewer from '../components/VideoViewer';
import ProjectDialog from '../components/ProjectDialog';

const API_URL = 'http://localhost:5000/api';

// Импортируем цветовую палитру для согласованности стиля
const PALETTE = {
    // Основные цвета
    primary: {
        light: COLORS.primaryLight,
        main: COLORS.primary, // Blue-violet
        dark: '#5449A6'
    },
    secondary: {
        light: COLORS.secondaryLight,
        main: COLORS.secondary, // Light blue
        dark: '#0071CE'
    },
    tertiary: {
        light: COLORS.tertiaryLight,
        main: COLORS.tertiary, // Turquoise
        dark: '#2CB5B5'
    },
    // Дополнительные цвета
    teal: {
        light: '#7DEEFF',
        main: COLORS.teal, // Teal
        dark: '#008B9A'
    },
    accent: {
        light: '#FFE066',
        main: COLORS.accent, // Yellow
        dark: '#E6C300'
    },
    // Нейтральные цвета
    purpleGrey: {
        light: '#9D94D3',
        main: '#8678B2', // Grey-purple
        dark: '#5D5080'
    }
};

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    borderRadius: '12px',
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(32, 38, 52, 0.85)'  // Lighter, more neutral dark blue
        : 'rgba(240, 245, 255, 0.9)', // Very light blue-gray in light mode
    boxShadow: theme.palette.mode === 'dark'
        ? '0 8px 24px 0 rgba(0, 0, 0, 0.2)'
        : '0 8px 24px 0 rgba(0, 0, 0, 0.1)',
    border: `1px solid ${theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(30, 144, 255, 0.15)'}`,
    position: 'relative',
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.3s ease',
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: '8px',
    fontWeight: 600,
    textTransform: 'none',
    transition: 'all 0.2s',
    boxShadow: theme.palette.mode === 'dark'
        ? '0 4px 12px rgba(30, 144, 255, 0.2)'
        : 'none',
    '&.MuiButton-contained': {
        background: `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`,
        color: '#fff',
    },
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: theme.palette.mode === 'dark'
            ? '0 6px 16px rgba(30, 144, 255, 0.3)'
            : '0 6px 16px rgba(30, 144, 255, 0.2)',
    }
}));

const StyledTab = styled(Tab)(({ theme }) => ({
    fontWeight: 600,
    textTransform: 'none',
    minHeight: '48px',
    color: theme.palette.mode === 'dark'
        ? theme.palette.grey[400]
        : theme.palette.text.secondary,
    '&.Mui-selected': {
        color: COLORS.secondary,
    },
    transition: 'all 0.2s',
}));

const StyledHistoryItem = styled(ListItem)(({ theme }) => ({
    borderRadius: '8px',
    transition: 'all 0.2s',
    '&:hover': {
        backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.03)',
    }
}));

const ConstructorPage = () => {
    const theme = useTheme();
    const [project, setProject] = useState({
        name: 'Новый проект',
        description: '',
        duration: 60,
        elements: [],
        audioUrl: '',
        videoUrl: '',
        glbAnimations: []
    });
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedElement, setSelectedElement] = useState(null);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
    const [isRecordingKeyframes, setIsRecordingKeyframes] = useState(false);
    const [showProjects, setShowProjects] = useState(false);
    const [copiedProperties, setCopiedProperties] = useState(null);
    const [copiedAnimations, setCopiedAnimations] = useState(null);
    const [copyMenuAnchorEl, setCopyMenuAnchorEl] = useState(null);
    const [isUploading, setIsUploading] = useState({
        audio: false,
        video: false,
        glb: false
    });
    const [showProjectDialog, setShowProjectDialog] = useState(false);
    const [isEditingProjectInfo, setIsEditingProjectInfo] = useState(false);
    const { id } = useParams();
    const navigate = useNavigate();

    // Экспортируем функцию сохранения проекта в глобальную область видимости
    // для доступа из других компонентов
    useEffect(() => {
        // Создаем функцию-обертку, которая будет вызывать handleSaveProject
        window.saveProject = () => {
            console.log('Global saveProject function called');
            handleSaveProject();
        };

        // Очистка при размонтировании компонента
        return () => {
            window.saveProject = undefined;
            console.log('Global saveProject function removed');
        };
    }, [project]); // Зависимость от project, чтобы функция всегда имела доступ к актуальному состоянию

    // State for UI
    const [tabIndex, setTabIndex] = useState(0);
    const [isEditingDuration, setIsEditingDuration] = useState(false);
    const [viewMode, setViewMode] = useState('2d'); // '2d' или 'video'

    // Автоматическое переключение на режим видео при загрузке видео
    useEffect(() => {
        if (project.videoUrl && viewMode !== 'video' && viewMode !== '2d') {
            setViewMode('video');
        } else if (viewMode === '3d') {
            // Если режим был установлен в '3d', переключаем на '2d'
            setViewMode('2d');
        }
    }, [project.videoUrl, viewMode]);

    // Инициализация проекта
    useEffect(() => {
        console.log('ConstructorPage: Initializing project');

        // Проверяем наличие ID в URL
        const projectId = id;
        if (projectId) {
            console.log('ConstructorPage: Found project ID in URL:', projectId);
            handleSelectProject(projectId);
        } else {
            console.log('ConstructorPage: No project ID in URL, showing project dialog');
            setShowProjectDialog(true);
        }
    }, [id]);

    // Загружаем проект при монтировании, если есть projectId в URL
    useEffect(() => {
        const projectId = id;
        if (projectId && !project.id) {
            console.log('Loading project from URL parameter:', projectId);
            handleSelectProject(projectId);
        }
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            elements: prev.elements ? [...prev.elements, element] : [element]
        }));

        // Auto-select the newly added element
        setSelectedElement(element);
        setTabIndex(1);
    };

    // Open Copy menu
    const handleOpenCopyMenu = (event) => {
        if (selectedElement) {
            setCopyMenuAnchorEl(event.currentTarget);
        }
    };

    // Close Copy menu
    const handleCloseCopyMenu = () => {
        setCopyMenuAnchorEl(null);
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

            setCopiedProperties(elementProperties);
            handleCloseCopyMenu();
        }
    };

    // Copy element animations (keyframes)
    const handleCopyElementAnimations = () => {
        if (selectedElement && selectedElement.keyframes) {
            // Deep copy keyframes
            const keyframesCopy = JSON.parse(JSON.stringify(selectedElement.keyframes));
            setCopiedAnimations(keyframesCopy);
            handleCloseCopyMenu();
        }
    };

    // Paste element properties to selected element
    const handlePasteElementProperties = () => {
        if (selectedElement && copiedProperties) {
            const updatedElement = {
                ...selectedElement,
                size: { ...copiedProperties.size },
                style: { ...copiedProperties.style }
            };

            // Paste content only if types match
            if (selectedElement.type === copiedProperties.type &&
                (selectedElement.type === 'text' || selectedElement.type === 'image')) {
                updatedElement.content = copiedProperties.content;
            }

            handleElementUpdate(updatedElement);
        }
    };

    // Paste animations to selected element
    const handlePasteElementAnimations = () => {
        if (selectedElement && copiedAnimations) {
            // Create a new version of the element with copied keyframes
            const updatedElement = {
                ...selectedElement,
                keyframes: JSON.parse(JSON.stringify(copiedAnimations))
            };

            handleElementUpdate(updatedElement);
        }
    };

    // Check if we can paste properties or animations
    const canPasteProperties = Boolean(copiedProperties && selectedElement);
    const canPasteAnimations = Boolean(copiedAnimations && selectedElement);

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

    // Handle element update
    const handleElementUpdate = (updatedElement) => {
        setProject(prev => ({
            ...prev,
            elements: prev.elements
                ? prev.elements.map(elem => elem.id === updatedElement.id ? updatedElement : elem)
                : [updatedElement]
        }));

        // Update selected element if it's the one being updated
        if (selectedElement && selectedElement.id === updatedElement.id) {
            setSelectedElement(updatedElement);
        }
    };

    // Handle bulk update to all elements
    const handleElementsUpdate = (updatedElements) => {
        if (!updatedElements || !Array.isArray(updatedElements)) {
            console.error('Invalid elements array received:', updatedElements);
            return;
        }

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

    // Test keyframe saving
    const handleTestSave = async () => {
        try {
            console.log('*** KEYFRAME SAVE TEST ***');
            console.log(`Current project has ${project.elements?.reduce((sum, el) => sum + (el.keyframes?.length || 0), 0)} total keyframes`);

            // Verify keyframes before copying
            if (project.elements && project.elements.length > 0) {
                project.elements.forEach((element, idx) => {
                    console.log(`Element ${idx} (${element.id}): keyframes=${element.keyframes?.length || 0}`);
                    if (element.keyframes && element.keyframes.length > 0) {
                        console.log('  Sample original keyframe:', element.keyframes[0]);
                    }
                });
            }

            // Make a deep copy of the project, as we would for a real save
            console.log('Creating deep copy of project...');
            let projectCopy;
            try {
                const projectString = JSON.stringify(project);
                console.log(`Project stringified, length: ${projectString.length} chars`);
                console.log(`Keyframes in string: ${projectString.includes('"keyframes":')} (${projectString.indexOf('"keyframes":')})`);
                projectCopy = JSON.parse(projectString);
                console.log('Project successfully parsed from JSON');
            } catch (jsonError) {
                console.error('ERROR IN JSON PROCESS:', jsonError);
                throw new Error(`JSON serialization failed: ${jsonError.message}`);
            }

            // Log first element's keyframes for inspection
            if (projectCopy.elements && projectCopy.elements.length > 0) {
                const element = projectCopy.elements[0];
                console.log(`First element (${element.id}) after copy has ${element.keyframes?.length || 0} keyframes`);

                if (element.keyframes && element.keyframes.length > 0) {
                    console.log('Sample keyframe after copy:', element.keyframes[0]);
                } else {
                    console.error('CRITICAL ERROR: Keyframes were lost during copy!');
                }
            }

            // Send to the debug endpoint with POST method
            console.log('Sending project to debug endpoint...');
            const debugUrl = `${API_URL}/projects/${project.id || 'test-project'}/debug`;
            console.log(`Debug POST URL: ${debugUrl}`);

            try {
                const response = await axios.post(debugUrl, projectCopy);
                console.log('Debug response:', response.data);

                // Alert with results
                const { totalKeyframes, elementsWithKeyframes } = response.data;
                const extractedData = response.data.extractedKeyframesData;

                alert(`Save Test Results:
- Project has ${totalKeyframes} keyframes across ${elementsWithKeyframes} elements
- After processing, extracted ${extractedData.totalKeyframes} keyframes for ${extractedData.elementCount} elements
- Serialized JSON length: ${extractedData.keyframesJsonLength}

See console for complete details.`);
            } catch (axiosError) {
                console.error('AXIOS ERROR:', axiosError);
                if (axiosError.response) {
                    console.error('Response status:', axiosError.response.status);
                    console.error('Response data:', axiosError.response.data);
                } else if (axiosError.request) {
                    console.error('No response received from server');
                }
                throw new Error(`API request failed: ${axiosError.message}`);
            }

        } catch (err) {
            console.error('Error in save test:', err);
            alert(`Error testing save process: ${err.message}\nSee console for details.`);
        }
    };

    // Direct save function definition (rebuilt from scratch)
    const handleDirectSave = async () => {
        console.log('*** DIRECT KEYFRAME SAVE - FRESH IMPLEMENTATION ***');

        try {
            if (!project.id) {
                alert('Необходимо сначала сохранить проект!');
                return;
            }

            // Find elements with keyframes
            const elementsWithKeyframes = [];

            if (project.elements && project.elements.length > 0) {
                for (const element of project.elements) {
                    if (element.keyframes && Array.isArray(element.keyframes) && element.keyframes.length > 0) {
                        elementsWithKeyframes.push({
                            id: element.id,
                            keyframesCount: element.keyframes.length,
                            keyframes: JSON.parse(JSON.stringify(element.keyframes)) // Deep copy
                        });
                    }
                }
            }

            if (elementsWithKeyframes.length === 0) {
                alert('Не найдены ключевые кадры для сохранения!');
                return;
            }

            console.log(`Found ${elementsWithKeyframes.length} elements with keyframes`);

            // Select the element with the most keyframes
            const targetElement = elementsWithKeyframes.reduce(
                (max, current) => current.keyframesCount > max.keyframesCount ? current : max,
                elementsWithKeyframes[0]
            );

            console.log(`Selected element ${targetElement.id} with ${targetElement.keyframesCount} keyframes for direct save`);

            // Send direct update request
            const directUrl = `${API_URL}/projects/${project.id}/direct-keyframes`;
            console.log(`Direct update URL: ${directUrl}`);

            const updateData = {
                elementId: targetElement.id,
                keyframes: targetElement.keyframes
            };

            console.log('Sending direct update request with data:', updateData);
            const response = await axios.post(directUrl, updateData);

            console.log('Direct update response:', response.data);

            // Show success message
            if (response.data.success) {
                const verification = response.data.verification;

                alert(`Прямое сохранение успешно!
- Элемент: ${targetElement.id}
- Сохранено ${targetElement.keyframesCount} ключевых кадров
- Проверка в БД: ${verification?.totalKeyframes || 'н/д'} ключевых кадров
- Длина JSON в БД: ${verification?.keyframesJsonLength || 'н/д'}

Запустите диагностику для проверки.`);
            } else {
                alert('Прямое сохранение не удалось. Проверьте консоль для деталей.');
            }

        } catch (err) {
            console.error('Error in direct save:', err);
            alert(`Ошибка прямого сохранения: ${err.message}\nПроверьте консоль для деталей.`);
        }
    };

    // Function to show notification
    const showNotification = (message, severity = 'success') => {
        setNotification({
            open: true,
            message,
            severity
        });
    };

    // Function to close notification
    const handleCloseNotification = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setNotification({ ...notification, open: false });
    };

    // Handle saving the project
    const handleSaveProject = async () => {
        try {
            // Log current project state before processing
            const initialKeframesCount = project.elements?.reduce((sum, el) => sum + (el.keyframes?.length || 0), 0);
            console.log(`Project state before saving has ${initialKeframesCount} total keyframes across ${project.elements?.length || 0} elements`);

            // **CRITICAL DIAGNOSTIC**: Direct check for keyframes in every element
            if (project.elements && project.elements.length > 0) {
                console.log('*** KEYFRAME DIAGNOSTIC BEFORE SAVE ***');
                project.elements.forEach((el, index) => {
                    console.log(`Element ${index}: id=${el.id}, type=${el.type}, keyframes=${el.keyframes?.length || 0}`);

                    // Verify keyframes array exists and is valid
                    if (el.keyframes === undefined) {
                        console.error(`  ERROR: Element ${el.id} has undefined keyframes property`);
                    } else if (!Array.isArray(el.keyframes)) {
                        console.error(`  ERROR: Element ${el.id} has non-array keyframes: ${typeof el.keyframes}`);
                    } else if (el.keyframes.length > 0) {
                        console.log(`  Sample keyframe for ${el.id}: ${JSON.stringify(el.keyframes[0])}`);

                        // Check for NaN or invalid values
                        el.keyframes.forEach((kf, kfIndex) => {
                            if (isNaN(kf.time) ||
                                isNaN(kf.position?.x) ||
                                isNaN(kf.position?.y) ||
                                isNaN(kf.opacity)) {
                                console.error(`  INVALID KEYFRAME DATA at index ${kfIndex}:`, kf);
                            }
                        });
                    }
                });
            }

            // Create a deep copy of the project to avoid mutating the state
            const projectToSave = JSON.parse(JSON.stringify(project));

            // Проверим, что ключевые кадры правильно скопировались
            const copiedKeframesCount = projectToSave.elements?.reduce((sum, el) => sum + (el.keyframes?.length || 0), 0);
            console.log(`Deep copied project has ${copiedKeframesCount} total keyframes (original: ${initialKeframesCount})`);

            // **CRITICAL**: Create comprehensive project backup before saving
            try {
                // Only backup if we have keyframes and a project ID
                if (projectToSave.elements && projectToSave.elements.length > 0 && initialKeframesCount > 0) {
                    console.log('Creating comprehensive keyframes backup before save...');

                    // Create a map of element ID to keyframes
                    const keyframesBackup = {};
                    let totalBackedUpKeyframes = 0;

                    projectToSave.elements.forEach(element => {
                        if (element.id && element.keyframes && Array.isArray(element.keyframes) && element.keyframes.length > 0) {
                            // Validate and store only valid keyframes
                            const validKeyframes = element.keyframes.filter(kf =>
                                kf &&
                                typeof kf.time === 'number' && !isNaN(kf.time) &&
                                kf.position &&
                                typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                                typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                                typeof kf.opacity === 'number' && !isNaN(kf.opacity)
                            );

                            if (validKeyframes.length > 0) {
                                keyframesBackup[element.id] = validKeyframes;
                                totalBackedUpKeyframes += validKeyframes.length;
                            }
                        }
                    });

                    // If we have a project ID, store the backup
                    if (project.id) {
                        const backupKey = `project-keyframes-${project.id}`;
                        localStorage.setItem(backupKey, JSON.stringify(keyframesBackup));
                        console.log(`Created localStorage backup with ${totalBackedUpKeyframes} keyframes for ${Object.keys(keyframesBackup).length} elements`);
                    } else {
                        // Store in a temporary key for new projects
                        localStorage.setItem('new-project-keyframes-backup', JSON.stringify(keyframesBackup));
                        console.log(`Created temporary backup with ${totalBackedUpKeyframes} keyframes for ${Object.keys(keyframesBackup).length} elements`);
                    }
                }
            } catch (backupError) {
                console.error('Failed to create keyframes backup:', backupError);
            }

            // **CRITICAL BUGFIX**: Ensure keyframes arrays exist for all elements
            if (projectToSave.elements) {
                projectToSave.elements.forEach(element => {
                    // Create keyframes array if it doesn't exist
                    if (!element.keyframes) {
                        console.log(`Creating missing keyframes array for element ${element.id}`);
                        element.keyframes = [];
                    } else if (!Array.isArray(element.keyframes)) {
                        console.error(`Converting non-array keyframes to empty array for element ${element.id}`);
                        element.keyframes = [];
                    }

                    // CRITICAL FIX: Ensure modelPath and modelUrl are properly preserved
                    if (element.type === '3d') {
                        console.log(`Ensuring model data is preserved for 3D element ${element.id}:`, {
                            modelPath: element.modelPath || 'none',
                            modelUrl: element.modelUrl || 'none'
                        });

                        // Make sure modelPath and modelUrl are consistent
                        if (element.modelPath && !element.modelUrl) {
                            element.modelUrl = element.modelPath;
                            console.log(`Set missing modelUrl to modelPath for element ${element.id}`);
                        } else if (element.modelUrl && !element.modelPath) {
                            element.modelPath = element.modelUrl;
                            console.log(`Set missing modelPath to modelUrl for element ${element.id}`);
                        }

                        // If element has keyframes, make sure they all have the model information
                        if (element.keyframes && element.keyframes.length > 0) {
                            const modelPath = element.modelPath || element.modelUrl;
                            if (modelPath) {
                                element.keyframes.forEach(keyframe => {
                                    keyframe.modelPath = modelPath;
                                    keyframe.modelUrl = modelPath;
                                });
                                console.log(`Propagated model path to ${element.keyframes.length} keyframes for element ${element.id}`);
                            }
                        }
                    }
                });
            }

            if (copiedKeframesCount !== initialKeframesCount) {
                console.error("CRITICAL ERROR: KeyFrame count mismatch after copying! This means JSON serialization failed.");
                // Резервное копирование в случае проблем с JSON сериализацией
                projectToSave.elements.forEach((el, idx) => {
                    if (project.elements[idx] && project.elements[idx].keyframes) {
                        console.log(`Manually copying ${project.elements[idx].keyframes.length} keyframes for element ${el.id}`);
                        el.keyframes = [...project.elements[idx].keyframes];
                    }
                });
            }

            // Validate all keyframes before sending to server
            let validationFailed = false;

            if (projectToSave.elements) {
                projectToSave.elements.forEach(element => {
                    if (element.keyframes && element.keyframes.length > 0) {
                        // Filter out invalid keyframes
                        const validKeyframes = element.keyframes.filter(kf => {
                            const isValid = kf &&
                                typeof kf.time === 'number' && !isNaN(kf.time) &&
                                kf.position &&
                                typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                                typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                                typeof kf.opacity === 'number' && !isNaN(kf.opacity);

                            if (!isValid) {
                                console.warn(`Removing invalid keyframe from element ${element.id}:`, kf);
                                validationFailed = true;
                            }

                            return isValid;
                        });

                        // Fix any keyframes with missing properties
                        const fixedKeyframes = validKeyframes.map(kf => ({
                            time: kf.time,
                            position: {
                                x: kf.position?.x || 0,
                                y: kf.position?.y || 0
                            },
                            opacity: typeof kf.opacity === 'number' ? kf.opacity : 1,
                            scale: typeof kf.scale === 'number' ? kf.scale : 1
                        }));

                        element.keyframes = fixedKeyframes;

                        if (validKeyframes.length !== element.keyframes.length) {
                            console.log(`Fixed keyframes for element ${element.id}: ${validKeyframes.length} -> ${element.keyframes.length}`);
                        }
                    }
                });
            }

            if (validationFailed) {
                console.warn("Some invalid keyframes were removed or fixed before saving");
            }

            // Dump serialized data for direct inspection if there are keyframes
            if (initialKeframesCount > 0) {
                const serialized = JSON.stringify(projectToSave);
                console.log(`Serialized project size: ${serialized.length} characters`);
                console.log(`Sample of serialized data: ${serialized.substring(0, 200)}...`);

                // Check if keyframes are in the serialized data
                if (!serialized.includes('"keyframes":')) {
                    console.error("CRITICAL ERROR: Keyframes not found in serialized data!");
                }
            }

            // Final verification of keyframes count
            const finalKeframesCount = projectToSave.elements?.reduce((sum, el) => sum + (el.keyframes?.length || 0), 0) || 0;
            console.log(`Final project to save has ${finalKeframesCount} total keyframes`);

            if (finalKeframesCount < initialKeframesCount) {
                console.warn(`WARNING: Some keyframes were lost during processing (${initialKeframesCount} -> ${finalKeframesCount})`);
            }

            // Полное сохранение проекта
            try {
                console.log('Attempting full project save...');
                let response;

                if (project.id) {
                    // Update existing project
                    console.log('Updating existing project with ID:', project.id);
                    const token = localStorage.getItem('token');
                    response = await axios.put(`${API_URL}/projects/${project.id}`, projectToSave, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                } else {
                    // Create new project
                    console.log('Creating new project with data:', JSON.stringify(projectToSave).substring(0, 200) + '...');
                    const token = localStorage.getItem('token');
                    if (!token) {
                        throw new Error('No authentication token found. Please log in.');
                    }

                    // Ensure we have the required fields
                    const projectData = {
                        ...projectToSave,
                        name: projectToSave.name || 'Новый проект',
                        description: projectToSave.description || '',
                        duration: projectToSave.duration || 60,
                        elements: projectToSave.elements || [],
                        audioUrl: projectToSave.audioUrl || '',
                        videoUrl: projectToSave.videoUrl || '',
                        glbAnimations: projectToSave.glbAnimations || [],
                        isPrivate: true
                    };

                    console.log('Sending project data:', JSON.stringify(projectData, null, 2));

                    response = await axios.post(`${API_URL}/projects`, projectData, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                }

                console.log('Server response received:', response.status, response.statusText);
                console.log('RAW SERVER RESPONSE DATA:', JSON.stringify(response.data).substring(0, 300) + '...');

                // Examine elements structure
                const rawElements = response.data.elements;
                console.log('ELEMENTS DATA TYPE:', typeof rawElements);
                console.log('IS ARRAY:', Array.isArray(rawElements));
                if (rawElements) {
                    console.log('ELEMENTS COUNT:', rawElements.length);
                    console.log('FIRST ELEMENT SAMPLE:', JSON.stringify(rawElements[0]).substring(0, 100));
                } else {
                    console.log('ELEMENTS IS NULL OR UNDEFINED');
                }

                // Direct check for received keyframes in response
                console.log('*** KEYFRAME DIAGNOSTIC AFTER SAVE ***');
                if (response.data.elements) {
                    response.data.elements.forEach((el, index) => {
                        console.log(`Element ${index} in response: id=${el.id}, keyframes=${el.keyframes?.length || 0}`);
                        if (el.keyframes && el.keyframes.length > 0) {
                            console.log(`  First keyframe: ${JSON.stringify(el.keyframes[0])}`);
                        }
                    });
                }

                // Проверяем, что ключевые кадры вернулись от сервера, но только для существующих проектов
                const responseKeyframesCount = response.data.elements?.reduce(
                    (sum, el) => sum + (el.keyframes?.length || 0), 0
                ) || 0;

                console.log(`Server returned ${responseKeyframesCount} total keyframes`);

                if (project.id && responseKeyframesCount < finalKeframesCount) {
                    console.warn(`WARNING: Server returned fewer keyframes (${responseKeyframesCount}) than sent (${finalKeframesCount})`);

                    // **CRITICAL FIX**: If keyframes were lost, manually add them back from our original data
                    if (responseKeyframesCount === 0 && finalKeframesCount > 0) {
                        console.log("Attempting to manually restore keyframes to server response");

                        response.data.elements.forEach(element => {
                            // Find matching element in our project to save
                            const originalElement = projectToSave.elements.find(el => el.id === element.id);
                            if (originalElement && originalElement.keyframes && originalElement.keyframes.length > 0) {
                                console.log(`Restoring ${originalElement.keyframes.length} keyframes to element ${element.id}`);
                                element.keyframes = [...originalElement.keyframes];
                            }
                        });

                        // Recount after restoration
                        const restoredCount = response.data.elements?.reduce(
                            (sum, el) => sum + (el.keyframes?.length || 0), 0
                        ) || 0;

                        console.log(`Restored ${restoredCount} keyframes to response data`);
                    } else {
                        throw new Error('Keyframes were lost during save!');
                    }
                }

                // Непосредственно используем проект из ответа сервера
                console.log('Updating state with server response');

                // Ensure the response has a valid structure before setting the state
                const validatedResponse = {
                    ...response.data,
                    // Ensure elements is an array
                    elements: Array.isArray(response.data.elements) ? response.data.elements : []
                };

                // Check if server returned valid elements
                let hasValidElements = validatedResponse.elements.length > 0 &&
                    validatedResponse.elements[0] &&
                    validatedResponse.elements[0].id &&
                    validatedResponse.elements[0].type;

                if (!hasValidElements) {
                    console.warn('Server returned elements with missing properties, using original elements');

                    // Use elements from the project we just saved since server didn't return proper elements
                    validatedResponse.elements = projectToSave.elements.map(element => ({
                        ...element,
                        // Ensure deep cloning
                        position: { ...element.position },
                        size: { ...element.size },
                        style: { ...element.style },
                        keyframes: element.keyframes ? JSON.parse(JSON.stringify(element.keyframes)) : []
                    }));

                    console.log('Restored elements from client-side cache:', validatedResponse.elements.length);
                } else {
                    // Make sure each element has the required properties
                    validatedResponse.elements = validatedResponse.elements.map(element => ({
                        ...element,
                        // Ensure ID is preserved
                        id: element.id,
                        // Ensure type is preserved exactly as is
                        type: element.type,
                        // Ensure position exists
                        position: element.position || { x: 0, y: 0 },
                        // Ensure size exists
                        size: element.size || { width: 100, height: 100 },
                        // Ensure style exists
                        style: element.style || {
                            color: '#000000',
                            backgroundColor: 'transparent',
                            borderColor: '#000000',
                            borderWidth: 1,
                            opacity: 1,
                            zIndex: 0
                        },
                        // Ensure content is preserved
                        content: element.content,
                        // Ensure keyframes is an array
                        keyframes: Array.isArray(element.keyframes) ? element.keyframes : []
                    }));
                }

                // Cache the project data with valid elements
                if (validatedResponse.id && window.localStorage) {
                    try {
                        const cacheKey = `project-data-${validatedResponse.id}`;
                        const cacheData = {
                            id: validatedResponse.id,
                            elements: validatedResponse.elements
                        };
                        window.localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                        console.log(`Cached project data for ID ${validatedResponse.id} with ${validatedResponse.elements.length} elements`);
                    } catch (e) {
                        console.error('Error caching project data:', e);
                    }
                }

                setProject(validatedResponse);

                // Make project ID available for backup purposes
                window.currentProjectId = response.data.id;
                console.log(`Set window.currentProjectId to ${window.currentProjectId}`);

                showNotification(project.id ? 'Проект успешно сохранен' : 'Новый проект создан');
                setError(null);
            } catch (saveError) {
                console.error('Error during project save:', saveError);

                // Если проект существующий, пробуем восстановить его из резервной копии
                if (project.id) {
                    try {
                        // Пробуем загрузить резервную копию из localStorage
                        const backupKey = `project-keyframes-${project.id}`;
                        const backupData = localStorage.getItem(backupKey);

                        if (backupData) {
                            console.log('Attempting to restore project with backup keyframes');
                            const backupKeyframes = JSON.parse(backupData);

                            // Получаем проект с сервера заново
                            const token = localStorage.getItem('token');
                            if (!token) {
                                throw new Error('No authentication token found. Please log in.');
                            }
                            const refreshResponse = await axios.get(`${API_URL}/projects/${project.id}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            const refreshedProject = refreshResponse.data;

                            // Восстанавливаем ключевые кадры из резервной копии
                            if (refreshedProject.elements) {
                                refreshedProject.elements.forEach(element => {
                                    if (backupKeyframes[element.id]) {
                                        element.keyframes = backupKeyframes[element.id];
                                        console.log(`Restored ${element.keyframes.length} keyframes for element ${element.id} from backup`);
                                    }
                                });
                            }

                            // Обновляем состояние проекта с восстановленными ключевыми кадрами
                            setProject(refreshedProject);
                            showNotification('Проект загружен с резервной копией ключевых кадров из локального хранилища', 'warning');
                        } else {
                            throw new Error('No backup available in localStorage');
                        }
                    } catch (restoreError) {
                        console.error('Failed to restore from backup:', restoreError);
                        showNotification('Не удалось сохранить проект. Резервная копия недоступна.', 'error');
                    }
                } else {
                    // Детальная информация об ошибке для нового проекта
                    console.error('Ошибка создания нового проекта:', saveError);

                    // Показываем больше деталей об ошибке
                    let errorMessage = 'Не удалось создать новый проект.';

                    if (saveError.response) {
                        // Ошибка от сервера - получаем статус и сообщение
                        errorMessage += ` Статус: ${saveError.response.status}`;
                        if (saveError.response.data && saveError.response.data.message) {
                            errorMessage += `. Сообщение: ${saveError.response.data.message}`;
                        }
                    } else if (saveError.request) {
                        // Запрос отправлен, но ответ не получен
                        errorMessage += ' Сервер не ответил на запрос.';
                    } else {
                        // Ошибка в настройке запроса
                        errorMessage += ` Причина: ${saveError.message}`;
                    }

                    showNotification(errorMessage, 'error');
                }
            }
        } catch (err) {
            console.error('Error in handleSaveProject:', err);
            showNotification('Failed to save project. Please try again.', 'error');
        }
    };

    // Handle uploading audio
    const handleAudioUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(prev => ({ ...prev, audio: true }));

        const token = localStorage.getItem('token');
        axios.post(`${API_URL}/upload`, formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        })
            .then(response => {
                setProject(prev => ({
                    ...prev,
                    audioUrl: response.data.url
                }));

                showNotification('Аудио успешно загружено', 'success');
            })
            .catch(error => {
                console.error('Error uploading audio:', error);
                showNotification('Ошибка при загрузке аудио', 'error');
            })
            .finally(() => {
                setIsUploading(prev => ({ ...prev, audio: false }));
            });
    };

    // Handle video upload
    const handleVideoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log('Video upload started with file:', file.name, file.type, file.size);

        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(prev => ({ ...prev, video: true }));
        showNotification('Загрузка видео...', 'info');

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found');
            showNotification('Ошибка: Не найден токен авторизации', 'error');
            setIsUploading(prev => ({ ...prev, video: false }));
            return;
        }

        console.log('Sending video upload request to:', `${API_URL}/upload`);

        axios.post(`${API_URL}/upload`, formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        })
            .then(response => {
                console.log('Video upload successful, response:', response.data);

                if (!response.data || !response.data.url) {
                    console.error('Invalid response from server, missing URL');
                    showNotification('Ошибка: Неверный ответ сервера', 'error');
                    return;
                }

                // Update project with video URL
                setProject(prev => {
                    const updated = {
                        ...prev,
                        videoUrl: response.data.url
                    };
                    console.log('Updated project state with videoUrl:', updated.videoUrl);
                    return updated;
                });

                showNotification('Видео успешно загружено', 'success');
            })
            .catch(error => {
                console.error('Error uploading video:', error);

                if (error.response) {
                    console.error('Server response:', error.response.status, error.response.data);
                }

                showNotification(`Ошибка при загрузке видео: ${error.message}`, 'error');
            })
            .finally(() => {
                setIsUploading(prev => ({ ...prev, video: false }));
            });
    };

    // Handle uploading GLB animation files
    const handleGlbUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log('GLB upload started with file:', file.name, file.type, file.size);

        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(prev => ({ ...prev, glb: true }));
        showNotification('Загрузка GLB модели...', 'info');

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found');
            showNotification('Ошибка: Не найден токен авторизации', 'error');
            setIsUploading(prev => ({ ...prev, glb: false }));
            return;
        }

        axios.post(`${API_URL}/upload`, formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        })
            .then(response => {
                console.log('GLB upload successful, response:', response.data);
                console.log('GLB upload response type:', typeof response.data);
                console.log('GLB upload response structure:', Object.keys(response.data));

                if (!response.data || !response.data.url) {
                    console.error('Invalid response from server, missing URL');
                    console.error('Response data:', response.data);
                    showNotification('Ошибка: Неверный ответ сервера', 'error');
                    return;
                }

                // Проверка URL
                console.log('GLB upload URL from server:', response.data.url);
                console.log('GLB upload URL type:', typeof response.data.url);

                // Убедимся, что URL правильный
                const url = response.data.url.startsWith('http')
                    ? response.data.url
                    : `${API_URL}${response.data.url.startsWith('/') ? '' : '/'}${response.data.url}`;

                console.log('GLB upload processed URL:', url);

                const newGlbAnimation = {
                    id: `glb-${Date.now()}`,
                    url: url,
                    name: file.name,
                    description: ''
                };

                console.log('ConstructorPage: Creating new GLB animation:', newGlbAnimation);

                setProject(prev => {
                    const updatedProject = {
                        ...prev,
                        glbAnimations: [...(prev.glbAnimations || []), newGlbAnimation]
                    };
                    console.log('ConstructorPage: Updated project with GLB animations:', updatedProject.glbAnimations);
                    return updatedProject;
                });

                showNotification('GLB анимация успешно загружена. Теперь вы можете использовать её для объектов', 'success');
            })
            .catch(error => {
                console.error('Error uploading GLB animation:', error);

                if (error.response) {
                    console.error('Server response:', error.response.status, error.response.data);
                }

                showNotification(`Ошибка при загрузке GLB анимации: ${error.message}`, 'error');
            })
            .finally(() => {
                setIsUploading(prev => ({ ...prev, glb: false }));
            });
    };

    // Remove GLB animation
    const handleRemoveGlbAnimation = (id) => {
        setProject(prev => ({
            ...prev,
            glbAnimations: prev.glbAnimations.filter(anim => anim.id !== id)
        }));
    };

    // Handle project selection
    const handleSelectProject = async (projectId) => {
        if (!projectId) return;

        try {
            console.log('Fetching project data for ID:', projectId);

            // Получаем токен авторизации
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Не найден токен авторизации. Пожалуйста, войдите в систему снова.');
            }

            // Добавляем токен в заголовки запроса
            const response = await axios.get(`${API_URL}/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const fetchedProject = response.data;

            console.log('Fetched project:', fetchedProject);

            // Initialize elements array if it doesn't exist
            if (!fetchedProject.elements) {
                fetchedProject.elements = [];
            }

            // Ensure all elements have correct structure
            fetchedProject.elements = fetchedProject.elements.map(element => {
                // Set default values for animation if they don't exist
                if (!element.animation) {
                    element.animation = {
                        keyframes: []
                    };
                }

                // Обработка 3D моделей
                if (element.type === '3d' || element.modelUrl || element.modelPath) {
                    console.log(`Processing 3D model for element ${element.id}`);

                    // Убедимся, что у нас есть правильные пути к моделям
                    if (element.modelUrl) {
                        // Убедимся, что URL правильный
                        element.modelUrl = formatModelUrl(element.modelUrl);

                        // Убедимся, что modelPath и modelUrl синхронизированы
                        if (!element.modelPath) {
                            element.modelPath = element.modelUrl;
                        }
                    } else if (element.modelPath) {
                        // Если есть только modelPath, создаем modelUrl
                        element.modelPath = formatModelUrl(element.modelPath);
                        element.modelUrl = element.modelPath;
                    }

                    // Обработаем ключевые кадры, чтобы убедиться, что они тоже содержат ссылки на модели
                    if (element.keyframes && element.keyframes.length > 0) {
                        element.keyframes.forEach(keyframe => {
                            if (!keyframe.modelUrl && (element.modelUrl || element.modelPath)) {
                                keyframe.modelUrl = element.modelUrl || element.modelPath;
                                keyframe.modelPath = element.modelUrl || element.modelPath;
                            } else if (keyframe.modelUrl) {
                                keyframe.modelUrl = formatModelUrl(keyframe.modelUrl);
                                keyframe.modelPath = keyframe.modelUrl;
                            }
                        });
                    }
                }

                // For shapes, ensure they have all required properties
                if (element.type === 'shape') {
                    return {
                        ...element,
                        fill: element.fill || '#6A3AFF',
                        stroke: element.stroke || '#FFFFFF',
                        strokeWidth: element.strokeWidth || 0,
                        opacity: element.opacity !== undefined ? element.opacity : 1
                    };
                }

                return element;
            });

            // Обработка glbAnimations
            if (fetchedProject.glbAnimations && fetchedProject.glbAnimations.length > 0) {
                console.log('Processing glbAnimations:', fetchedProject.glbAnimations);
                fetchedProject.glbAnimations = fetchedProject.glbAnimations.map(animation => {
                    if (animation.url) {
                        animation.url = formatModelUrl(animation.url);
                    }
                    return animation;
                });
            }

            // Initialize duration if it doesn't exist
            if (!fetchedProject.duration) {
                fetchedProject.duration = 60; // Default 60 seconds
            }

            // Convert old style animations to new format if needed
            if (fetchedProject.elements.some(el => el.animation && Array.isArray(el.animation))) {
                console.log('Converting old animation format to new format');

                fetchedProject.elements = fetchedProject.elements.map(element => {
                    if (element.animation && Array.isArray(element.animation)) {
                        // Convert old format [{ time, properties }] to new format { keyframes: [{ time, properties }] }
                        return {
                            ...element,
                            animation: {
                                keyframes: element.animation
                            }
                        };
                    }
                    return element;
                });
            }

            // Ensure project has a glbAnimations array
            if (!fetchedProject.glbAnimations) {
                fetchedProject.glbAnimations = [];
            }

            // Set the loaded project to state
            setProject(fetchedProject);

            // Reset current state
            setCurrentTime(0);
            setSelectedElement(null);

            // Show notification
            setNotification({
                open: true,
                message: `Проект "${fetchedProject.name}" успешно загружен`,
                severity: 'success'
            });

            setShowProjectDialog(false);

        } catch (err) {
            console.error('Error fetching project:', err);

            let errorMessage = 'Ошибка при загрузке проекта';

            if (err.response && err.response.status === 401) {
                errorMessage = 'Ошибка авторизации. Пожалуйста, войдите в систему снова.';
            } else if (err.message) {
                errorMessage += `: ${err.message}`;
            }

            setError('Failed to load project');

            setNotification({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        }
    };

    // Функция для правильного форматирования URL модели
    const formatModelUrl = (url) => {
        if (!url) return url;

        // Если URL начинается с http или https, оставляем как есть
        if (url.startsWith('http')) {
            return url;
        }

        // Если URL не начинается со слеша, добавляем его
        const formattedUrl = url.startsWith('/') ? url : `/${url}`;

        // Добавляем базовый API URL, если URL относительный
        return `${API_URL}${formattedUrl}`;
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

    // Add this function to the ConstructorPage component
    const handleDebugKeyframes = async () => {
        try {
            console.log('*** MANUAL KEYFRAME DIAGNOSTIC ***');

            // Check current state of keyframes
            const totalKeyframes = project.elements?.reduce((sum, el) => sum + (el.keyframes?.length || 0), 0) || 0;
            console.log(`Current project has ${totalKeyframes} keyframes across ${project.elements?.length || 0} elements`);

            // Element-by-element keyframe analysis
            if (project.elements && project.elements.length > 0) {
                project.elements.forEach((el, index) => {
                    console.log(`Element ${index}: id=${el.id}, type=${el.type}, keyframes=${el.keyframes?.length || 0}`);

                    if (!el.keyframes) {
                        console.error(`  Element ${el.id} missing keyframes property`);
                    } else if (!Array.isArray(el.keyframes)) {
                        console.error(`  Element ${el.id} has non-array keyframes: ${typeof el.keyframes}`);
                    } else if (el.keyframes.length > 0) {
                        // Log first keyframe for inspection
                        console.log(`  First keyframe: ${JSON.stringify(el.keyframes[0])}`);

                        // Check for invalid values
                        el.keyframes.forEach((kf, kfIdx) => {
                            if (!kf || typeof kf !== 'object') {
                                console.error(`  Invalid keyframe at index ${kfIdx}: not an object`);
                            } else if (
                                isNaN(kf.time) ||
                                !kf.position ||
                                isNaN(kf.position.x) ||
                                isNaN(kf.position.y) ||
                                isNaN(kf.opacity)
                            ) {
                                console.error(`  Invalid keyframe at index ${kfIdx}:`, kf);
                            }
                        });
                    }
                });
            }

            // Check localStorage for backups
            if (project.id) {
                const backupKey = `project-keyframes-${project.id}`;
                const backupData = localStorage.getItem(backupKey);

                if (backupData) {
                    try {
                        const backup = JSON.parse(backupData);
                        const backupElements = Object.keys(backup).length;
                        const backupKeyframes = Object.values(backup).reduce((sum, arr) => sum + arr.length, 0);
                        console.log(`Found localStorage backup with ${backupKeyframes} keyframes for ${backupElements} elements`);
                    } catch (err) {
                        console.error('Error parsing backup:', err);
                    }
                } else {
                    console.log('No localStorage backup found');
                }
            }

            // If project exists, fetch raw data from server
            if (project.id) {
                try {
                    // Log the API URL and full debug URL for troubleshooting
                    console.log(`Base API URL: ${API_URL}`);
                    const debugUrl = `${API_URL}/projects/${project.id}/debug`;
                    console.log(`Attempting to fetch debug info from: ${debugUrl}`);

                    // Make the request with detailed error handling
                    console.log('Sending debug request to server...');
                    const response = await axios.get(debugUrl);

                    if (!response) {
                        throw new Error('No response received from server');
                    }

                    console.log(`Server response status: ${response.status}`);
                    const debugData = response.data;

                    // Analyze the server's debug data
                    console.log('Server debug info received:', debugData);

                    // Check if keyframesJson exists on the server
                    const hasKeyframesJson = debugData.hasKeyframesJson ||
                        (debugData.validation && debugData.validation.hasKeyframesJson) ||
                        (debugData.rawProject && debugData.rawProject.keyframesJson);

                    console.log(`Server has keyframesJson: ${hasKeyframesJson}`);

                    // Check if keyframes were properly parsed
                    if (debugData.keyframeData) {
                        console.log(`Server parsed ${debugData.keyframeData.totalKeyframes} keyframes for ${debugData.keyframeData.elementCount} elements`);

                        // Element-by-element comparison if available
                        if (debugData.elements && debugData.elements.length > 0) {
                            console.log('Server element-by-element breakdown:');
                            debugData.elements.forEach(el => {
                                console.log(`  Server element ${el.elementId}: ${el.keyframeCount} keyframes`);
                            });
                        }
                    } else if (debugData.validation) {
                        console.log(`Server validation info: ${JSON.stringify(debugData.validation)}`);
                    }

                    // Check localStorage info if available
                    if (debugData.localStorage) {
                        if (debugData.localStorage.exists) {
                            console.log(`Server has localStorage backup with ${debugData.localStorage.totalKeyframes || '?'} keyframes`);
                        } else {
                            console.log('Server does not have a localStorage backup');
                        }
                    }

                    // Show debug info to user with more details
                    let alertMessage = `Диагностика: Проект имеет ${totalKeyframes} ключевых кадров на клиенте.`;
                    if (debugData.keyframeData && debugData.keyframeData.totalKeyframes) {
                        alertMessage += ` На сервере: ${debugData.keyframeData.totalKeyframes} кадров.`;
                    }
                    alertMessage += ' Подробная информация выведена в консоль.';

                    showNotification(alertMessage);
                } catch (err) {
                    console.error('Error fetching debug info:', err);

                    // More detailed error reporting
                    let errorDetails = '';
                    if (err.response) {
                        // Server responded with non-2xx status
                        errorDetails = `Status: ${err.response.status}`;
                        if (err.response.data) {
                            errorDetails += `, Message: ${JSON.stringify(err.response.data)}`;
                        }
                    } else if (err.request) {
                        // Request was made but no response received
                        errorDetails = 'No response received from server (timeout or CORS issue)';
                    } else {
                        // Error in setting up the request
                        errorDetails = err.message;
                    }

                    console.error(`Debug request error details: ${errorDetails}`);
                    showNotification(`Диагностика: Проект имеет ${totalKeyframes} ключевых кадров. Ошибка получения данных с сервера: ${err.message}. Проверьте консоль для подробностей.`);
                }
            } else {
                showNotification(`Диагностика: Новый проект с ${totalKeyframes} ключевыми кадрами. Сохраните проект для проверки на сервере.`);
            }
        } catch (err) {
            console.error('Error in keyframe diagnostic:', err);
            showNotification('Ошибка при выполнении диагностики. См. консоль для деталей.');
        }
    };

    // Make project ID available on mount/unmount
    useEffect(() => {
        // Set project ID when available
        if (project.id) {
            window.currentProjectId = project.id;
            console.log(`Set window.currentProjectId to ${window.currentProjectId}`);
        }

        // Clean up on unmount
        return () => {
            window.currentProjectId = null;
        };
    }, [project.id]);

    // Add this function to the ConstructorPage component
    const handleTestSaveKeyframes = async () => {
        try {
            if (!selectedElement) {
                alert('Выберите элемент сначала');
                return;
            }

            const projectId = project.id;
            const elementId = selectedElement.id;
            const keyframes = selectedElement.keyframes;
            console.log("Selected element:", selectedElement);
            console.log("Sending direct save with:");
            console.log("- Project ID:", projectId);
            console.log("- Element ID:", elementId);
            console.log("- Keyframes:", keyframes);

            // Use fetch for the request
            const response = await fetch('/api/test/test-save-keyframes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectId,
                    elementId,
                    keyframes: keyframes || []
                }),
            });

            // Check if the response was successful
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error saving keyframes:', errorData);
                showNotification(`Ошибка при сохранении: ${errorData.message || response.statusText}`);
                return;
            }

            const data = await response.json();
            console.log('Save result:', data);
            showNotification(`Сохранено успешно! Длина JSON: ${data.keyframesJsonLength} символов`);
        } catch (error) {
            console.error('Error in handleTestSaveKeyframes:', error);
            showNotification(`Ошибка: ${error.message}`);
        }
    };

    // Handle when animations are saved from the ModelViewer
    const handleSaveAnimations = (animations, modelUrl) => {
        if (!selectedElement) return;

        console.log('Saving animations from ModelViewer:', animations);
        console.log('Model URL:', modelUrl);

        const updatedElement = {
            ...selectedElement,
            modelUrl: modelUrl,
            modelPath: modelUrl,
            animations: animations
        };

        handleElementUpdate(updatedElement);
    };

    // Обработчик создания нового проекта
    const handleCreateNewProject = (projectDetails = null) => {
        console.log('Creating new project with details:', projectDetails);

        setProject({
            id: null,
            name: projectDetails?.name || 'Новый проект',
            description: projectDetails?.description || '',
            duration: 60,
            audioUrl: '',
            videoUrl: '',
            elements: [],
            glbAnimations: []
        });

        setShowProjectDialog(false);
    };

    // Обработчик обновления информации о проекте
    const handleUpdateProjectInfo = () => {
        setIsEditingProjectInfo(false);

        // Если проект уже сохранен на сервере, обновляем его
        if (project.id) {
            handleSaveProject();
        }
    };

    // Добавлю новые функции для удаления аудио и видео

    // Handle removing audio
    const handleRemoveAudio = () => {
        setProject(prev => ({
            ...prev,
            audioUrl: ''
        }));
        showNotification('Аудио удалено', 'success');
    };

    // Handle removing video
    const handleRemoveVideo = () => {
        setProject(prev => ({
            ...prev,
            videoUrl: ''
        }));
        showNotification('Видео удалено', 'success');
    };

    // В существующем коде переделаю область отображения аудио/видео, добавив кнопки удаления

    // Ищем Box отображения аудио и видео и изменяем его, добавляя кнопки удаления

    // Изменим отображение в компоненте Player, добавив кнопку удаления аудио 
    // (находим Player в JSX и модифицируем эту область)

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
            <Navbar />

            {/* Project Dialog */}
            <ProjectDialog
                open={showProjectDialog}
                onClose={() => setShowProjectDialog(false)}
                onCreateNew={handleCreateNewProject}
                onSelectProject={handleSelectProject}
                createNewWithDetails={true}
            />

            {/* Main Content */}
            <Container maxWidth="xl" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', py: 2 }}>
                {/* Project Info and Controls */}
                <StyledPaper sx={{
                    mb: 2,
                    p: 2,
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
                        {isEditingProjectInfo ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
                                <TextField
                                    fullWidth
                                    label="Название проекта"
                                    value={project.name}
                                    onChange={(e) => setProject({ ...project, name: e.target.value })}
                                    variant="outlined"
                                    size="small"
                                />
                                <TextField
                                    fullWidth
                                    label="Описание"
                                    value={project.description}
                                    onChange={(e) => setProject({ ...project, description: e.target.value })}
                                    variant="outlined"
                                    size="small"
                                    multiline
                                    rows={2}
                                />
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => setIsEditingProjectInfo(false)}
                                    >
                                        Отмена
                                    </Button>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        onClick={handleUpdateProjectInfo}
                                    >
                                        Сохранить
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            <>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="h5" component="h1" fontWeight="bold" sx={{ mb: 0.5 }}>
                                        {project.name || 'Новый проект'}
                                    </Typography>
                                    {project.description && (
                                        <Typography variant="body2" color="text.secondary">
                                            {project.description}
                                        </Typography>
                                    )}
                                </Box>
                                <IconButton
                                    onClick={() => setIsEditingProjectInfo(true)}
                                    size="small"
                                    sx={{ color: 'primary.main' }}
                                >
                                    <Edit />
                                </IconButton>
                            </>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-end' } }}>
                        <StyledButton
                            variant="outlined"
                            startIcon={<FolderOpen />}
                            onClick={() => setShowProjects(true)}
                        >
                            Открыть
                        </StyledButton>
                        <StyledButton
                            variant="contained"
                            startIcon={<Save />}
                            onClick={handleSaveProject}
                        >
                            Сохранить
                        </StyledButton>
                    </Box>
                </StyledPaper>

                {/* Project list (conditionally shown) */}
                {showProjects && (
                    <ProjectsList
                        onSelectProject={handleSelectProject}
                        setShowProjects={setShowProjects}
                    />
                )}

                {/* Audio player */}
                <Grid item xs={12}>
                    <StyledPaper sx={{ mb: 2 }}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 2,
                            flexWrap: 'wrap',
                            gap: 2
                        }}>
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
                                            Длительность: {project.duration} сек
                                        </Typography>
                                    )}
                                </Box>
                            )}

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {/* View mode toggle buttons */}
                                <ButtonGroup variant="outlined" size="small">
                                    <Button
                                        onClick={() => setViewMode('2d')}
                                        variant={viewMode === '2d' ? 'contained' : 'outlined'}
                                        sx={{
                                            borderColor: theme.palette.mode === 'dark' ? 'rgba(30, 144, 255, 0.3)' : undefined,
                                            backgroundColor: viewMode === '2d' ? (theme.palette.mode === 'dark' ? 'rgba(30, 144, 255, 0.2)' : undefined) : undefined,
                                            '&.Mui-selected': {
                                                backgroundColor: COLORS.secondary
                                            }
                                        }}
                                    >
                                        2D
                                    </Button>
                                    <Button
                                        onClick={() => setViewMode('video')}
                                        variant={viewMode === 'video' ? 'contained' : 'outlined'}
                                        sx={{
                                            borderColor: theme.palette.mode === 'dark' ? 'rgba(30, 144, 255, 0.3)' : undefined,
                                            backgroundColor: viewMode === 'video' ? (theme.palette.mode === 'dark' ? 'rgba(30, 144, 255, 0.2)' : undefined) : undefined,
                                            '&.Mui-selected': {
                                                backgroundColor: COLORS.secondary
                                            }
                                        }}
                                    >
                                        Видео
                                    </Button>
                                </ButtonGroup>

                                {!project.audioUrl && (
                                    <StyledButton
                                        variant="outlined"
                                        component="label"
                                        startIcon={<UploadIcon />}
                                        size="small"
                                        sx={{
                                            borderColor: theme.palette.mode === 'dark' ? 'rgba(30, 144, 255, 0.3)' : undefined,
                                            color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : undefined
                                        }}
                                    >
                                        Загрузить аудио
                                        <input
                                            type="file"
                                            accept="audio/*"
                                            hidden
                                            onChange={handleAudioUpload}
                                        />
                                    </StyledButton>
                                )}

                                <StyledButton
                                    variant="outlined"
                                    component="label"
                                    startIcon={<CloudUpload />}
                                    size="small"
                                    sx={{
                                        borderColor: theme.palette.mode === 'dark' ? 'rgba(30, 144, 255, 0.3)' : undefined,
                                        color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : undefined
                                    }}
                                >
                                    Загрузить видео
                                    <input
                                        type="file"
                                        accept="video/*"
                                        hidden
                                        onChange={handleVideoUpload}
                                    />
                                </StyledButton>
                            </Box>
                        </Box>

                        <Player
                            audioUrl={project.audioUrl}
                            videoUrl={project.videoUrl}
                            duration={project.duration}
                            currentTime={currentTime}
                            onTimeUpdate={handleTimeUpdate}
                            isPlaying={isPlaying}
                            onPlayPause={handlePlayPause}
                            keyframeRecording={isRecordingKeyframes}
                            toggleKeyframeRecording={toggleKeyframeRecording}
                            onRemoveAudio={handleRemoveAudio}
                            onRemoveVideo={handleRemoveVideo}
                        />
                    </StyledPaper>
                </Grid>

                {/* Wrap Canvas and Side panels in Grid container */}
                <Grid container spacing={2}>
                    {/* Canvas and tools */}
                    <Grid item xs={12} md={9}>
                        {/* Canvas controls */}
                        <Box sx={{
                            mb: 1,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                        }}>
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
                                        sx={{ color: COLORS.secondary }}
                                        aria-label="copy"
                                        onClick={handleOpenCopyMenu}
                                        title="Копировать свойства"
                                    >
                                        <ContentCopy />
                                    </IconButton>

                                    <Menu
                                        anchorEl={copyMenuAnchorEl}
                                        open={Boolean(copyMenuAnchorEl)}
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
                                            sx={{
                                                mr: 1,
                                                color: COLORS.secondary,
                                                borderColor: 'rgba(30, 144, 255, 0.3)'
                                            }}
                                            variant="outlined"
                                        >
                                            Вставить стиль
                                        </Button>
                                    )}

                                    {canPasteAnimations && (
                                        <Button
                                            size="small"
                                            onClick={handlePasteElementAnimations}
                                            sx={{
                                                color: COLORS.tertiary,
                                                borderColor: 'rgba(64, 224, 208, 0.3)'
                                            }}
                                            variant="outlined"
                                        >
                                            Вставить анимацию
                                        </Button>
                                    )}
                                </>
                            )}
                        </Box>

                        {/* Canvas */}
                        <StyledPaper sx={{
                            position: 'relative',
                            overflow: 'visible', // Allow content to overflow
                            height: 'calc(100vh - 300px)',
                            minHeight: '600px',
                            p: 0,
                            '&:hover': {
                                boxShadow: theme.palette.mode === 'dark'
                                    ? '0 12px 28px 0 rgba(0, 0, 0, 0.4)'
                                    : '0 12px 28px 0 rgba(0, 0, 0, 0.15)',
                            }
                        }}>
                            <Box
                                sx={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%',
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
                                    backgroundSize: '20px 20px',
                                    borderRadius: 1,
                                    overflow: 'visible' // Allow content to overflow
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                            >
                                {/* Show different content based on view mode */}
                                {viewMode === '2d' && (
                                    <Canvas
                                        elements={project.elements}
                                        onElementsChange={handleElementsUpdate}
                                        onElementSelect={handleElementSelect}
                                        selectedElement={selectedElement}
                                        currentTime={currentTime}
                                        isPlaying={isPlaying}
                                        isRecordingKeyframes={isRecordingKeyframes}
                                        project={project}
                                        onToggleRecording={toggleKeyframeRecording}
                                    />
                                )}

                                {viewMode === 'video' && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(32, 38, 52, 0.95)' : 'rgba(240, 245, 255, 0.98)',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        zIndex: 100,
                                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)'
                                    }}>
                                        {/* Video header with close button */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 2,
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: 'rgba(26, 32, 46, 0.95)'
                                        }}>
                                            <Typography variant="h6" sx={{
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>
                                                <VideoLibrary sx={{ mr: 1, color: COLORS.secondary }} />
                                                Видео
                                            </Typography>
                                        </Box>

                                        {/* Video content */}
                                        <Box sx={{ height: 'calc(100% - 60px)' }}>
                                            <VideoViewer
                                                isVisible={true}
                                                embedded={true}
                                                videoUrl={project.videoUrl}
                                                onClose={() => setProject(prev => ({ ...prev, videoUrl: '' }))}
                                            />
                                        </Box>
                                    </Box>
                                )}

                                {viewMode === '3d' && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(32, 38, 52, 0.95)' : 'rgba(240, 245, 255, 0.98)',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        zIndex: 100,
                                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)'
                                    }}>
                                        {/* 3D header with close button */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 2,
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: 'rgba(26, 32, 46, 0.95)'
                                        }}>
                                            <Typography variant="h6" sx={{
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>
                                                <ThreeDRotation sx={{ mr: 1, color: COLORS.tertiary }} />
                                                3D Модель
                                            </Typography>
                                        </Box>

                                        {/* 3D content */}
                                        <Box sx={{ height: 'calc(100% - 60px)' }}>
                                            <ModelViewer
                                                isVisible={true}
                                                embedded={true}
                                                onClose={() => setViewMode('2d')}
                                                playerDuration={project.duration}
                                                currentTime={currentTime}
                                                isPlaying={isPlaying}
                                                onTimeUpdate={time => setCurrentTime(time)}
                                                elementKeyframes={selectedElement?.keyframes}
                                                elementId={selectedElement?.id}
                                                onSaveAnimations={handleSaveAnimations}
                                                glbAnimationUrl={selectedElement?.modelUrl}
                                            />
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </StyledPaper>
                    </Grid>

                    {/* Side panels */}
                    <Grid item xs={12} md={3}>
                        <StyledPaper sx={{ height: '100%', p: 0, overflow: 'hidden' }}>
                            <Tabs
                                value={tabIndex}
                                onChange={(_, newValue) => setTabIndex(newValue)}
                                variant="fullWidth"
                                sx={{
                                    borderBottom: 1,
                                    borderColor: theme.palette.mode === 'dark'
                                        ? 'rgba(30, 144, 255, 0.15)'
                                        : 'rgba(30, 144, 255, 0.1)',
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? 'rgba(26, 32, 46, 0.95)' // Darker blue for contrast
                                        : 'rgba(240, 245, 255, 0.95)'
                                }}
                                TabIndicatorProps={{
                                    style: {
                                        backgroundColor: theme.palette.mode === 'dark'
                                            ? COLORS.secondary
                                            : COLORS.secondary,
                                        height: 3,
                                        borderRadius: '3px 3px 0 0'
                                    }
                                }}
                            >
                                <StyledTab label="Инструменты" />
                                <StyledTab label="Свойства" />
                            </Tabs>

                            <Box sx={{ p: 0, height: 'calc(600px - 48px)', overflow: 'auto' }}>
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
                        </StyledPaper>
                    </Grid>
                </Grid>

                {/* Custom notification */}
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
            </Container>
        </Box>
    );
};

export default ConstructorPage; 