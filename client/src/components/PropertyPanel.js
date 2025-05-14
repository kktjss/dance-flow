import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Slider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Chip,
    LinearProgress,
    Alert,
} from '@mui/material';
import { ExpandMore, Delete, AccessTime, ThreeDRotation } from '@mui/icons-material';

const PropertyPanel = ({ selectedElement, onElementUpdate, currentTime }) => {
    const [properties, setProperties] = useState(null);

    // Update the local state when the selected element changes
    useEffect(() => {
        if (selectedElement) {
            setProperties(selectedElement);
        } else {
            setProperties(null);
        }
    }, [selectedElement]);

    // If no element is selected, show a message
    if (!properties) {
        return (
            <Paper sx={{ width: '100%', p: 2, height: '100%' }}>
                <Typography variant="body1" color="text.secondary" align="center">
                    Выберите элемент на доске для редактирования его свойств
                </Typography>
            </Paper>
        );
    }

    // Handle changes to properties
    const handlePropertyChange = (name, value) => {
        // Create a deep copy of the properties to avoid direct state mutation
        const updatedProperties = JSON.parse(JSON.stringify(properties));

        // Update the nested property using path notation (e.g., 'position.x')
        const path = name.split('.');
        let current = updatedProperties;

        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }

        current[path[path.length - 1]] = value;

        // Update local state
        setProperties(updatedProperties);

        // Notify parent component
        onElementUpdate(updatedProperties);
    };

    // Create a keyframe at the current time
    const createKeyframeAtCurrentTime = () => {
        if (!selectedElement || !properties) {
            console.error('Cannot create keyframe: No element selected or properties not loaded');
            return;
        }

        console.log('Creating keyframe at time:', currentTime);

        // VALIDATION: Check time is valid
        if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
            console.error('Invalid current time:', currentTime);
            return;
        }

        // VALIDATION: Ensure element has valid position
        if (!properties.position ||
            typeof properties.position.x !== 'number' || isNaN(properties.position.x) ||
            typeof properties.position.y !== 'number' || isNaN(properties.position.y)) {
            console.error('Invalid position:', properties.position);
            return;
        }

        // VALIDATION: Ensure opacity is valid
        if (!properties.style ||
            typeof properties.style.opacity !== 'number' ||
            isNaN(properties.style.opacity)) {
            console.error('Invalid opacity:', properties.style?.opacity);
            return;
        }

        // Create new keyframe with complete, validated properties
        const keyframeProps = {
            time: currentTime,
            position: {
                x: Number(properties.position.x),
                y: Number(properties.position.y)
            },
            opacity: Number(properties.style.opacity),
            scale: typeof properties.scale === 'number' ? Number(properties.scale) : 1
        };

        console.log('Creating new keyframe with props:', JSON.stringify(keyframeProps));

        // Final validation of keyframe data
        if (isNaN(keyframeProps.time) ||
            isNaN(keyframeProps.position.x) ||
            isNaN(keyframeProps.position.y) ||
            isNaN(keyframeProps.opacity) ||
            isNaN(keyframeProps.scale)) {
            console.error('INVALID KEYFRAME DATA DETECTED!', keyframeProps);
            alert('Ошибка при создании ключевого кадра: некорректные данные');
            return;
        }

        // IMPORTANT: Create a completely new object to avoid reference issues
        // Don't use properties directly or JSON parse/stringify which can cause issues
        const updatedElement = {
            ...selectedElement,
            position: { ...selectedElement.position },
            size: { ...selectedElement.size },
            style: { ...selectedElement.style }
        };

        // Ensure keyframes array exists and is properly initialized
        if (!updatedElement.keyframes) {
            console.log('Initializing new keyframes array');
            updatedElement.keyframes = [];
        } else if (!Array.isArray(updatedElement.keyframes)) {
            console.error(`Element has non-array keyframes: ${typeof updatedElement.keyframes}`);
            updatedElement.keyframes = [];
        } else {
            // Make a deep copy of existing keyframes array to avoid reference issues
            updatedElement.keyframes = updatedElement.keyframes.map(kf => ({
                time: kf.time,
                position: { x: kf.position.x, y: kf.position.y },
                opacity: kf.opacity,
                scale: kf.scale || 1
            }));
        }

        // Check if a keyframe already exists at this time
        const existingKeyframeIndex = updatedElement.keyframes.findIndex(
            kf => Math.abs(kf.time - currentTime) < 0.01
        );

        if (existingKeyframeIndex >= 0) {
            console.log(`Updating existing keyframe at index ${existingKeyframeIndex}`);
            // Replace existing keyframe with new one
            updatedElement.keyframes[existingKeyframeIndex] = keyframeProps;
        } else {
            console.log('Adding new keyframe to array');
            // Add new keyframe
            updatedElement.keyframes.push(keyframeProps);
        }

        // Sort keyframes by time
        updatedElement.keyframes.sort((a, b) => a.time - b.time);

        console.log(`Element now has ${updatedElement.keyframes.length} keyframes`);

        // Final validation check of all keyframes
        let allValid = true;
        updatedElement.keyframes.forEach((kf, idx) => {
            if (!kf ||
                typeof kf.time !== 'number' || isNaN(kf.time) ||
                !kf.position ||
                typeof kf.position.x !== 'number' || isNaN(kf.position.x) ||
                typeof kf.position.y !== 'number' || isNaN(kf.position.y) ||
                typeof kf.opacity !== 'number' || isNaN(kf.opacity)) {

                console.error(`Invalid keyframe at index ${idx}:`, kf);
                allValid = false;
            }
        });

        if (!allValid) {
            console.error('Keyframe validation failed, cannot update element');
            alert('Некоторые ключевые кадры содержат некорректные данные. Операция отменена.');
            return;
        }

        // Create comprehensive backups
        try {
            if (selectedElement.id && updatedElement.keyframes.length > 0) {
                // 1. Element-specific backup
                const elementBackupKey = `keyframe-backup-${selectedElement.id}`;
                localStorage.setItem(elementBackupKey, JSON.stringify(updatedElement.keyframes));
                console.log(`Element backup created with ${updatedElement.keyframes.length} keyframes for element ${selectedElement.id}`);

                // 2. For project-wide backup, we need to get existing backup or create a new one
                if (window.currentProjectId) {
                    const projectBackupKey = `project-keyframes-${window.currentProjectId}`;
                    try {
                        // Load existing backup
                        let projectBackup = {};
                        const existingBackup = localStorage.getItem(projectBackupKey);

                        if (existingBackup) {
                            try {
                                projectBackup = JSON.parse(existingBackup);
                            } catch (parseErr) {
                                console.warn('Failed to parse existing project backup, creating new one');
                                projectBackup = {};
                            }
                        }

                        // Update with new keyframes for this element
                        projectBackup[selectedElement.id] = updatedElement.keyframes;

                        // Save updated project backup
                        localStorage.setItem(projectBackupKey, JSON.stringify(projectBackup));

                        // Count total keyframes in backup
                        const totalBackupKeyframes = Object.values(projectBackup).reduce(
                            (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
                        );

                        console.log(`Project-wide backup updated: ${totalBackupKeyframes} total keyframes for ${Object.keys(projectBackup).length} elements`);
                    } catch (backupErr) {
                        console.error('Error updating project backup:', backupErr);
                    }
                } else {
                    console.log('No current project ID found, skipping project-wide backup');
                }
            }
        } catch (err) {
            console.warn('Failed to create keyframe backup:', err);
        }

        // Update the element with new keyframes
        console.log('Updating element with new keyframes');
        onElementUpdate(updatedElement);
    };

    // Delete a keyframe
    const deleteKeyframe = (index) => {
        // Create a deep copy of the properties
        const updatedProperties = JSON.parse(JSON.stringify(properties));

        // Remove the keyframe
        updatedProperties.keyframes.splice(index, 1);

        // Update state and notify parent
        setProperties(updatedProperties);
        onElementUpdate(updatedProperties);
    };

    // Jump to a keyframe's time
    const jumpToKeyframeTime = (time) => {
        // This will be handled by a parent component via props
        if (window.jumpToTime) {
            window.jumpToTime(time);
        }
    };

    // Format time in MM:SS.ms
    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const ms = Math.floor((timeInSeconds % 1) * 100);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${ms < 10 ? '0' : ''}${ms}`;
    };

    return (
        <Paper sx={{ width: '100%', p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
                Свойства
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* Basic properties */}
            <Typography variant="subtitle1" gutterBottom>
                Основные свойства
            </Typography>

            <TextField
                label="Название танцора"
                value={properties.title || ''}
                onChange={(e) => handlePropertyChange('title', e.target.value)}
                fullWidth
                margin="dense"
                size="small"
                sx={{ mb: 2 }}
            />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                    <TextField
                        label="X"
                        type="number"
                        value={properties.position.x}
                        onChange={(e) => handlePropertyChange('position.x', Number(e.target.value))}
                        fullWidth
                        margin="dense"
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        label="Y"
                        type="number"
                        value={properties.position.y}
                        onChange={(e) => handlePropertyChange('position.y', Number(e.target.value))}
                        fullWidth
                        margin="dense"
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        label="Ширина"
                        type="number"
                        value={properties.size.width}
                        onChange={(e) => handlePropertyChange('size.width', Number(e.target.value))}
                        fullWidth
                        margin="dense"
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        label="Высота"
                        type="number"
                        value={properties.size.height}
                        onChange={(e) => handlePropertyChange('size.height', Number(e.target.value))}
                        fullWidth
                        margin="dense"
                        size="small"
                    />
                </Grid>
            </Grid>

            {/* Style properties */}
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Стиль</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        {properties.type !== 'image' && (
                            <>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Цвет фона"
                                        type="color"
                                        value={properties.style.backgroundColor || '#ffffff'}
                                        onChange={(e) => handlePropertyChange('style.backgroundColor', e.target.value)}
                                        fullWidth
                                        margin="dense"
                                        size="small"
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        label="Цвет границы"
                                        type="color"
                                        value={properties.style.borderColor || '#000000'}
                                        onChange={(e) => handlePropertyChange('style.borderColor', e.target.value)}
                                        fullWidth
                                        margin="dense"
                                        size="small"
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        label="Толщина границы"
                                        type="number"
                                        value={properties.style.borderWidth}
                                        onChange={(e) => handlePropertyChange('style.borderWidth', Number(e.target.value))}
                                        inputProps={{ min: 0, max: 20 }}
                                        fullWidth
                                        margin="dense"
                                        size="small"
                                    />
                                </Grid>
                            </>
                        )}

                        <Grid item xs={12}>
                            <Typography gutterBottom>Прозрачность</Typography>
                            <Slider
                                value={properties.style.opacity * 100}
                                onChange={(_, value) => handlePropertyChange('style.opacity', value / 100)}
                                valueLabelDisplay="auto"
                                min={0}
                                max={100}
                            />
                        </Grid>

                        {properties.type === 'text' && (
                            <Grid item xs={12}>
                                <TextField
                                    label="Текст"
                                    value={properties.content}
                                    onChange={(e) => handlePropertyChange('content', e.target.value)}
                                    fullWidth
                                    margin="dense"
                                    size="small"
                                    multiline
                                    rows={2}
                                />
                            </Grid>
                        )}

                        {properties.type === 'image' && (
                            <Grid item xs={12}>
                                <TextField
                                    label="URL изображения"
                                    value={properties.content}
                                    onChange={(e) => handlePropertyChange('content', e.target.value)}
                                    fullWidth
                                    margin="dense"
                                    size="small"
                                />
                            </Grid>
                        )}
                    </Grid>
                </AccordionDetails>
            </Accordion>

            {/* Animation keyframes */}
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Анимация (Ключевые кадры)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Текущее время: {formatTime(currentTime)}
                        </Typography>

                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={createKeyframeAtCurrentTime}
                            startIcon={<AccessTime />}
                            fullWidth
                            sx={{ mt: 1 }}
                        >
                            Создать ключевой кадр
                        </Button>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                            Для создания анимации:
                        </Typography>
                        <ol>
                            <li>Переместите плеер на начальное время</li>
                            <li>Установите элемент в начальное положение</li>
                            <li>Нажмите "Создать ключевой кадр"</li>
                            <li>Переместите плеер на другое время</li>
                            <li>Измените положение элемента</li>
                            <li>Снова нажмите "Создать ключевой кадр"</li>
                        </ol>
                    </Box>

                    <Divider />

                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                        Список ключевых кадров:
                    </Typography>

                    {properties.keyframes && properties.keyframes.length > 0 ? (
                        <List dense>
                            {properties.keyframes
                                .sort((a, b) => a.time - b.time)
                                .map((keyframe, index) => (
                                    <ListItem
                                        key={index}
                                        sx={{
                                            bgcolor: Math.abs(keyframe.time - currentTime) < 0.01 ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                                            borderRadius: 1
                                        }}
                                    >
                                        <ListItemText
                                            primary={`${formatTime(keyframe.time)}`}
                                            secondary={`X: ${Math.round(keyframe.position.x)}, Y: ${Math.round(keyframe.position.y)}, Прозрачность: ${Math.round(keyframe.opacity * 100)}%`}
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => jumpToKeyframeTime(keyframe.time)}
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() => deleteKeyframe(index)}
                                            >
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                        </List>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Нет ключевых кадров. Создайте первый ключевой кадр.
                        </Typography>
                    )}
                </AccordionDetails>
            </Accordion>

            {/* Element visibility timing */}
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Время появления на сцене</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Typography gutterBottom>Время появления (сек)</Typography>
                            <TextField
                                type="number"
                                value={properties.animation?.startTime || 0}
                                onChange={(e) => {
                                    const updatedProperties = JSON.parse(JSON.stringify(properties));
                                    if (!updatedProperties.animation) {
                                        updatedProperties.animation = {
                                            startTime: 0,
                                            endTime: null
                                        };
                                    }
                                    updatedProperties.animation.startTime = Number(e.target.value);
                                    setProperties(updatedProperties);
                                    onElementUpdate(updatedProperties);
                                }}
                                fullWidth
                                margin="dense"
                                size="small"
                                inputProps={{ min: 0, step: 0.1 }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Typography gutterBottom>Время исчезновения (сек)</Typography>
                            <TextField
                                type="number"
                                value={properties.animation?.endTime === null ? '' : properties.animation?.endTime}
                                onChange={(e) => {
                                    const updatedProperties = JSON.parse(JSON.stringify(properties));
                                    if (!updatedProperties.animation) {
                                        updatedProperties.animation = {
                                            startTime: 0,
                                            endTime: null
                                        };
                                    }
                                    updatedProperties.animation.endTime = e.target.value === '' ? null : Number(e.target.value);
                                    setProperties(updatedProperties);
                                    onElementUpdate(updatedProperties);
                                }}
                                fullWidth
                                margin="dense"
                                size="small"
                                inputProps={{ min: 0, step: 0.1 }}
                                placeholder="Без исчезновения"
                            />
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>

            {/* 3D Model accordion */}
            <Accordion
                sx={{ mt: 2 }}
                defaultExpanded={false}
            >
                <AccordionSummary
                    expandIcon={<ExpandMore />}
                >
                    <Typography variant="subtitle1">3D модель</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            {properties.modelPath ? (
                                <>
                                    <Typography variant="body2" gutterBottom>
                                        Загружена 3D модель
                                    </Typography>
                                    <Box sx={{ mb: 2, width: '100%', height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#f0f0f0', borderRadius: 1 }}>
                                        <ThreeDRotation sx={{ fontSize: 60, color: 'rgba(0,0,0,0.4)' }} />
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom noWrap>
                                        {properties.modelPath.split('/').pop()}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        fullWidth
                                        onClick={() => handlePropertyChange('modelPath', null)}
                                    >
                                        Удалить 3D модель
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" gutterBottom>
                                        Загрузите 3D модель (.glb, .gltf):
                                    </Typography>
                                    {properties.modelUploading ? (
                                        <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
                                            <Typography variant="body2" gutterBottom>
                                                Загрузка 3D модели...
                                            </Typography>
                                            <LinearProgress />
                                        </Box>
                                    ) : (
                                        <>
                                            <input
                                                type="file"
                                                accept=".glb,.gltf"
                                                style={{ display: 'none' }}
                                                id="model-upload"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        // Check file size
                                                        const fileSizeMB = file.size / (1024 * 1024);
                                                        if (fileSizeMB > 10) {
                                                            alert(`Внимание: Файл размером ${fileSizeMB.toFixed(2)}MB может замедлить работу приложения.`);
                                                        }

                                                        // Show uploading state
                                                        setProperties(prev => ({
                                                            ...prev,
                                                            modelUploading: true
                                                        }));

                                                        // Create form data for upload
                                                        const formData = new FormData();
                                                        formData.append('model', file);

                                                        // Upload file to server
                                                        fetch('/api/upload/model', {
                                                            method: 'POST',
                                                            body: formData,
                                                        })
                                                            .then(response => {
                                                                if (!response.ok) {
                                                                    throw new Error(`Ошибка загрузки: ${response.status}`);
                                                                }
                                                                return response.json();
                                                            })
                                                            .then(data => {
                                                                if (data.success) {
                                                                    console.log("Model uploaded successfully:", data);

                                                                    // Update with the path returned from server
                                                                    // We're adding a timestamp query parameter to bypass caching
                                                                    const modelPathWithCache = `${data.modelPath}?t=${Date.now()}`;
                                                                    handlePropertyChange('modelPath', modelPathWithCache);

                                                                    // Log success to help user track completion
                                                                    console.log("3D model loaded and ready to use!");
                                                                } else {
                                                                    console.error("Server returned error:", data);
                                                                    alert('Ошибка загрузки модели: ' + (data.message || 'Неизвестная ошибка'));
                                                                }
                                                            })
                                                            .catch(error => {
                                                                console.error('Error uploading model:', error);
                                                                alert(`Ошибка при загрузке модели: ${error.message}`);
                                                            })
                                                            .finally(() => {
                                                                // Clear uploading state
                                                                setProperties(prev => ({
                                                                    ...prev,
                                                                    modelUploading: false
                                                                }));
                                                            });
                                                    }
                                                }}
                                            />
                                            <label htmlFor="model-upload">
                                                <Button
                                                    variant="contained"
                                                    component="span"
                                                    fullWidth
                                                >
                                                    Выбрать 3D модель
                                                </Button>
                                            </label>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                                Поддерживаются модели любого размера, включая тяжелые (более 10MB).
                                            </Typography>
                                        </>
                                    )}
                                </>
                            )}
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>
        </Paper>
    );
};

export default PropertyPanel; 