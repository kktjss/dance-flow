import React, { useState, useEffect } from 'react';
import { Box, Button, Container, Grid, Paper, Tab, Tabs, Typography, IconButton, TextField, InputAdornment, Menu, MenuItem, Snackbar, Alert } from '@mui/material';
import { Save, FolderOpen, Upload as UploadIcon, AccessTime, ContentCopy } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

// Import components
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import ToolPanel from '../components/ToolPanel';
import PropertyPanel from '../components/PropertyPanel';
import ProjectsList from '../components/ProjectsList';
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
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

    const navigate = useNavigate();
    const params = useParams();

    // Загружаем проект при монтировании, если есть projectId в URL
    useEffect(() => {
        const projectId = params.projectId;
        if (projectId && !project._id) {
            console.log('Loading project from URL parameter:', projectId);
            handleSelectProject(projectId);
        }
    }, [params.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Handle element update
    const handleElementUpdate = (updatedElement) => {
        setProject(prev => ({
            ...prev,
            elements: prev.elements.map(elem =>
                elem.id === updatedElement.id ? updatedElement : elem
            )
        }));

        // Update selected element if it's the one being updated
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
            const debugUrl = `${API_URL}/projects/${project._id || 'test-project'}/debug`;
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
            if (!project._id) {
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
            const directUrl = `${API_URL}/projects/${project._id}/direct-keyframes`;
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
                    if (project._id) {
                        const backupKey = `project-keyframes-${project._id}`;
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

                if (project._id) {
                    // Update existing project
                    console.log('Updating existing project with ID:', project._id);
                    const token = localStorage.getItem('token');
                    response = await axios.put(`${API_URL}/projects/${project._id}`, projectToSave, {
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

                if (project._id && responseKeyframesCount < finalKeframesCount) {
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
                console.log('Updating state with project from server response');
                setProject(response.data);

                // Make project ID available for backup purposes
                window.currentProjectId = response.data._id;
                console.log(`Set window.currentProjectId to ${window.currentProjectId}`);

                showNotification(project._id ? 'Проект успешно сохранен' : 'Новый проект создан');
                setError(null);
            } catch (saveError) {
                console.error('Error during project save:', saveError);

                // Если проект существующий, пробуем восстановить его из резервной копии
                if (project._id) {
                    try {
                        // Пробуем загрузить резервную копию из localStorage
                        const backupKey = `project-keyframes-${project._id}`;
                        const backupData = localStorage.getItem(backupKey);

                        if (backupData) {
                            console.log('Attempting to restore project with backup keyframes');
                            const backupKeyframes = JSON.parse(backupData);

                            // Получаем проект с сервера заново
                            const token = localStorage.getItem('token');
                            if (!token) {
                                throw new Error('No authentication token found. Please log in.');
                            }
                            const refreshResponse = await axios.get(`${API_URL}/projects/${project._id}`, {
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

        // For now, we'll use a local URL
        // In a real app, you'd upload to a server and get a URL
        const audioUrl = URL.createObjectURL(file);
        setProject(prev => ({ ...prev, audioUrl }));
    };

    // Handle project selection
    const handleSelectProject = async (projectId) => {
        try {
            setError(null); // Очищаем ошибки перед загрузкой
            console.log('Loading project with ID:', projectId);

            // Показываем, что идет загрузка и обновляем URL
            console.log('Setting temporary loading state...');
            setProject(prev => ({ ...prev, _id: projectId, elements: [], loading: true }));

            console.log('Sending request to server...');
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found. Please log in.');
            }
            const response = await axios.get(`${API_URL}/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Got response from server:', response.status);

            if (!response || !response.data) {
                console.error('Response or response.data is null or undefined');
                throw new Error('No project data returned');
            }

            console.log('Raw server response data:', JSON.stringify(response.data).substring(0, 200) + '...');

            // Critical diagnostic: Get detailed project info
            console.log('*** KEYFRAME DIAGNOSTIC AFTER LOAD ***');
            if (response.data.elements) {
                response.data.elements.forEach((el, index) => {
                    console.log(`Element ${index} in response: id=${el.id}, type=${el.type}, keyframes=${el.keyframes?.length || 0}`);

                    // Check received keyframes
                    if (el.keyframes && el.keyframes.length > 0) {
                        console.log(`  First keyframe: ${JSON.stringify(el.keyframes[0])}`);
                    } else if (!el.keyframes) {
                        console.error(`  ERROR: Element ${el.id} is missing keyframes property`);
                        // Create keyframes array if missing
                        el.keyframes = [];
                    }
                });
            }

            // Проверяем, что в ответе есть массив elements
            if (!response.data.elements) {
                console.warn('Server returned project without elements array, initializing empty array');
                response.data.elements = [];
            }

            // Проверяем, что у каждого элемента есть массив keyframes
            if (response.data.elements && response.data.elements.length > 0) {
                console.log(`Found ${response.data.elements.length} elements in response:`);
                response.data.elements.forEach((element, index) => {
                    console.log(`Element ${index}: id=${element.id}, type=${element.type}`);
                    if (!element.keyframes) {
                        console.warn(`Element ${element.id} has no keyframes array, initializing empty array`);
                        element.keyframes = [];
                    }

                    // Проверяем, что у элемента есть все необходимые поля
                    if (!element.position || !element.position.x || !element.position.y) {
                        console.warn(`Element ${element.id} has invalid position data, initializing`);
                        element.position = element.position || {};
                        element.position.x = element.position.x || 0;
                        element.position.y = element.position.y || 0;
                    }

                    if (!element.size || !element.size.width || !element.size.height) {
                        console.warn(`Element ${element.id} has invalid size data, initializing`);
                        element.size = element.size || {};
                        element.size.width = element.size.width || 100;
                        element.size.height = element.size.height || 100;
                    }

                    if (!element.style) {
                        console.warn(`Element ${element.id} has no style data, initializing`);
                        element.style = {
                            color: '#000000',
                            backgroundColor: 'transparent',
                            borderColor: '#000000',
                            borderWidth: 1,
                            opacity: 1,
                            zIndex: 0
                        };
                    }
                });
            } else {
                console.warn('Server returned project without elements or empty elements array');
                response.data.elements = [];
            }

            // Проверка наличия ключевых кадров
            const serverKeyframesCount = response.data.elements?.reduce(
                (sum, el) => sum + (el.keyframes?.length || 0), 0
            ) || 0;

            console.log(`Server returned project with ${serverKeyframesCount} keyframes across ${response.data.elements.length} elements`);

            // Загружаем проект с сервера
            const loadedProject = response.data;

            // Проверяем наличие резервной копии ключевых кадров
            try {
                const backupKey = `project-keyframes-${projectId}`;
                const backupData = localStorage.getItem(backupKey);

                if (backupData) {
                    const backupKeyframes = JSON.parse(backupData);
                    let restoredCount = 0;

                    // Если у нас мало или нет ключевых кадров с сервера, восстанавливаем из резервной копии
                    if (serverKeyframesCount < 10 && loadedProject.elements) {
                        loadedProject.elements.forEach(element => {
                            if (backupKeyframes[element.id] && backupKeyframes[element.id].length > 0) {
                                // Если элемент не имеет ключевых кадров или имеет меньше, чем в резервной копии
                                if (!element.keyframes || element.keyframes.length < backupKeyframes[element.id].length) {
                                    element.keyframes = backupKeyframes[element.id];
                                    console.log(`Restored ${element.keyframes.length} keyframes for element ${element.id} from local backup`);
                                    restoredCount += element.keyframes.length;
                                }
                            }
                        });

                        if (restoredCount > 0) {
                            console.log(`Restored total of ${restoredCount} keyframes from local storage backup`);
                            showNotification(`Внимание: ${restoredCount} ключевых кадров восстановлено из локального хранилища`);
                        }
                    }
                }
            } catch (backupError) {
                console.warn('Failed to check/restore keyframes backup:', backupError);
            }

            // Обновляем данные приложения
            console.log('Updating project state with processed data...');
            setProject(loadedProject);

            // Очищаем выбранный элемент
            setSelectedElement(null);

            // Обновляем URL
            try {
                console.log('Navigating to constructor route...');
                navigate(`/constructor/${projectId}`);
                console.log('Navigation completed');
            } catch (navError) {
                console.error('Navigation error:', navError);
                // Продолжаем выполнение даже при ошибке навигации
            }

            // Make project ID available for backup purposes
            window.currentProjectId = projectId;
            console.log(`Set window.currentProjectId to ${window.currentProjectId}`);

            console.log('Project loading successfully completed');
        } catch (err) {
            console.error('Error loading project:', err);
            if (err.response) {
                console.error('Server error response:', err.response.status, err.response.data);
            }
            // Возвращаем пустой проект в случае ошибки
            setProject({
                _id: null,
                name: 'Новый проект',
                description: '',
                duration: 60,
                audioUrl: null,
                elements: []
            });
            showNotification(`Не удалось загрузить проект. ${err.message}`);
            // Reset project ID if there was an error
            window.currentProjectId = null;
        }
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
            if (project._id) {
                const backupKey = `project-keyframes-${project._id}`;
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
            if (project._id) {
                try {
                    // Log the API URL and full debug URL for troubleshooting
                    console.log(`Base API URL: ${API_URL}`);
                    const debugUrl = `${API_URL}/projects/${project._id}/debug`;
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
        if (project._id) {
            window.currentProjectId = project._id;
            console.log(`Set window.currentProjectId to ${window.currentProjectId}`);
        }

        // Clean up on unmount
        return () => {
            window.currentProjectId = null;
        };
    }, [project._id]);

    // Add this function to the ConstructorPage component
    const handleTestSaveKeyframes = async () => {
        try {
            if (!selectedElement) {
                alert('Выберите элемент сначала');
                return;
            }

            const projectId = project._id;
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
                        sx={{ mr: 1 }}
                    >
                        {showProjects ? 'Скрыть проекты' : 'Открыть проект'}
                    </Button>

                    {/* Debug buttons - commented out after successful testing
                    <Button
                        variant="outlined"
                        color="info"
                        onClick={handleDebugKeyframes}
                        size="small"
                    >
                        Диагностика
                    </Button>

                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={handleTestSave}
                        size="small"
                        sx={{ ml: 1 }}
                    >
                        Тест сохранения
                    </Button>

                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => {
                            console.log('*** DIRECT KEYFRAME SAVE - INLINE IMPLEMENTATION ***');

                            if (!project._id) {
                                showNotification('Необходимо сначала сохранить проект!', 'warning');
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
                                            keyframes: JSON.parse(JSON.stringify(element.keyframes))
                                        });
                                    }
                                }
                            }

                            if (elementsWithKeyframes.length === 0) {
                                showNotification('Не найдены ключевые кадры для сохранения!', 'warning');
                                return;
                            }

                            // Select the element with the most keyframes
                            const targetElement = elementsWithKeyframes.reduce(
                                (max, current) => current.keyframesCount > max.keyframesCount ? current : max,
                                elementsWithKeyframes[0]
                            );

                            console.log(`Selected element ${targetElement.id} with ${targetElement.keyframesCount} keyframes`);

                            // Send direct update request
                            const directUrl = `${API_URL}/projects/${project._id}/direct-keyframes`;
                            console.log(`Full URL for direct save: ${directUrl}`);

                            const updateData = {
                                elementId: targetElement.id,
                                keyframes: targetElement.keyframes
                            };

                            console.log('Data payload size:', JSON.stringify(updateData).length);

                            // Alternate approach with fetch instead of axios
                            fetch(directUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(updateData)
                            })
                                .then(response => {
                                    console.log('Response status:', response.status);
                                    if (!response.ok) {
                                        return response.text().then(text => {
                                            throw new Error(`Status ${response.status}: ${text}`);
                                        });
                                    }
                                    return response.json();
                                })
                                .then(data => {
                                    console.log('Success:', data);
                                    showNotification(`Прямое сохранение успешно!\n- Элемент: ${targetElement.id}\n- Сохранено ${targetElement.keyframesCount} ключевых кадров`);
                                })
                                .catch(error => {
                                    console.error('Error in fetch:', error);
                                    showNotification(`Ошибка: ${error.message}`, 'error');
                                });
                        }}
                        size="small"
                        sx={{ ml: 1 }}
                    >
                        Прямое сохранение
                    </Button>

                    <Button
                        variant="outlined"
                        color="error"
                        onClick={handleTestSaveKeyframes}
                        size="small"
                        sx={{ ml: 1 }}
                    >
                        Тест API
                    </Button>
                    */}
                </Box>
            </Box>

            {/* Main content */}
            <Grid container spacing={2}>
                {/* Project list (conditionally shown) */}
                {showProjects && (
                    <Grid item xs={12}>
                        <ProjectsList
                            onSelectProject={handleSelectProject}
                            setShowProjects={setShowProjects}
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
                            overflow: 'hidden',
                            height: 'calc(100vh - 300px)', // Adjust for header, player, and other UI elements
                            minHeight: '600px'
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
    );
};

export default ConstructorPage; 