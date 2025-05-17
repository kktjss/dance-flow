import React, { useRef, useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Paper,
    Tooltip,
    Button,
    useTheme,
    alpha
} from '@mui/material';
import {
    SquareOutlined,
    CircleOutlined,
    TextFields,
    Image as ImageIcon,
    ViewInAr,
    DragIndicator,
    Crop169,
    RadioButtonUnchecked,
    Add,
    FormatColorFill,
    Brush
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { styled } from '@mui/system';
import { COLORS } from '../constants/colors';

// Styled components
const ToolButton = styled(Button)(({ theme }) => ({
    width: '100%',
    display: 'flex',
    justifyContent: 'flex-start',
    textTransform: 'none',
    borderRadius: 12,
    padding: theme.spacing(1.8),
    marginBottom: theme.spacing(1.2),
    color: theme.palette.mode === 'dark' ? theme.palette.grey[300] : theme.palette.text.primary,
    backgroundColor: theme.palette.mode === 'dark'
        ? alpha(theme.palette.background.paper, 0.4)
        : alpha(theme.palette.background.paper, 0.7),
    border: `1px solid ${theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.05)'}`,
    '&:hover': {
        backgroundColor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.primary.main, 0.15)
            : alpha(theme.palette.primary.main, 0.08),
        transform: 'translateY(-2px)',
        boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 20px 0 rgba(0, 0, 0, 0.3)'
            : '0 8px 20px 0 rgba(0, 0, 0, 0.1)',
    },
    transition: 'all 0.25s ease',
    backdropFilter: 'blur(10px)',
}));

// Color palette
const PALETTE = {
    // Primary colors
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
    // Additional colors
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
    // Neutral colors
    purpleGrey: {
        light: '#9D94D3',
        main: '#8678B2', // Grey-purple
        dark: '#5D5080'
    }
};

