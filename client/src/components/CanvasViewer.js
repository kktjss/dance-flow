import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Paper, useTheme } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import ReactDOM from 'react-dom';
import CombinedViewer from './CombinedViewer';
import { fabric } from 'fabric';

const CanvasViewer = ({
    elements = [],
    currentTime,
    isPlaying,
    project = null
}) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const canvasId = useRef(`canvas-viewer-${Math.random().toString(36).substr(2, 9)}`);
    const buttonContainerRef = useRef(null);
    const [initialized, setInitialized] = useState(false);
    const [selected, setSelected] = useState(null);
    const [showCombinedViewer, setShowCombinedViewer] = useState(false);

    // Инициализация fabric.js canvas
    useEffect(() => {
        if (!containerRef.current) return;
        // Создаем контейнер для canvas
        const canvasContainer = document.createElement('div');
        canvasContainer.style.position = 'absolute';
        canvasContainer.style.top = '0';
        canvasContainer.style.left = '0';
        canvasContainer.style.width = '100%';
        canvasContainer.style.height = '100%';
        canvasContainer.style.pointerEvents = 'auto';
        containerRef.current.appendChild(canvasContainer);
        canvasContainerRef.current = canvasContainer;

        // Создаем canvas
        const canvas = document.createElement('canvas');
        canvas.id = canvasId.current;
        setTimeout(() => {
            canvas.width = canvasContainer.clientWidth;
            canvas.height = canvasContainer.clientHeight;
            canvasContainer.appendChild(canvas);
            // Инициализация fabric
            const fabricCanvas = new fabric.Canvas(canvasId.current, {
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight,
                backgroundColor: 'rgba(0,0,0,0)',
                preserveObjectStacking: true,
                selection: true
            });
            // Добавляем объекты
            elements.forEach((element, idx) => {
                let obj;
                const baseProps = {
                    left: element.position.x,
                    top: element.position.y,
                    selectable: true,
                    evented: true,
                    hasControls: false,
                    hasBorders: false,
                    opacity: typeof element.style?.opacity === 'number' ? element.style.opacity : 1
                };
                switch (element.type) {
                    case 'rectangle':
                        obj = new fabric.Rect({
                            ...baseProps,
                            width: element.size.width,
                            height: element.size.height,
                            fill: element.style.backgroundColor || '#cccccc',
                            stroke: element.style.borderColor || '#000000',
                            strokeWidth: element.style.borderWidth || 1
                        });
                        break;
                    case 'circle':
                        obj = new fabric.Circle({
                            ...baseProps,
                            radius: Math.min(element.size.width, element.size.height) / 2,
                            fill: element.style.backgroundColor || '#cccccc',
                            stroke: element.style.borderColor || '#000000',
                            strokeWidth: element.style.borderWidth || 1
                        });
                        break;
                    case 'text':
                        obj = new fabric.Text(element.content || 'Text', {
                            ...baseProps,
                            fontSize: element.size.height,
                            fill: element.style.color || '#000000'
                        });
                        break;
                    case 'image':
                        fabric.Image.fromURL(element.content, (img) => {
                            img.set({
                                ...baseProps,
                                scaleX: element.size.width / (img.width || 1),
                                scaleY: element.size.height / (img.height || 1)
                            });
                            img.data = { elementId: element.id, element };
                            fabricCanvas.add(img);
                        }, { crossOrigin: 'anonymous' });
                        break;
                    default:
                        break;
                }
                if (obj) {
                    obj.data = { elementId: element.id, element };
                    fabricCanvas.add(obj);
                }
            });
            // Настройки canvas
            fabricCanvas.selection = true;
            fabricCanvas.skipTargetFind = false;
            fabricCanvas.defaultCursor = 'pointer';
            fabricCanvas.hoverCursor = 'pointer';
            fabricCanvas.renderAll();
            // Обработчики выделения
            fabricCanvas.on('selection:created', (e) => {
                if (e.selected && e.selected.length > 0) {
                    const selectedObject = e.selected[0];
                    if (selectedObject.data && selectedObject.data.elementId) {
                        let element = elements.find(el => el.id === selectedObject.data.elementId);
                        if (element) setSelected(element);
                    }
                }
            });
            fabricCanvas.on('selection:updated', (e) => {
                if (e.selected && e.selected.length > 0) {
                    const selectedObject = e.selected[0];
                    if (selectedObject.data && selectedObject.data.elementId) {
                        let element = elements.find(el => el.id === selectedObject.data.elementId);
                        if (element) setSelected(element);
                    }
                }
            });
            fabricCanvas.on('selection:cleared', () => {
                setSelected(null);
            });
            setInitialized(true);
        }, 0);
        // Контейнер для кнопки
        const btnContainer = document.createElement('div');
        btnContainer.style.position = 'absolute';
        btnContainer.style.top = '0';
        btnContainer.style.left = '0';
        btnContainer.style.width = '100%';
        btnContainer.style.height = '100%';
        btnContainer.style.pointerEvents = 'none';
        btnContainer.style.zIndex = '10';
        containerRef.current.appendChild(btnContainer);
        buttonContainerRef.current = btnContainer;
        return () => {
            if (canvasContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(canvasContainerRef.current);
            }
            if (buttonContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(buttonContainerRef.current);
            }
        };
    }, [elements]);

    // Кнопка "Посмотреть 3D"
    const renderViewerButton = () => {
        if (!initialized || !buttonContainerRef.current) return null;
        if (!selected) return null;
        return ReactDOM.createPortal(
            <Box
                sx={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'auto',
                    zIndex: 100
                }}
            >
                <Paper
                    elevation={6}
                    sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                    }}
                >
                    <Button
                        variant="contained"
                        onClick={() => setShowCombinedViewer(true)}
                        startIcon={<PlayArrow />}
                        size="large"
                        sx={{
                            backgroundColor: 'primary.main',
                            color: 'white',
                            '&:hover': {
                                backgroundColor: 'primary.dark',
                            },
                            px: 3,
                            py: 1.5,
                            fontWeight: 'bold'
                        }}
                    >
                        Посмотреть 3D
                    </Button>
                </Paper>
            </Box>,
            buttonContainerRef.current
        );
    };

    return (
        <Box
            ref={containerRef}
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden'
            }}
        >
            {renderViewerButton()}
            {ReactDOM.createPortal(
                <CombinedViewer
                    isVisible={showCombinedViewer}
                    onClose={() => setShowCombinedViewer(false)}
                    videoUrl={project?.videoUrl}
                    playerDuration={project?.duration || 60}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    elementKeyframes={selected?.keyframes || []}
                    elementId={selected?.id}
                    glbAnimationUrl={selected?.modelPath}
                />, document.body
            )}
        </Box>
    );
};

export default CanvasViewer; 