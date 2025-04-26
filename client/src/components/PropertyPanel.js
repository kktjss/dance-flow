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
} from '@mui/material';
import { ExpandMore, Delete, AccessTime } from '@mui/icons-material';

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
        // Create a deep copy of the properties
        const updatedProperties = JSON.parse(JSON.stringify(properties));

        // Ensure keyframes array exists
        if (!updatedProperties.keyframes) {
            updatedProperties.keyframes = [];
        }

        // Check if a keyframe already exists at this time
        const existingKeyframeIndex = updatedProperties.keyframes.findIndex(
            k => Math.abs(k.time - currentTime) < 0.01
        );

        // Properties to save in the keyframe
        const keyframeProps = {
            position: {
                x: updatedProperties.position.x,
                y: updatedProperties.position.y
            },
            opacity: updatedProperties.style.opacity,
            scale: 1 // Default scale
        };

        if (existingKeyframeIndex >= 0) {
            // Update existing keyframe
            updatedProperties.keyframes[existingKeyframeIndex] = {
                ...updatedProperties.keyframes[existingKeyframeIndex],
                ...keyframeProps,
                time: currentTime
            };
        } else {
            // Add new keyframe
            updatedProperties.keyframes.push({
                time: currentTime,
                ...keyframeProps
            });

            // Sort keyframes by time
            updatedProperties.keyframes.sort((a, b) => a.time - b.time);
        }

        // Update state and notify parent
        setProperties(updatedProperties);
        onElementUpdate(updatedProperties);
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
        </Paper>
    );
};

export default PropertyPanel; 