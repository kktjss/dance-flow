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
    Button
} from '@mui/material';
import {
    SquareOutlined,
    CircleOutlined,
    TextFields,
    Image as ImageIcon,
    ViewInAr
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
// ВРЕМЕННО: Импорт ModelViewer - будет удален позже
import ModelViewer from './ModelViewer';

const ToolPanel = ({ onAddElement }) => {
    // ВРЕМЕННО: Состояние для показа 3D модели - будет удалено позже
    const [showModelViewer, setShowModelViewer] = useState(false);
    const dragImageRef = useRef(null);

    // Create a container for drag images
    useEffect(() => {
        dragImageRef.current = document.createElement('div');
        dragImageRef.current.style.position = 'absolute';
        dragImageRef.current.style.pointerEvents = 'none';
        dragImageRef.current.style.top = '-1000px';
        dragImageRef.current.style.left = '-1000px';
        document.body.appendChild(dragImageRef.current);

        return () => {
            if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
                document.body.removeChild(dragImageRef.current);
            }
        };
    }, []);

    // Define available tools
    const tools = [
        {
            id: 'rectangle',
            label: 'Прямоугольник',
            icon: <SquareOutlined />,
            defaults: {
                type: 'rectangle',
                title: 'Танцор',
                position: { x: 100, y: 100 },
                size: { width: 150, height: 100 },
                style: {
                    backgroundColor: '#4CAF50',
                    borderColor: '#2E7D32',
                    borderWidth: 2,
                    opacity: 1,
                    zIndex: 1
                },
                animation: {
                    startTime: 0,
                    endTime: null
                },
                keyframes: [],
                videoUrl: null
            }
        },
        {
            id: 'circle',
            label: 'Круг',
            icon: <CircleOutlined />,
            defaults: {
                type: 'circle',
                title: 'Танцор',
                position: { x: 100, y: 100 },
                size: { width: 100, height: 100 },
                style: {
                    backgroundColor: '#2196F3',
                    borderColor: '#0D47A1',
                    borderWidth: 2,
                    opacity: 1,
                    zIndex: 1
                },
                animation: {
                    startTime: 0,
                    endTime: null
                },
                keyframes: [],
                videoUrl: null
            }
        },
        {
            id: 'text',
            label: 'Текст',
            icon: <TextFields />,
            defaults: {
                type: 'text',
                title: 'Текст',
                position: { x: 100, y: 100 },
                size: { width: 200, height: 50 },
                content: 'Двойной клик для редактирования',
                style: {
                    color: '#000000',
                    backgroundColor: 'transparent',
                    opacity: 1,
                    zIndex: 1
                },
                animation: {
                    startTime: 0,
                    endTime: null
                },
                keyframes: [],
                videoUrl: null
            }
        },
        {
            id: 'image',
            label: 'Изображение',
            icon: <ImageIcon />,
            defaults: {
                type: 'image',
                title: 'Изображение',
                position: { x: 100, y: 100 },
                size: { width: 200, height: 150 },
                content: 'https://via.placeholder.com/200x150',
                style: {
                    opacity: 1,
                    zIndex: 1
                },
                animation: {
                    startTime: 0,
                    endTime: null
                },
                keyframes: [],
                videoUrl: null
            }
        }
    ];

    // Handle drag start
    const handleDragStart = (e, tool) => {
        // Create a new element with default properties and a unique ID
        const newElement = {
            ...tool.defaults,
            id: uuidv4(),
            keyframes: []
        };

        // Store the element data as a string in the drag data
        e.dataTransfer.setData('application/json', JSON.stringify(newElement));

        // Set drag image safely using the ref
        if (dragImageRef.current) {
            // Clear previous content
            while (dragImageRef.current.firstChild) {
                dragImageRef.current.removeChild(dragImageRef.current.firstChild);
            }

            // Create drag image
            const dragImage = document.createElement('div');
            dragImage.style.width = `${tool.defaults.size.width}px`;
            dragImage.style.height = `${tool.defaults.size.height}px`;
            dragImage.style.backgroundColor = tool.defaults.style.backgroundColor || '#ccc';
            dragImage.style.opacity = '0.5';

            // Append to our ref container instead of body
            dragImageRef.current.appendChild(dragImage);

            // Use the drag image
            e.dataTransfer.setDragImage(dragImage, 0, 0);
        }
    };

    // Handle element creation via drag and drop
    const handleToolClick = (tool) => {
        // Create a new element with default properties and a unique ID
        const newElement = {
            ...tool.defaults,
            id: uuidv4(),
            keyframes: []
        };

        // Add to canvas
        onAddElement(newElement);
    };

    return (
        <Paper
            sx={{
                width: '100%',
                height: '100%',
                p: 1,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                Инструменты
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <List sx={{ flexGrow: 1 }}>
                {tools.map((tool) => (
                    <Tooltip key={tool.id} title={`Добавить ${tool.label}`} placement="right">
                        <ListItem
                            button
                            draggable
                            onDragStart={(e) => handleDragStart(e, tool)}
                            onClick={() => handleToolClick(tool)}
                            sx={{
                                cursor: 'grab',
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                }
                            }}
                        >
                            <ListItemIcon>
                                {tool.icon}
                            </ListItemIcon>
                            <ListItemText primary={tool.label} />
                        </ListItem>
                    </Tooltip>
                ))}
            </List>

            <Divider sx={{ my: 2 }} />

            {/* ВРЕМЕННО: Кнопка для показа 3D модели - будет удалена позже */}
            <Button
                variant="outlined"
                startIcon={<ViewInAr />}
                onClick={() => setShowModelViewer(true)}
                sx={{ mb: 2 }}
            >
                Показать 3D модель
            </Button>

            <Box sx={{ mt: 'auto' }}>
                <Typography variant="caption" color="text.secondary">
                    Перетащите элемент на доску или кликните для добавления
                </Typography>
            </Box>

            {/* ВРЕМЕННО: Компонент ModelViewer - будет удален позже */}
            <ModelViewer
                isVisible={showModelViewer}
                onClose={() => setShowModelViewer(false)}
                playerDuration={60}
            />
        </Paper>
    );
};

export default ToolPanel; 