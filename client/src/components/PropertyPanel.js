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
    Tooltip,
    Switch,
    FormControlLabel,
    Collapse,
    useTheme,
    alpha
} from '@mui/material';
import {
    ExpandMore,
    Delete,
    AccessTime,
    ThreeDRotation,
    FileCopy,
    Timeline,
    PanTool,
    KeyboardArrowUp,
    KeyboardArrowDown,
    AddCircleOutline,
    Image as ImageIcon,
    Title as TitleIcon,
    FormatSize,
    Palette,
    BorderAll,
    Opacity,
    Update as UpdateIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { styled } from '@mui/system';
import { COLORS } from '../constants/colors';

// Определение цветовой палитры
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
        main: '#8678B2', // Серо-фиолетовый
        dark: '#5D5080'
    }
};

// Styled components for the PropertyPanel
const StyledSection = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(32, 38, 52, 0.7)'  // Lighter section background
        : 'rgba(250, 252, 255, 0.8)', // Very light blue-gray
    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
    transition: 'all 0.2s',
    '&:hover': {
        boxShadow: theme.palette.mode === 'dark'
            ? '0 4px 20px 0 rgba(0, 0, 0, 0.2)'
            : '0 4px 20px 0 rgba(0, 0, 0, 0.1)',
    },
    backdropFilter: 'blur(8px)',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.mode === 'dark' ? PALETTE.secondary.light : PALETTE.secondary.main,
    marginBottom: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
    '& svg': {
        marginRight: theme.spacing(1),
        fontSize: '1.1rem',
        opacity: 0.8
    }
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
    backgroundColor: 'transparent',
    borderRadius: theme.spacing(1),
    boxShadow: 'none',
    '&:before': {
        display: 'none',
    },
    '&.Mui-expanded': {
        margin: 0,
        '&:first-of-type': {
            marginTop: 0,
        },
    },
}));

const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
    padding: theme.spacing(0, 1),
    minHeight: 48,
    borderRadius: theme.spacing(1),
    '&.Mui-expanded': {
        minHeight: 48,
        backgroundColor: theme.palette.mode === 'dark'
            ? alpha(PALETTE.primary.main, 0.1)
            : alpha(PALETTE.primary.light, 0.1)
    },
    '& .MuiAccordionSummary-content': {
        margin: theme.spacing(1, 0),
        '&.Mui-expanded': {
            margin: theme.spacing(1, 0),
        },
    },
    '& .MuiTypography-root': {
        fontWeight: 600,
        color: theme.palette.mode === 'dark'
            ? PALETTE.teal.light
            : PALETTE.teal.dark,
    },
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: 8,
    textTransform: 'none',
    fontWeight: 600,
    boxShadow: 'none',
    background: theme.palette.mode === 'dark'
        ? `linear-gradient(45deg, ${PALETTE.primary.dark}, ${PALETTE.primary.main})`
        : undefined,
    '&:hover': {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transform: 'translateY(-2px)'
    },
    transition: 'all 0.2s'
}));

const KeyframeListItem = styled(ListItem)(({ theme, isactive }) => ({
    borderRadius: 8,
    backgroundColor: isactive === 'true'
        ? theme.palette.mode === 'dark'
            ? alpha(PALETTE.primary.main, 0.2)
            : alpha(PALETTE.primary.light, 0.1)
        : 'transparent',
    transition: 'all 0.2s',
    '&:hover': {
        backgroundColor: theme.palette.mode === 'dark'
            ? alpha(PALETTE.primary.main, 0.15)
            : alpha(PALETTE.primary.main, 0.05)
    },
    marginBottom: 4
}));

