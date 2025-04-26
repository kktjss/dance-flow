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
} from '@mui/material';
import { ExpandMore, Timeline } from '@mui/icons-material';

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

    // Handle changes to animation timing
    const handleAnimationChange = (name, value) => {
        // Create a deep copy of the properties
        const updatedProperties = JSON.parse(JSON.stringify(properties));

        // Ensure animation object exists
        if (!updatedProperties.animation) {
            updatedProperties.animation = {
                startTime: 0,
                endTime: null,
                effects: []
            };
        }

        // Update the animation property
        updatedProperties.animation[name] = value;

        // Update local state
        setProperties(updatedProperties);

        // Notify parent component
        onElementUpdate(updatedProperties);
    };

    // Add a new animation effect
    const handleAddEffect = (type) => {
        // Create a deep copy of the properties
        const updatedProperties = JSON.parse(JSON.stringify(properties));

        // Ensure animation and effects array exist
        if (!updatedProperties.animation) {
            updatedProperties.animation = {
                startTime: 0,
                endTime: null,
                effects: []
            };
        }

        if (!updatedProperties.animation.effects) {
            updatedProperties.animation.effects = [];
        }

        // Create a new effect based on type
        let newEffect = {
            type,
            startTime: currentTime,
            endTime: currentTime + 3
        };

        // Add type-specific parameters
        switch (type) {
            case 'fade':
                newEffect.params = {
                    startOpacity: 0,
                    endOpacity: 1
                };
                break;
            case 'move':
                newEffect.params = {
                    startPosition: { ...updatedProperties.position },
                    endPosition: {
                        x: updatedProperties.position.x + 100,
                        y: updatedProperties.position.y + 100
                    }
                };
                break;
            case 'scale':
                newEffect.params = {
                    startScale: 1,
                    endScale: 2
                };
                break;
            default:
                break;
        }

        // Add the new effect
        updatedProperties.animation.effects.push(newEffect);

        // Update local state
        setProperties(updatedProperties);

        // Notify parent component
        onElementUpdate(updatedProperties);
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

            {/* Animation properties */}
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Анимация</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Typography gutterBottom>Время появления (сек)</Typography>
                            <TextField
                                type="number"
                                value={properties.animation?.startTime || 0}
                                onChange={(e) => handleAnimationChange('startTime', Number(e.target.value))}
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
                                    const value = e.target.value === '' ? null : Number(e.target.value);
                                    handleAnimationChange('endTime', value);
                                }}
                                fullWidth
                                margin="dense"
                                size="small"
                                inputProps={{ min: 0, step: 0.1 }}
                                placeholder="Без исчезновения"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Typography gutterBottom sx={{ mt: 2 }}>Эффекты анимации</Typography>
                            <Box sx={{ mb: 1 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Добавить эффект</InputLabel>
                                    <Select
                                        label="Добавить эффект"
                                        value=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddEffect(e.target.value);
                                            }
                                        }}
                                    >
                                        <MenuItem value="">Выберите тип эффекта</MenuItem>
                                        <MenuItem value="fade">Появление/исчезновение</MenuItem>
                                        <MenuItem value="move">Перемещение</MenuItem>
                                        <MenuItem value="scale">Масштабирование</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            {properties.animation?.effects && properties.animation.effects.length > 0 ? (
                                properties.animation.effects.map((effect, index) => (
                                    <Paper key={index} sx={{ p: 1, mb: 1 }}>
                                        <Typography variant="body2">
                                            {effect.type === 'fade' && 'Появление/исчезновение'}
                                            {effect.type === 'move' && 'Перемещение'}
                                            {effect.type === 'scale' && 'Масштабирование'}
                                            : {effect.startTime}с - {effect.endTime}с
                                        </Typography>
                                    </Paper>
                                ))
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Нет эффектов. Добавьте эффект из списка выше.
                                </Typography>
                            )}
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>
        </Paper>
    );
};

export default PropertyPanel; 