const ToolPanel = ({ onAddElement }) => {
    const theme = useTheme();

    // Basic tools
    const tools = [
        {
            id: 'text',
            name: 'Текст',
            icon: <TextFields />,
            defaults: {
                type: 'text',
                content: 'Введите текст',
                position: { x: 100, y: 100 },
                size: { width: 200, height: 24 },
                style: {
                    color: theme.palette.mode === 'dark' ? '#FFFFFF' : '#111111',
                    backgroundColor: 'rgba(0, 0, 0, 0)',
                    borderColor: 'rgba(0, 0, 0, 0)',
                    borderWidth: 0,
                    opacity: 1,
                    zIndex: 1
                }
            }
        },
        {
            id: 'rectangle',
            name: 'Прямоугольник',
            icon: <Crop169 />,
            defaults: {
                type: 'rectangle',
                position: { x: 100, y: 100 },
                size: { width: 100, height: 100 },
                style: {
                    color: '#FFFFFF',
                    backgroundColor: PALETTE.secondary.main, // Light blue rectangle
                    borderColor: 'rgba(0, 0, 0, 0)',
                    borderWidth: 0,
                    opacity: 0.8,
                    zIndex: 1
                }
            }
        },
        {
            id: 'circle',
            name: 'Круг',
            icon: <RadioButtonUnchecked />,
            defaults: {
                type: 'circle',
                position: { x: 100, y: 100 },
                size: { width: 100, height: 100 },
                style: {
                    color: '#FFFFFF',
                    backgroundColor: PALETTE.tertiary.main, // Turquoise circle
                    borderColor: 'rgba(0, 0, 0, 0)',
                    borderWidth: 0,
                    opacity: 0.8,
                    zIndex: 1
                }
            }
        },
        {
            id: 'rectangle2',
            name: 'Синий блок',
            icon: <Crop169 />,
            defaults: {
                type: 'rectangle',
                position: { x: 100, y: 100 },
                size: { width: 120, height: 80 },
                style: {
                    color: '#FFFFFF',
                    backgroundColor: PALETTE.primary.main, // Blue-violet block
                    borderColor: 'rgba(0, 0, 0, 0)',
                    borderWidth: 0,
                    opacity: 0.8,
                    zIndex: 1
                }
            }
        },
        {
            id: 'circle2',
            name: 'Желтый круг',
            icon: <RadioButtonUnchecked />,
            defaults: {
                type: 'circle',
                position: { x: 100, y: 100 },
                size: { width: 80, height: 80 },
                style: {
                    color: '#FFFFFF',
                    backgroundColor: PALETTE.accent.main, // Yellow circle
                    borderColor: 'rgba(0, 0, 0, 0)',
                    borderWidth: 0,
                    opacity: 0.8,
                    zIndex: 1
                }
            }
        }
    ];

    // Drag and Drop for elements
    const handleDragStart = (e, tool) => {
        // Create new element
        const newElement = {
            ...tool.defaults,
            id: `${tool.id}-${uuidv4()}`,
            createdAt: new Date().toISOString(),
            // Position will be updated on drop
            keyframes: []
        };

        // Serialize element data for transfer
        e.dataTransfer.setData('application/json', JSON.stringify(newElement));

        // Create visual representation for drag and drop
        const dragImage = document.createElement('div');
        dragImage.style.width = '100px';
        dragImage.style.height = '100px';
        dragImage.style.borderRadius = tool.id.includes('circle') ? '50%' : '4px';
        dragImage.style.backgroundColor = tool.defaults.style.backgroundColor || '#ccc';
        dragImage.style.border = tool.defaults.style.borderWidth ?
            `${tool.defaults.style.borderWidth}px solid ${tool.defaults.style.borderColor}` : 'none';
        dragImage.style.opacity = '0.6';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);

        e.dataTransfer.setDragImage(dragImage, 50, 50);

        // Remove element after a small delay
        setTimeout(() => {
            document.body.removeChild(dragImage);
        }, 0);
    };

    // Display tool elements
    return (
        <Paper sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(26, 32, 46, 0.85)'  // Lighter, more neutral dark blue background
                : 'rgba(240, 245, 255, 0.9)', // Very light blue-gray in light mode
            backdropFilter: 'blur(12px)',
            border: `1px solid ${theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(30, 144, 255, 0.15)'}`,
            boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.2)'
                : '0 8px 32px rgba(0, 0, 0, 0.06)',
            height: '100%',
            overflow: 'auto'
        }}>
            <Typography variant="h6" gutterBottom sx={{
                fontWeight: 700,
                mb: 3,
                color: theme.palette.mode === 'dark' ? PALETTE.secondary.light : PALETTE.secondary.main,
                position: 'relative',
                display: 'inline-block',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: -8,
                    left: 0,
                    width: 40,
                    height: 3,
                    backgroundImage: `linear-gradient(to right, ${PALETTE.secondary.main}, ${PALETTE.tertiary.main})`,
                    borderRadius: 1.5
                }
            }}>
                Элементы
            </Typography>

            <Divider sx={{ mb: 3, opacity: 0.6 }} />

            <Box sx={{ mb: 3 }}>
                {tools.map(tool => (
                    <Tooltip title="Перетащите на сцену или нажмите для добавления" key={tool.id} arrow placement="right">
                        <ToolButton
                            draggable
                            onDragStart={(e) => handleDragStart(e, tool)}
                            startIcon={
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 32,
                                    height: 32,
                                    borderRadius: tool.id.includes('circle') ? '50%' : '8px',
                                    backgroundColor: alpha(tool.defaults.style.backgroundColor, 0.2),
                                    mr: 1
                                }}>
                                    {tool.icon}
                                </Box>
                            }
                            onClick={() => {
                                // Create new element
                                const newElement = {
                                    ...tool.defaults,
                                    id: `${tool.id}-${uuidv4()}`,
                                    createdAt: new Date().toISOString(),
                                    keyframes: []
                                };

                                // Add element
                                onAddElement(newElement);
                            }}
                            sx={{
                                borderLeft: `4px solid ${tool.defaults.style.backgroundColor}`,
                                '&:hover': {
                                    borderLeft: `4px solid ${tool.defaults.style.backgroundColor}`,
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? alpha(tool.defaults.style.backgroundColor, 0.15)
                                        : alpha(tool.defaults.style.backgroundColor, 0.08),
                                }
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Box sx={{
                                    flexGrow: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    fontWeight: 500
                                }}>
                                    {tool.name}
                                </Box>
                                <DragIndicator sx={{
                                    opacity: 0.5,
                                    fontSize: 18,
                                    color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'
                                }} />
                            </Box>
                        </ToolButton>
                    </Tooltip>
                ))}
            </Box>

            <Button
                variant="outlined"
                fullWidth
                startIcon={<Add />}
                sx={{
                    mt: 2,
                    borderRadius: 2,
                    textTransform: 'none',
                    borderColor: alpha(PALETTE.primary.main, 0.3),
                    color: theme.palette.mode === 'dark' ? PALETTE.primary.light : PALETTE.primary.main,
                    padding: '10px 0',
                    '&:hover': {
                        borderColor: PALETTE.primary.main,
                        backgroundColor: alpha(PALETTE.primary.main, 0.05),
                    }
                }}
            >
                Добавить элемент
            </Button>

            <Typography variant="caption" sx={{
                mt: 4,
                display: 'block',
                textAlign: 'center',
                color: theme.palette.mode === 'dark' ? PALETTE.purpleGrey.light : PALETTE.purpleGrey.main,
                fontStyle: 'italic',
                opacity: 0.7
            }}>
                Перетащите элемент на сцену или нажмите для добавления
            </Typography>
        </Paper>
    );
};

export default ToolPanel; 