const PropertyPanel = ({ selectedElement, onElementUpdate, currentTime }) => {
    const theme = useTheme();
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
            <Paper sx={{
                width: '100%',
                p: 3,
                height: '100%',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.palette.mode === 'dark'
                    ? 'rgba(26, 32, 46, 0.85)'  // Lighter, more neutral dark blue
                    : 'rgba(240, 245, 255, 0.9)', // Light blue-gray
                backdropFilter: 'blur(10px)',
                border: `1px solid ${theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(30, 144, 255, 0.15)'}`,
            }}>
                <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 2 }}>
                    Выберите элемент на доске для редактирования
                </Typography>
                <Box sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    backgroundColor: alpha(PALETTE.secondary.main, 0.1),
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    mb: 2
                }}>
                    <PanTool sx={{ fontSize: 32, color: alpha(PALETTE.secondary.main, 0.6) }} />
                </Box>
            </Paper>
        );
    }

    // Handle changes to properties
    const handlePropertyChange = (name, value) => {
        // Для безопасности заменяем 'transparent' на rgba(0,0,0,0)
        if (value === 'transparent') {
            value = 'rgba(0,0,0,0)';
        }

        // Создаем глубокую копию свойств
        const updatedProperties = JSON.parse(JSON.stringify(properties));

        // Обновляем вложенное свойство, используя нотацию пути (например, 'position.x')
        const path = name.split('.');
        let current = updatedProperties;

        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }

        current[path[path.length - 1]] = value;

        // Добавляем отладочное логирование для изменений позиции
        if (name.startsWith('position.')) {
            const hasKeyframes = updatedProperties.keyframes && updatedProperties.keyframes.length > 0;

            console.log(`PropertyPanel: Changed ${name} to ${value}`, {
                elementId: updatedProperties.id,
                position: updatedProperties.position,
                has3DModel: updatedProperties.has3DModel || false,
                modelPath: updatedProperties.modelPath || 'none',
                hasKeyframes: hasKeyframes
            });

            // Если есть ключевые кадры, нужно создать или обновить ключевой кадр на текущем времени
            if (hasKeyframes) {
                console.log(`Element ${updatedProperties.id} has keyframes, this change will be visible in the current keyframe or need to create a new keyframe`);
            }
        }

        // Обновляем локальное состояние
        setProperties(updatedProperties);

        // Уведомляем родительский компонент
        onElementUpdate(updatedProperties);

        // Используем setTimeout чтобы гарантировать обновление канваса после применения свойств
        // Вызываем forceRenderCanvas только если нет ключевых кадров или мы не в режиме воспроизведения
        if (name.startsWith('position.') && window.forceRenderCanvas) {
            const hasKeyframes = updatedProperties.keyframes && updatedProperties.keyframes.length > 0;
            const isPlaying = window.isPlaying || false; // Глобальное состояние воспроизведения

            if (!hasKeyframes || !isPlaying) {
                setTimeout(() => {
                    console.log(`Forcing canvas render after position change: ${name}=${value} for element ${updatedProperties.id}`);
                    // Передаем ID элемента, чтобы обновить только его
                    window.forceRenderCanvas(updatedProperties.id);
                }, 0);
            } else {
                console.log(`Skip forcing canvas render because element has keyframes and is playing`);
            }
        }
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
        <Paper sx={{
            width: '100%',
            p: 2,
            height: '100%',
            overflow: 'auto',
            borderRadius: 2,
            backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(26, 32, 46, 0.85)'  // Lighter, more neutral dark blue
                : 'rgba(240, 245, 255, 0.9)', // Light blue-gray
            backdropFilter: 'blur(8px)',
            border: `1px solid ${theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(30, 144, 255, 0.15)'}`,
        }}>
            <Typography variant="h6" gutterBottom sx={{
                color: theme.palette.mode === 'dark' ? PALETTE.secondary.light : PALETTE.secondary.main,
                fontWeight: 700,
                mb: 2,
                position: 'relative',
                display: 'inline-block',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: -4,
                    left: 0,
                    width: 40,
                    height: 3,
                    backgroundImage: `linear-gradient(to right, ${PALETTE.secondary.main}, ${PALETTE.tertiary.main})`,
                    borderRadius: 1.5
                }
            }}>
                Свойства
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* Basic properties */}
            <StyledSection>
                <SectionTitle>
                    <TitleIcon />
                    Основные свойства
                </SectionTitle>

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
            </StyledSection>

            {/* Style properties */}
            <StyledAccordion>
                <StyledAccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Стиль</Typography>
                </StyledAccordionSummary>
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
                                sx={{
                                    color: PALETTE.teal.main,
                                    '& .MuiSlider-thumb': {
                                        backgroundColor: PALETTE.teal.main,
                                    },
                                }}
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
            </StyledAccordion>

            {/* Animation keyframes */}
            <StyledAccordion defaultExpanded>
                <StyledAccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Анимация (Ключевые кадры)</Typography>
                </StyledAccordionSummary>
                <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom sx={{
                            display: 'inline-block',
                            backgroundColor: theme.palette.mode === 'dark'
                                ? alpha(PALETTE.primary.main, 0.15)
                                : alpha(PALETTE.primary.light, 0.15),
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                        }}>
                            Текущее время: {formatTime(currentTime)}
                        </Typography>

                        <StyledButton
                            variant="contained"
                            color="primary"
                            size="medium"
                            onClick={createKeyframeAtCurrentTime}
                            startIcon={<AccessTime />}
                            fullWidth
                            sx={{ mt: 2 }}
                        >
                            Создать ключевой кадр
                        </StyledButton>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                            Для создания анимации:
                        </Typography>
                        <Box sx={{
                            py: 1,
                            px: 2,
                            borderRadius: 1,
                            backgroundColor: alpha(PALETTE.purpleGrey.main, 0.1),
                            border: `1px solid ${alpha(PALETTE.purpleGrey.main, 0.1)}`,
                        }}>
                            <ol style={{
                                paddingLeft: '1.2rem',
                                margin: '0.5rem 0',
                                color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
                            }}>
                                <li>Переместите плеер на начальное время</li>
                                <li>Установите элемент в начальное положение</li>
                                <li>Нажмите "Создать ключевой кадр"</li>
                                <li>Переместите плеер на другое время</li>
                                <li>Измените положение элемента</li>
                                <li>Снова нажмите "Создать ключевой кадр"</li>
                            </ol>
                        </Box>
                    </Box>

                    <Divider sx={{ mt: 3, mb: 2 }} />

                    <Typography variant="subtitle2" sx={{
                        mb: 1,
                        color: PALETTE.tertiary.main,
                        fontWeight: 600
                    }}>
                        Список ключевых кадров:
                    </Typography>

                    {properties.keyframes && properties.keyframes.length > 0 ? (
                        <List dense sx={{ mt: 1 }}>
                            {properties.keyframes
                                .sort((a, b) => a.time - b.time)
                                .map((keyframe, index) => (
                                    <KeyframeListItem
                                        key={index}
                                        isactive={Math.abs(keyframe.time - currentTime) < 0.01 ? 'true' : 'false'}
                                    >
                                        <ListItemText
                                            primary={
                                                <Typography variant="body2" fontWeight={500} color={
                                                    Math.abs(keyframe.time - currentTime) < 0.01
                                                        ? PALETTE.primary.main
                                                        : 'text.primary'
                                                }>
                                                    {formatTime(keyframe.time)}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography variant="caption" color="text.secondary">
                                                    X: {Math.round(keyframe.position.x)}, Y: {Math.round(keyframe.position.y)},
                                                    Прозрачность: {Math.round(keyframe.opacity * 100)}%
                                                </Typography>
                                            }
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => jumpToKeyframeTime(keyframe.time)}
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() => deleteKeyframe(index)}
                                                sx={{
                                                    color: theme.palette.mode === 'dark'
                                                        ? PALETTE.tertiary.light
                                                        : PALETTE.tertiary.main,
                                                }}
                                            >
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </KeyframeListItem>
                                ))}
                        </List>
                    ) : (
                        <Box sx={{
                            textAlign: 'center',
                            py: 2,
                            backgroundColor: alpha(PALETTE.purpleGrey.main, 0.05),
                            borderRadius: 1
                        }}>
                            <Typography variant="body2" color="text.secondary">
                                Нет ключевых кадров. Создайте первый ключевой кадр.
                            </Typography>
                        </Box>
                    )}
                </AccordionDetails>
            </StyledAccordion>

            {/* Element visibility timing */}
            <StyledAccordion>
                <StyledAccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Время появления на сцене</Typography>
                </StyledAccordionSummary>
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
            </StyledAccordion>
        </Paper>
    );
};

export default PropertyPanel; 