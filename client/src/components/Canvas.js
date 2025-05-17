import React, { useEffect, useRef, useState, useCallback, createRef } from 'react';
import { fabric } from 'fabric';
import { Box, IconButton, Modal, Typography, Grid, Button, Tooltip, Paper, useTheme } from '@mui/material';
import {
    ContentCopy,
    Delete,
    Visibility,
    ThreeDRotation,
    Videocam,
    PlayArrow,
    Stop,
    FiberManualRecord,
    AddCircleOutline,
    Edit,
    DragIndicator,
    Save,
    FolderOpen,
    Upload,
    Close as CloseIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import ReactDOM from 'react-dom';
// ВРЕМЕННО: Импорты для 3D и видео просмотрщиков - будут удалены позже
import ModelViewer from './ModelViewer';
import VideoViewer from './VideoViewer';
import CombinedViewer from './CombinedViewer';
import { COLORS } from '../App';

// Выносим canvas полностью за пределы React-дерева
const fabricInstances = new Map();

const Canvas = ({
    elements = [],
    currentTime,
    isPlaying,
    onElementsChange,
    selectedElement,
    onElementSelect,
    readOnly = false,
    isRecordingKeyframes = false,
    project = null,
    onToggleRecording = null
}) => {
    const theme = useTheme();
    // Use elements as provided without a default element
    const effectiveElements = elements;

    const containerRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const canvasId = useRef(`canvas-${uuidv4()}`);
    const [initialized, setInitialized] = useState(false);
    const buttonContainerRef = useRef(null);
    // Сохраняем последние вычисленные позиции для каждого элемента
    const lastAnimatedPositionsRef = useRef({});

    // ВРЕМЕННО: Состояния для модальных окон 3D и видео - будут удалены позже
    const [showChoreoModal, setShowChoreoModal] = useState(false);
    const [viewMode, setViewMode] = useState('3d'); // '3d' or 'video'
    const [showCombinedViewer, setShowCombinedViewer] = useState(false);

    // Добавим специальную функцию для форсированного обновления позиций всех объектов
    const forceUpdateObjectPositions = useCallback(() => {
        if (!fabricInstances.has(canvasId.current)) return;

        const fabricCanvas = fabricInstances.get(canvasId.current);

        console.log('Force updating all object positions');

        // Обновляем позиции всех объектов согласно их данным - только если они отличаются
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.data && obj.data.element) {
                const element = obj.data.element;

                // Проверяем, есть ли у элемента ключевые кадры
                const hasKeyframes = element.keyframes && element.keyframes.length > 0;

                // Для элементов с ключевыми кадрами используем последние вычисленные позиции
                if (hasKeyframes && lastAnimatedPositionsRef.current[element.id]) {
                    const lastPos = lastAnimatedPositionsRef.current[element.id];

                    // Используем последнюю анимационную позицию, если она была вычислена для текущего времени
                    if (Math.abs(lastPos.time - currentTime) < 0.01) {
                        console.log(`Using last animated position for ${element.id} at time ${currentTime}: (${lastPos.x.toFixed(0)},${lastPos.y.toFixed(0)})`);

                        obj.set({
                            left: lastPos.x,
                            top: lastPos.y,
                            opacity: lastPos.opacity || element.style?.opacity || 1,
                            scaleX: lastPos.scale || 1,
                            scaleY: lastPos.scale || 1
                        });

                        // Обновляем координаты и завершаем обработку этого объекта
                        obj.setCoords();
                        return;
                    }
                }

                // Проверяем, есть ли у элемента позиция
                if (element.position) {
                    const currentX = element.position.x;
                    const currentY = element.position.y;

                    // Если элемент участвует в анимации и плеер активен, не обновляем его позицию принудительно
                    if (hasKeyframes && isPlaying) {
                        console.log(`Skipping force update for animated element ${element.id} - using keyframe animation`);
                    }
                    // Если перетаскивается активный элемент, не обновляем его позицию
                    else if (element.id === selectedElement?.id && fabricCanvas.getActiveObject() === obj) {
                        console.log(`Skipping force update for currently selected/manipulated element ${element.id}`);
                    }
                    // Если позиция объекта отличается от позиции в данных и не в анимации, обновляем
                    else if (obj.left !== currentX || obj.top !== currentY) {
                        console.log(`Updating position for element ${element.id}: (${obj.left},${obj.top}) -> (${currentX},${currentY})`);

                        // Устанавливаем позицию объекта
                        obj.set({
                            left: currentX,
                            top: currentY
                        });
                        obj.setCoords();
                    }
                }

                // Ensure object is still clickable
                obj.selectable = !readOnly;
                obj.evented = !readOnly;
                obj.hasControls = !readOnly;
                obj.hasBorders = !readOnly;
            }
        });

        // Отрисовываем холст только если были изменения
        fabricCanvas.renderAll();
    }, [canvasId, readOnly, isPlaying, currentTime, selectedElement]);

    // Инициализация canvas и контейнера
    useEffect(() => {
        if (!containerRef.current) return;

        // Создаем отдельный контейнер для canvas
        const canvasContainer = document.createElement('div');
        canvasContainer.id = `fabric-container-${canvasId.current}`;
        canvasContainer.style.position = 'absolute';
        canvasContainer.style.top = '0';
        canvasContainer.style.left = '0';
        canvasContainer.style.width = '100%';
        canvasContainer.style.height = '100%';
        canvasContainer.style.pointerEvents = readOnly ? 'none' : 'auto';
        containerRef.current.appendChild(canvasContainer);
        canvasContainerRef.current = canvasContainer;

        // Создаем canvas
        const canvas = document.createElement('canvas');
        canvas.id = canvasId.current;

        // Ждем, пока контейнер будет полностью инициализирован
        setTimeout(() => {
            canvas.width = canvasContainer.clientWidth;
            canvas.height = canvasContainer.clientHeight;
            canvasContainer.appendChild(canvas);

            // Create grid pattern for canvas background
            const gridSize = 20;
            const gridColor = theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.07)'
                : 'rgba(0, 0, 0, 0.04)';

            const backgroundColor = theme.palette.mode === 'dark'
                ? 'rgba(17, 21, 54, 0.1)' // More transparent
                : 'rgba(245, 245, 250, 0.1)'; // More transparent

            // Инициализируем Fabric
            const fabricCanvas = new fabric.Canvas(canvasId.current, {
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight,
                backgroundColor: 'rgba(0, 0, 0, 0)', // Make it transparent to show parent's grid
                preserveObjectStacking: true,
                selection: !readOnly,
                interactive: !readOnly
            });

            fabricInstances.set(canvasId.current, fabricCanvas);

            console.log('Canvas initialized with settings:', {
                readOnly,
                selection: !readOnly,
                interactive: !readOnly,
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight
            });

            // Set selection properties based on readOnly mode
            if (readOnly) {
                // Disable selection for readOnly mode
                fabricCanvas.selection = false;
                fabricCanvas.hoverCursor = 'default';
                fabricCanvas.defaultCursor = 'default';
            } else {
                // Ensure selection is enabled for editable mode
                fabricCanvas.selection = true;
                fabricCanvas.skipTargetFind = false;
                fabricCanvas.selectable = true;
                fabricCanvas.hoverCursor = 'move';
            }

            // Устанавливаем обработчики событий
            setupEventHandlers(fabricCanvas);

            // Добавляем обработчик клавиши Delete для удаления элементов
            const handleKeyDown = (e) => {
                if (!readOnly && e.key === 'Delete' && fabricCanvas.getActiveObject()) {
                    e.preventDefault();
                    handleDeleteElement();
                }
            };

            document.addEventListener('keydown', handleKeyDown);

            // Добавляем обработчик изменения размера окна
            const handleResize = () => {
                if (canvasContainer) {
                    const width = canvasContainer.clientWidth;
                    const height = canvasContainer.clientHeight;

                    // Сохраняем текущие объекты и их позиции
                    const objects = fabricCanvas.getObjects().filter(obj => !obj.data || !obj.data.isGridLine);
                    const oldWidth = fabricCanvas.width;
                    const oldHeight = fabricCanvas.height;

                    // Обновляем размеры canvas
                    canvas.width = width;
                    canvas.height = height;
                    fabricCanvas.setWidth(width);
                    fabricCanvas.setHeight(height);

                    // Масштабируем позиции объектов
                    objects.forEach(obj => {
                        const scaleX = width / oldWidth;
                        const scaleY = height / oldHeight;

                        obj.set({
                            left: obj.left * scaleX,
                            top: obj.top * scaleY,
                            scaleX: obj.scaleX * scaleX,
                            scaleY: obj.scaleY * scaleY
                        });
                    });

                    fabricCanvas.renderAll();
                }
            };

            window.addEventListener('resize', handleResize);
            setInitialized(true);

            // Очистка при размонтировании
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('resize', handleResize);
                if (fabricInstances.has(canvasId.current)) {
                    const instance = fabricInstances.get(canvasId.current);
                    instance.dispose();
                    fabricInstances.delete(canvasId.current);
                }
            };
        }, 0);

        // Создаем контейнер для кнопок (для всех режимов)
        const btnContainer = document.createElement('div');
        btnContainer.id = `btn-container-${canvasId.current}`;
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
            // Удаляем DOM элементы
            if (canvasContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(canvasContainerRef.current);
            }

            if (buttonContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(buttonContainerRef.current);
            }
        };
    }, [readOnly]);

    // Функция установки обработчиков событий
    const setupEventHandlers = useCallback((fabricCanvas) => {
        if (!fabricCanvas) return;

        // Очищаем существующие обработчики
        fabricCanvas.off();

        // Skip event handlers in readOnly mode
        if (readOnly) return;

        // Обработчик модификации объекта
        fabricCanvas.on('object:modified', (e) => {
            const modifiedObject = e.target;
            console.log('Object modified event fired');

            if (!modifiedObject || !modifiedObject.data || !modifiedObject.data.elementId) {
                console.warn('Modified object is missing data or elementId');
                return;
            }

            const elementId = modifiedObject.data.elementId;
            console.log('Modified element ID:', elementId);

            // Check if effectiveElements exists and has items
            if (!effectiveElements || effectiveElements.length === 0) {
                console.warn('No elements available in the elements array');
                return;
            }

            const element = effectiveElements.find(el => el.id === elementId);

            if (!element) {
                console.warn('Element not found in elements array:', elementId);
                return;
            }

            console.log('Found element in array:', element.id);
            console.log('Current element position:', element.position);
            console.log('Modified object position:', { left: modifiedObject.left, top: modifiedObject.top });

            // Create updated array of elements
            let updatedElements;

            // If recording keyframes is active, update keyframes
            if (isRecordingKeyframes) {
                console.log('Recording keyframe mode is active, creating keyframe');

                // Create properties for the keyframe
                const keyframeProps = {
                    time: currentTime,
                    position: {
                        x: modifiedObject.left,
                        y: modifiedObject.top
                    },
                    opacity: modifiedObject.opacity || 1,
                    scale: modifiedObject.scaleX || 1
                };

                console.log('Creating keyframe with time:', currentTime, 'props:', keyframeProps);

                // Add or update the keyframe
                const updatedElement = addOrUpdateKeyframe(
                    element,
                    currentTime,
                    keyframeProps
                );

                console.log('Updated element keyframes count:', updatedElement.keyframes?.length || 0);

                // Update the elements array
                updatedElements = effectiveElements.map(elem =>
                    elem.id === elementId ? updatedElement : elem
                );

                // При создании ключевого кадра, принудительно обновляем визуальное отображение объекта
                setTimeout(() => {
                    if (fabricInstances.has(canvasId.current)) {
                        const fabricCanvas = fabricInstances.get(canvasId.current);
                        if (fabricCanvas) {
                            // Найдем объект на холсте
                            const objToUpdate = fabricCanvas.getObjects().find(
                                obj => obj.data && obj.data.elementId === elementId
                            );

                            if (objToUpdate) {
                                // Обновим объект с новыми координатами
                                objToUpdate.set({
                                    left: modifiedObject.left,
                                    top: modifiedObject.top,
                                    opacity: modifiedObject.opacity || 1,
                                    scaleX: modifiedObject.scaleX || 1,
                                    scaleY: modifiedObject.scaleY || 1
                                });
                                objToUpdate.setCoords();

                                // Обновляем кэш анимированных позиций для этого элемента
                                if (!lastAnimatedPositionsRef.current[elementId]) {
                                    lastAnimatedPositionsRef.current[elementId] = {};
                                }

                                lastAnimatedPositionsRef.current[elementId] = {
                                    x: modifiedObject.left,
                                    y: modifiedObject.top,
                                    opacity: modifiedObject.opacity || 1,
                                    scale: modifiedObject.scaleX || 1,
                                    time: currentTime
                                };

                                fabricCanvas.renderAll();
                                console.log('Forced visual update of object after keyframe creation');
                            }
                        }
                    }
                }, 10);
            } else {
                console.log('Recording keyframe mode is NOT active, updating base properties');

                // Update base properties while preserving keyframes
                updatedElements = effectiveElements.map(elem => {
                    if (elem.id === elementId) {
                        return {
                            ...elem,
                            position: {
                                x: modifiedObject.left,
                                y: modifiedObject.top
                            },
                            size: {
                                width: modifiedObject.width * (modifiedObject.scaleX || 1),
                                height: modifiedObject.height * (modifiedObject.scaleY || 1)
                            },
                            style: {
                                ...elem.style,
                                opacity: modifiedObject.opacity || 1
                            },
                            keyframes: elem.keyframes || [] // Preserve existing keyframes
                        };
                    }
                    return elem;
                });
            }

            // Notify parent component of changes
            if (onElementsChange) {
                console.log('Notifying parent of element changes');
                onElementsChange(updatedElements);
            }
        });

        // Обработчик выбора элемента
        fabricCanvas.on('selection:created', (e) => {
            console.log('Selection created event fired', e);
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];
                console.log('Selected object:', selectedObject);

                // Стандартная обработка выбора объекта
                if (selectedObject.data && selectedObject.data.elementId) {
                    let element = effectiveElements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
                        // If the object has model info but the element doesn't, update the element
                        if (selectedObject.has3DModel && selectedObject.modelPath &&
                            (!element.has3DModel || !element.modelPath)) {
                            console.log(`Updating element ${element.id} with model info from object`);
                            element = {
                                ...element,
                                has3DModel: true,
                                modelPath: selectedObject.modelPath
                            };
                        }

                        console.log('Found matching element in data:', element.id);
                        setTimeout(() => {
                            onElementSelect(element);
                        }, 0);
                    } else {
                        console.warn('No matching element found for selected object:', selectedObject.data.elementId);
                    }
                } else {
                    console.warn('Selected object has no data or elementId');
                }
            } else {
                console.warn('Selection event has no selected objects');
            }
        });

        fabricCanvas.on('selection:updated', (e) => {
            console.log('Selection updated event fired', e);
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];

                // Стандартная обработка выбора объекта
                if (selectedObject.data && selectedObject.data.elementId) {
                    let element = effectiveElements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
                        // If the object has model info but the element doesn't, update the element
                        if (selectedObject.has3DModel && selectedObject.modelPath &&
                            (!element.has3DModel || !element.modelPath)) {
                            console.log(`Updating element ${element.id} with model info from object`);
                            element = {
                                ...element,
                                has3DModel: true,
                                modelPath: selectedObject.modelPath
                            };
                        }

                        console.log('Selection updated to element:', element.id);
                        setTimeout(() => {
                            onElementSelect(element);
                        }, 0);
                    }
                }
            }
        });

        fabricCanvas.on('selection:cleared', () => {
            console.log('Selection cleared event fired');
            setTimeout(() => {
                onElementSelect(null);
            }, 0);
        });

        // Add mouse:down event to debug selection issues
        fabricCanvas.on('mouse:down', (e) => {
            console.log('Mouse down event:', e);
            if (e.target) {
                console.log('Clicked on object:', e.target);
            } else {
                console.log('Clicked on canvas background');
            }
        });

        // Handle object movement
        fabricCanvas.on('object:moving', (e) => {
            const movingObject = e.target;
            const elementId = movingObject.data?.elementId;
            console.log('Object moving:', elementId);

            // Если объект имеет ключевые кадры и мы не в режиме записи, обновляем текущую позицию в кэше
            if (elementId) {
                const element = effectiveElements.find(el => el.id === elementId);
                if (element && element.keyframes && element.keyframes.length > 0 && !isRecordingKeyframes) {
                    // Обновляем кэш для улучшения отзывчивости при перетаскивании
                    if (!lastAnimatedPositionsRef.current[elementId]) {
                        lastAnimatedPositionsRef.current[elementId] = {};
                    }

                    lastAnimatedPositionsRef.current[elementId] = {
                        ...lastAnimatedPositionsRef.current[elementId],
                        x: movingObject.left,
                        y: movingObject.top,
                        time: currentTime
                    };
                }
            }
        });

        // Handle object scaling
        fabricCanvas.on('object:scaling', (e) => {
            const scalingObject = e.target;
            const elementId = scalingObject.data?.elementId;
            console.log('Object scaling:', elementId);

            // Если объект имеет ключевые кадры и мы не в режиме записи, обновляем текущий масштаб в кэше
            if (elementId) {
                const element = effectiveElements.find(el => el.id === elementId);
                if (element && element.keyframes && element.keyframes.length > 0 && !isRecordingKeyframes) {
                    // Обновляем кэш для улучшения отзывчивости при изменении размера
                    if (!lastAnimatedPositionsRef.current[elementId]) {
                        lastAnimatedPositionsRef.current[elementId] = {};
                    }

                    lastAnimatedPositionsRef.current[elementId] = {
                        ...lastAnimatedPositionsRef.current[elementId],
                        scale: scalingObject.scaleX || 1,
                        time: currentTime
                    };
                }
            }
        });

        // Handle object modification complete
        fabricCanvas.on('object:modified', (e) => {
            if (!e.target) return;
            console.log('Object modified:', e.target.data?.elementId);
            // No need to update 3D indicators - they've been removed
        });
    }, [effectiveElements, currentTime, isRecordingKeyframes, onElementsChange, onElementSelect, readOnly]);

    // Функция для применения эффектов анимации
    const applyAnimationEffects = useCallback((fabricObject, element) => {
        // Safety checks for element and fabricObject
        if (!element || !fabricObject) {
            console.warn('Cannot apply animation: element or fabricObject is null');
            return;
        }

        // Если нет ключевых кадров, не выполняем дополнительных действий
        if (!element.keyframes || element.keyframes.length === 0) {
            return;
        }

        console.log(`Applying animation to ${element.type} element ${element.id} at time ${currentTime}`, {
            elementVisible: element.visible,
            elementOpacity: element.style?.opacity,
            objectVisible: fabricObject.visible,
            objectOpacity: fabricObject.opacity,
            hasModelPath: !!element.modelPath,
            modelPath: element.modelPath || 'none',
            has3DModel: !!element.has3DModel,
            position: element.position
        });

        // Интерполируем свойства анимации
        let currentX = element.position?.x || 0;
        let currentY = element.position?.y || 0;
        let currentOpacity = element.style?.opacity !== undefined ? element.style.opacity : 1;
        let currentScale = 1;

        // Проверяем, есть ли сохраненная позиция для этого кадра при скраббинге
        const lastPos = lastAnimatedPositionsRef.current[element.id];
        if (lastPos && Math.abs(lastPos.time - currentTime) < 0.01 && !isPlaying) {
            console.log(`Using cached position for element ${element.id} at time ${currentTime}: (${lastPos.x.toFixed(0)},${lastPos.y.toFixed(0)})`);

            // Используем кэшированную позицию
            currentX = lastPos.x;
            currentY = lastPos.y;
            currentOpacity = lastPos.opacity;
            currentScale = lastPos.scale;
        } else {
            // Find the keyframes before and after the current time
            const sortedKeyframes = [...element.keyframes].sort((a, b) => a.time - b.time);

            let prevKeyframe = null;
            let nextKeyframe = null;

            for (let i = 0; i < sortedKeyframes.length; i++) {
                if (sortedKeyframes[i].time <= currentTime) {
                    prevKeyframe = sortedKeyframes[i];
                } else {
                    nextKeyframe = sortedKeyframes[i];
                    break;
                }
            }

            // If we're before the first keyframe, use the first keyframe
            if (!prevKeyframe && sortedKeyframes.length > 0) {
                prevKeyframe = sortedKeyframes[0];
            }

            // If we're after the last keyframe, use the last keyframe
            if (!nextKeyframe && sortedKeyframes.length > 0) {
                nextKeyframe = sortedKeyframes[sortedKeyframes.length - 1];

                // If we're exactly at or after the last keyframe, use its exact position
                if (prevKeyframe === nextKeyframe) {
                    currentX = nextKeyframe.position.x;
                    currentY = nextKeyframe.position.y;
                    currentOpacity = nextKeyframe.opacity !== undefined ? nextKeyframe.opacity : 1;
                    currentScale = nextKeyframe.scale || 1;

                    console.log(`At final keyframe position at time ${nextKeyframe.time}: (${currentX},${currentY})`);
                }
            }

            // Если есть keyframes для интерполяции
            if (prevKeyframe && nextKeyframe && prevKeyframe !== nextKeyframe) {
                // Calculate progress between keyframes
                const keyframeDuration = nextKeyframe.time - prevKeyframe.time;
                const progress = keyframeDuration > 0 ? (currentTime - prevKeyframe.time) / keyframeDuration : 0;

                // Интерполируем позицию
                if (prevKeyframe.position && nextKeyframe.position) {
                    const prevX = prevKeyframe.position.x;
                    const prevY = prevKeyframe.position.y;
                    const nextX = nextKeyframe.position.x;
                    const nextY = nextKeyframe.position.y;
                    currentX = prevX + (nextX - prevX) * progress;
                    currentY = prevY + (nextY - prevY) * progress;
                    console.log(`Interpolating position: progress=${progress.toFixed(2)}, (${prevX},${prevY}) to (${nextX},${nextY}) = (${currentX.toFixed(0)},${currentY.toFixed(0)})`);
                }

                // Интерполируем прозрачность
                const prevOpacity = prevKeyframe.opacity !== undefined ? prevKeyframe.opacity : 1;
                const nextOpacity = nextKeyframe.opacity !== undefined ? nextKeyframe.opacity : 1;
                currentOpacity = prevOpacity + (nextOpacity - prevOpacity) * progress;

                // Интерполируем масштаб
                const prevScale = prevKeyframe.scale || 1;
                const nextScale = nextKeyframe.scale || 1;
                currentScale = prevScale + (nextScale - prevScale) * progress;
            } else if (prevKeyframe) {
                // Используем значения текущего keyframe если нет следующего
                if (prevKeyframe.position) {
                    currentX = prevKeyframe.position.x;
                    currentY = prevKeyframe.position.y;
                    console.log(`Using keyframe position at time ${prevKeyframe.time}: (${currentX},${currentY})`);
                }
                if (prevKeyframe.opacity !== undefined) {
                    currentOpacity = prevKeyframe.opacity;
                }
                if (prevKeyframe.scale) {
                    currentScale = prevKeyframe.scale;
                }
            }
        }

        // Сохраняем текущую вычисленную анимационную позицию для этого элемента
        if (!lastAnimatedPositionsRef.current[element.id]) {
            lastAnimatedPositionsRef.current[element.id] = {};
        }

        lastAnimatedPositionsRef.current[element.id] = {
            x: currentX,
            y: currentY,
            opacity: currentOpacity,
            scale: currentScale,
            time: currentTime
        };

        // Проверяем, изменились ли свойства объекта
        const positionChanged = Math.abs(fabricObject.left - currentX) > 0.1 || Math.abs(fabricObject.top - currentY) > 0.1;
        const opacityChanged = Math.abs(fabricObject.opacity - currentOpacity) > 0.01;
        const scaleChanged = Math.abs(fabricObject.scaleX - currentScale) > 0.01 || Math.abs(fabricObject.scaleY - currentScale) > 0.01;

        // Применяем свойства только если они изменились
        if (positionChanged || opacityChanged || scaleChanged) {
            const props = {
                left: currentX,
                top: currentY,
                opacity: currentOpacity,
                scaleX: currentScale,
                scaleY: currentScale,
                visible: true // Explicitly ensure visibility
            };

            fabricObject.set(props);
            fabricObject.setCoords(); // Update the corner coordinates

            // Выводим отладочную информацию при изменении свойств
            console.log(`Properties changed for ${element.id}: position=(${currentX},${currentY}), opacity=${currentOpacity}, scale=${currentScale}`);
        }

        // Ensure the object is clickable
        fabricObject.selectable = !readOnly;
        fabricObject.evented = !readOnly;
        fabricObject.hasControls = !readOnly;
        fabricObject.hasBorders = !readOnly;

        console.log(`Applied properties: x=${currentX}, y=${currentY}, opacity=${currentOpacity}, scale=${currentScale}, selectable=${fabricObject.selectable}`);
    }, [currentTime, readOnly, isPlaying, lastAnimatedPositionsRef]);

    // Функция добавления или обновления keyframe
    const addOrUpdateKeyframe = (element, time, properties = {}) => {
        console.log('Adding/updating keyframe:', { elementId: element.id, time, properties });

        // Validate input
        if (!element || !element.id) {
            console.error('Invalid element in addOrUpdateKeyframe:', element);
            return element;
        }

        if (typeof time !== 'number' || isNaN(time)) {
            console.error('Invalid time in addOrUpdateKeyframe:', time);
            return element;
        }

        // Ensure properties are valid
        const validProperties = {
            time,
            position: {
                x: typeof properties.position?.x === 'number' ? properties.position.x : 0,
                y: typeof properties.position?.y === 'number' ? properties.position.y : 0
            },
            opacity: typeof properties.opacity === 'number' ? properties.opacity : 1,
            scale: typeof properties.scale === 'number' ? properties.scale : 1
        };

        // Create a new array of keyframes
        let updatedKeyframes = Array.isArray(element.keyframes) ? [...element.keyframes] : [];

        // Find existing keyframe at this time
        const existingIndex = updatedKeyframes.findIndex(kf => kf.time === time);

        if (existingIndex !== -1) {
            // Update existing keyframe
            updatedKeyframes[existingIndex] = {
                ...updatedKeyframes[existingIndex],
                ...validProperties
            };
            console.log('Updated existing keyframe at time:', time);
        } else {
            // Add new keyframe
            updatedKeyframes.push(validProperties);
            console.log('Added new keyframe at time:', time);
        }

        // Sort keyframes by time
        updatedKeyframes.sort((a, b) => a.time - b.time);

        // Create updated element
        const updatedElement = {
            ...element,
            keyframes: updatedKeyframes
        };

        // Когда добавляется первый ключевой кадр, обновляем также базовую позицию элемента
        // для корректного отображения на холсте
        if (updatedKeyframes.length === 1) {
            console.log('First keyframe added, updating base position of element');
            updatedElement.position = {
                x: validProperties.position.x,
                y: validProperties.position.y
            };

            // Очищаем кэш анимированных позиций для этого элемента
            if (lastAnimatedPositionsRef.current[element.id]) {
                delete lastAnimatedPositionsRef.current[element.id];
            }
        }

        console.log('Updated element keyframes count:', updatedKeyframes.length);
        return updatedElement;
    };

    // Функция дублирования выбранного элемента
    const handleDuplicateElement = useCallback(() => {
        if (!selectedElement) return;

        // Создаем глубокую копию выбранного элемента
        const duplicatedElement = JSON.parse(JSON.stringify(selectedElement));

        // Генерируем новый ID для дублированного элемента
        duplicatedElement.id = uuidv4();

        // Сдвигаем позицию чтобы было видно
        duplicatedElement.position = {
            x: duplicatedElement.position.x + 20,
            y: duplicatedElement.position.y + 20
        };

        // Обновляем позиции всех keyframes
        if (duplicatedElement.keyframes && duplicatedElement.keyframes.length > 0) {
            duplicatedElement.keyframes.forEach(keyframe => {
                if (keyframe.position) {
                    keyframe.position.x += 20;
                    keyframe.position.y += 20;
                }
            });
        }

        // Добавляем дублированный элемент в массив элементов
        const updatedElements = [...effectiveElements, duplicatedElement];
        onElementsChange(updatedElements);

        // Выбираем новый элемент
        onElementSelect(duplicatedElement);
    }, [effectiveElements, selectedElement, onElementsChange, onElementSelect]);

    // Функция удаления выбранного элемента
    const handleDeleteElement = useCallback(() => {
        if (!selectedElement) return;

        // Создаем новый массив элементов без удаляемого элемента
        const updatedElements = effectiveElements.filter(elem => elem.id !== selectedElement.id);

        // Обновляем состояние
        onElementsChange(updatedElements);

        // Снимаем выделение
        onElementSelect(null);

        // Обновляем canvas
        if (fabricInstances.has(canvasId.current)) {
            const fabricCanvas = fabricInstances.get(canvasId.current);
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
        }
    }, [effectiveElements, selectedElement, onElementsChange, onElementSelect, canvasId]);

    // Обновляем canvas при изменении элементов или времени
    useEffect(() => {
        if (!initialized || !fabricInstances.has(canvasId.current)) return;

        const fabricCanvas = fabricInstances.get(canvasId.current);

        // Ensure event handlers are properly set up
        setupEventHandlers(fabricCanvas);

        // Используем requestAnimationFrame для обеспечения синхронизации с рендерингом браузера
        const updateCanvas = () => {
            try {
                if (!fabricCanvas || !initialized) {
                    console.warn('Canvas not initialized yet');
                    return;
                }

                // Check if elements is defined and is an array
                if (!effectiveElements) {
                    console.warn('Elements array is undefined');
                    fabricCanvas.clear();
                    fabricCanvas.backgroundColor = 'rgba(0, 0, 0, 0)';
                    fabricCanvas.renderAll();
                    return;
                }

                if (!Array.isArray(effectiveElements)) {
                    console.error('Elements is not an array:', effectiveElements);
                    fabricCanvas.clear();
                    fabricCanvas.backgroundColor = 'rgba(0, 0, 0, 0)';
                    fabricCanvas.renderAll();
                    return;
                }

                // Check for valid elements with required fields
                const validElements = effectiveElements.filter(el => el && el.id && el.type && el.position);

                if (validElements.length === 0) {
                    console.error('No valid elements found with required fields (id, type, position)');
                    if (effectiveElements.length > 0) {
                        console.error('Found elements but they are invalid:',
                            effectiveElements.map(el => ({ id: el?.id || 'undefined', type: el?.type || 'undefined' })));
                    }

                    // Clear the canvas
                    fabricCanvas.clear();
                    fabricCanvas.backgroundColor = 'rgba(0, 0, 0, 0)';
                    fabricCanvas.renderAll();
                    return;
                }

                // Debug info
                console.log(`Canvas update: found ${effectiveElements.length} elements, ${validElements.length} valid`);

                // Log all element types to debug
                effectiveElements.forEach((el, i) => {
                    console.log(`Element ${i}: id=${el?.id || 'undefined'}, type=${el?.type || 'undefined'}, originalType=${el?.originalType || 'none'}`);
                });

                // Store current objects for later comparison
                const existingObjects = fabricCanvas.getObjects();
                const existingObjectsMap = new Map();
                existingObjects.forEach(obj => {
                    if (obj.data && obj.data.elementId) {
                        existingObjectsMap.set(obj.data.elementId, obj);
                    }

                    // Remove any modelIcon if exists
                    if (obj.modelIcon) {
                        fabricCanvas.remove(obj.modelIcon);
                        delete obj.modelIcon;
                    }
                });

                // Track new objects to add
                const objectsToAdd = [];
                const imageLoadPromises = [];

                // Use only valid elements for rendering
                validElements.forEach((element, index) => {
                    console.log(`Processing element ${index}: id=${element.id}, type=${element.type}, pos=(${element.position?.x},${element.position?.y})`);

                    // Ensure elements with modelPath have has3DModel flag instead of changing type
                    if (element.modelPath && !element.has3DModel) {
                        console.log(`Element ${element.id} has modelPath but no has3DModel flag, adding flag`);
                        element.has3DModel = true;
                        // Сохраняем оригинальный тип, если его еще нет
                        if (!element.originalType) {
                            element.originalType = element.type;
                        }
                    }

                    // Ensure position exists and has valid values
                    if (!element.position || typeof element.position.x !== 'number' || typeof element.position.y !== 'number') {
                        console.warn(`Element ${element.id} has invalid position:`, element.position);
                        element.position = { x: 100 + (index * 50), y: 100 + (index * 50) };
                    }

                    // Проверяем должен ли элемент быть видимым в текущее время
                    const startTime = element.animation?.startTime || 0;
                    const endTime = element.animation?.endTime;

                    if (currentTime >= startTime && (endTime === null || endTime === undefined || currentTime <= endTime)) {
                        // Check if this element already exists on canvas
                        let fabricObject = existingObjectsMap.get(element.id);

                        // If object exists, update it with animation effects
                        if (fabricObject) {
                            console.log(`Updating existing element ${element.id} on canvas`);

                            // Update position and other properties from element data
                            fabricObject.set({
                                left: element.position.x,
                                top: element.position.y,
                                width: element.size?.width,
                                height: element.size?.height,
                                opacity: element.style?.opacity || 1,
                                visible: true
                            });

                            // Update the element reference in case it changed
                            fabricObject.data = {
                                elementId: element.id,
                                element: element
                            };

                            // Apply animation effects to the existing object
                            applyAnimationEffects(fabricObject, element);

                            // Remove from map to track which objects need to be kept
                            existingObjectsMap.delete(element.id);
                        } else {
                            // Element doesn't exist yet, create it
                            console.log(`Creating new element ${element.id} on canvas`);

                            // Check if element has a 3D model
                            const has3DModel = element.modelPath || element.has3DModel;
                            if (has3DModel) {
                                console.log(`Element ${element.id} is a 3D element or has a 3D model path: ${element.modelPath || 'none'}`);

                                // Store the model path information even if we don't display visual indicators
                                if (element.modelPath) {
                                    console.log(`Element ${element.id} has model path: ${element.modelPath}`);
                                }
                            }

                            // Создаем fabric объект на основе типа элемента
                            switch (element.type) {
                                case 'rectangle':
                                    console.log(`Creating rectangle element: id=${element.id}, pos=(${element.position.x},${element.position.y})`);
                                    fabricObject = new fabric.Rect({
                                        left: element.position.x,
                                        top: element.position.y,
                                        width: element.size.width,
                                        height: element.size.height,
                                        fill: element.style.backgroundColor || '#cccccc',
                                        stroke: element.style.borderColor || '#000000',
                                        strokeWidth: element.style.borderWidth || 1,
                                        opacity: typeof element.style.opacity === 'number' ? element.style.opacity : 1,
                                        selectable: !readOnly,
                                        hasControls: !readOnly,
                                        hasBorders: !readOnly
                                    });

                                    // Save element data
                                    fabricObject.data = {
                                        elementId: element.id,
                                        element: element
                                    };

                                    // Apply animation effects
                                    applyAnimationEffects(fabricObject, element);

                                    // Add to list of objects to add to canvas
                                    objectsToAdd.push(fabricObject);

                                    // Log if element has 3D model but don't add any visual indicators
                                    if (has3DModel) {
                                        console.log(`Element ${element.id} has a 3D model (no visual indicator added)`);

                                        // Even though we don't show visual indicators, we need to store model info
                                        fabricObject.has3DModel = true;
                                        fabricObject.modelPath = element.modelPath;
                                    }
                                    break;

                                case 'circle':
                                    console.log(`Creating circle element: id=${element.id}, pos=(${element.position.x},${element.position.y})`);
                                    fabricObject = new fabric.Circle({
                                        left: element.position.x,
                                        top: element.position.y,
                                        radius: Math.min(element.size.width, element.size.height) / 2,
                                        fill: element.style.backgroundColor || '#cccccc',
                                        stroke: element.style.borderColor || '#000000',
                                        strokeWidth: element.style.borderWidth || 1,
                                        opacity: typeof element.style.opacity === 'number' ? element.style.opacity : 1,
                                        selectable: !readOnly,
                                        hasControls: !readOnly,
                                        hasBorders: !readOnly
                                    });

                                    // Save element data
                                    fabricObject.data = {
                                        elementId: element.id,
                                        element: element
                                    };

                                    // Apply animation effects
                                    applyAnimationEffects(fabricObject, element);

                                    // Add to list of objects to add to canvas
                                    objectsToAdd.push(fabricObject);

                                    // Log if element has 3D model but don't add any visual indicators
                                    if (has3DModel) {
                                        console.log(`Element ${element.id} has a 3D model (no visual indicator added)`);

                                        // Even though we don't show visual indicators, we need to store model info
                                        fabricObject.has3DModel = true;
                                        fabricObject.modelPath = element.modelPath;
                                    }
                                    break;

                                case 'text':
                                    console.log(`Creating text element: id=${element.id}, content=${element.content ? element.content.substring(0, 20) : 'empty'}`);
                                    fabricObject = new fabric.Text(element.content || 'Text', {
                                        left: element.position.x,
                                        top: element.position.y,
                                        fontSize: element.size.height,
                                        fill: element.style.color || '#000000',
                                        opacity: typeof element.style.opacity === 'number' ? element.style.opacity : 1,
                                        selectable: !readOnly,
                                        hasControls: !readOnly,
                                        hasBorders: !readOnly
                                    });

                                    // Save element data
                                    fabricObject.data = {
                                        elementId: element.id,
                                        element: element
                                    };

                                    // Apply animation effects
                                    applyAnimationEffects(fabricObject, element);

                                    // Add to list of objects to add to canvas
                                    objectsToAdd.push(fabricObject);

                                    // Log if element has 3D model but don't add any visual indicators
                                    if (has3DModel) {
                                        console.log(`Element ${element.id} has a 3D model (no visual indicator added)`);

                                        // Store the model metadata on the object for retrieval later
                                        fabricObject.has3DModel = true;
                                        fabricObject.modelPath = element.modelPath;
                                    }
                                    break;

                                case '3d':
                                    // Этот блок больше не нужен, так как мы обрабатываем 3D модели для каждого типа элемента
                                    // Для совместимости со старыми данными, создадим прямоугольник
                                    console.log(`Converting legacy 3D element to rectangle: id=${element.id}, pos=(${element.position.x},${element.position.y})`);

                                    fabricObject = new fabric.Rect({
                                        left: element.position.x,
                                        top: element.position.y,
                                        width: element.size?.width || 100,
                                        height: element.size?.height || 100,
                                        fill: element.style?.backgroundColor || '#cccccc',
                                        stroke: element.style?.borderColor || '#000000',
                                        strokeWidth: element.style?.borderWidth || 1,
                                        opacity: typeof element.style?.opacity === 'number' ? element.style.opacity : 1,
                                        selectable: !readOnly,
                                        hasControls: !readOnly,
                                        hasBorders: !readOnly
                                    });

                                    // Save element data
                                    fabricObject.data = {
                                        elementId: element.id,
                                        element: element
                                    };

                                    // Apply animation effects
                                    applyAnimationEffects(fabricObject, element);

                                    // Add to list of objects to add to canvas
                                    objectsToAdd.push(fabricObject);

                                    console.log(`Added legacy 3D model element ${element.id} (converted to rectangle) at position (${element.position.x}, ${element.position.y})`);

                                    break;

                                case 'image':
                                    console.log(`Creating image element: id=${element.id}, content=${element.content ? element.content.substring(0, 20) : 'empty'}`);

                                    // For images, we need to load them asynchronously
                                    const promise = new Promise((resolve) => {
                                        fabric.Image.fromURL(element.content, (img) => {
                                            img.set({
                                                left: element.position.x,
                                                top: element.position.y,
                                                selectable: !readOnly,
                                                hasControls: !readOnly,
                                                hasBorders: !readOnly,
                                                opacity: typeof element.style?.opacity === 'number' ? element.style.opacity : 1,
                                                visible: true // Explicitly ensure visibility
                                            });

                                            // Scale image if size is specified
                                            if (element.size && element.size.width && element.size.height) {
                                                img.scaleToWidth(element.size.width);
                                                img.scaleToHeight(element.size.height);
                                            }

                                            // Save element data
                                            img.data = {
                                                elementId: element.id,
                                                element: element
                                            };

                                            // Проверяем, есть ли у элемента 3D модель
                                            if (element.modelPath || element.has3DModel) {
                                                console.log(`Element ${element.id} has 3D model: ${element.modelPath || 'has3DModel flag'}`, {
                                                    elementVisible: element.visible,
                                                    elementOpacity: element.style?.opacity,
                                                    imgVisible: img.visible,
                                                    imgOpacity: img.opacity,
                                                    has3DModel: element.has3DModel
                                                });

                                                // Log but don't add visual indicators
                                                console.log(`Image element ${element.id} has a 3D model (no visual indicator added)`);

                                                // Store the model metadata on the image object for retrieval later
                                                img.has3DModel = true;
                                                img.modelPath = element.modelPath;
                                            }

                                            // Применяем эффекты анимации на основе keyframes
                                            applyAnimationEffects(img, element);

                                            fabricCanvas.add(img);
                                            console.log(`Added image element ${element.id} to canvas`);
                                            resolve();
                                        }, { crossOrigin: 'anonymous' });
                                    });

                                    imageLoadPromises.push(promise);
                                    return; // Пропускаем остальное для изображений

                                default:
                                    console.error(`Unknown element type: "${element.type}" for element id=${element.id}`);
                                    return;
                            }
                        }
                    }
                });

                // Remove objects that are no longer in the elements list
                existingObjectsMap.forEach(obj => {
                    console.log(`Removing object with ID ${obj.data.elementId} from canvas`);

                    // Remove any associated model icon if it exists
                    if (obj.modelIcon) {
                        console.log(`Removing 3D model icon for element ${obj.data.elementId}`);
                        fabricCanvas.remove(obj.modelIcon);
                    }

                    fabricCanvas.remove(obj);
                });

                // Add new objects to canvas
                objectsToAdd.forEach(obj => {
                    // Ensure object is selectable
                    obj.selectable = !readOnly;
                    obj.hasControls = !readOnly;
                    obj.hasBorders = !readOnly;

                    fabricCanvas.add(obj);
                    console.log(`Added ${obj.type} element ${obj.data.elementId} to canvas with selectable=${obj.selectable}`);

                    // Log if element has 3D model but don't add any visual indicators
                    const element = obj.data.element;
                    if (element && (element.modelPath || element.has3DModel) && !obj.modelIcon) {
                        console.log(`Element ${element.id} has a 3D model (no visual indicator added)`);

                        // Store the model metadata on the object for retrieval later
                        obj.has3DModel = true;
                        obj.modelPath = element.modelPath;
                    }
                });

                // Restore event handlers
                setupEventHandlers(fabricCanvas);

                // Render after all images are loaded
                Promise.all(imageLoadPromises).then(() => {
                    try {
                        // Select active element
                        if (selectedElement) {
                            const objects = fabricCanvas.getObjects();
                            console.log(`Searching for selected element ${selectedElement.id} among ${objects.length} canvas objects`);

                            const objectToSelect = objects.find(obj =>
                                obj.data && obj.data.elementId === selectedElement.id
                            );

                            if (objectToSelect) {
                                console.log(`Found and selecting element ${selectedElement.id} on canvas`);
                                fabricCanvas.setActiveObject(objectToSelect);
                            } else {
                                console.warn(`Could not find selected element ${selectedElement.id} on canvas`);
                            }
                        }

                        // Log all objects on canvas
                        const objects = fabricCanvas.getObjects();
                        console.log(`Canvas render complete. Total objects on canvas: ${objects.length}`);
                        objects.forEach((obj, idx) => {
                            console.log(`Canvas object ${idx}: type=${obj.type}, pos=(${obj.left},${obj.top}), visible=${obj.visible}, opacity=${obj.opacity}`);
                        });

                        fabricCanvas.renderAll();
                    } catch (renderError) {
                        console.error('Error during final canvas rendering:', renderError);
                    }
                }).catch(error => {
                    console.error('Error loading images:', error);
                });
            } catch (error) {
                console.error("Ошибка обновления canvas:", error);
            }
        };

        // Выполняем обновление canvas с небольшой задержкой
        const timeoutId = setTimeout(updateCanvas, 0);

        // После обновления canvas, принудительно обновляем позиции объектов,
        // но только если они действительно изменились
        const positionUpdateId = setTimeout(() => {
            // Не обновляем принудительно позиции объектов, если анимация активна
            if (!isPlaying) {
                forceUpdateObjectPositions();
            }
        }, 100); // Increase delay to reduce jittering

        // Анимация для плеера
        let animationFrame;
        let lastAnimationTime = 0;
        let prevTime = currentTime;

        const animateCanvas = (timestamp) => {
            // Всегда проверяем, изменилось ли время
            const timeChanged = Math.abs(prevTime - currentTime) > 0.01;
            prevTime = currentTime;

            // We always apply animation effects when time changes, whether playing or not
            // Limit animation updates to reduce jittering
            const timeSinceLastUpdate = timestamp - lastAnimationTime;

            // При скраббинге обновляем с большей частотой
            const updateIntervalMs = isPlaying ? 16 : 8; // ~60fps для плеера, ~120fps для скраббинга

            if ((timeChanged || isPlaying) && timeSinceLastUpdate > updateIntervalMs) {
                lastAnimationTime = timestamp;

                // Update all objects based on current time
                const objects = fabricCanvas.getObjects();
                objects.forEach(obj => {
                    if (obj.data && obj.data.element) {
                        applyAnimationEffects(obj, obj.data.element);
                    }
                });

                fabricCanvas.renderAll();
            }

            // Only continue animation loop if playing or time changed
            if (isPlaying) {
                animationFrame = requestAnimationFrame(animateCanvas);
            } else if (timeChanged) {
                // Если время изменилось, но плеер не активен (скраббинг), еще один кадр для обновления позиций
                animationFrame = requestAnimationFrame(animateCanvas);
            }
        };

        // Start animation frame even when not playing to handle scrubbing
        animationFrame = requestAnimationFrame(animateCanvas);

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(positionUpdateId);
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [initialized, effectiveElements, currentTime, selectedElement, isPlaying, setupEventHandlers, applyAnimationEffects, readOnly, forceUpdateObjectPositions]);

    // Переключение записи keyframe
    const toggleKeyframeRecording = useCallback(() => {
        if (onElementsChange) {
            // Instead of trying to set state directly, emit an event to the parent
            console.log(`Requesting recording mode toggle from current state: ${isRecordingKeyframes}`);
            // Pass the toggled value to the parent component
            const newRecordingState = !isRecordingKeyframes;
            // This will notify the parent to update its state
            onElementsChange(effectiveElements);
            // Notify parent about recording toggle through a separate callback if available
            if (typeof onToggleRecording === 'function') {
                onToggleRecording(newRecordingState);
            }
        }
    }, [isRecordingKeyframes, onElementsChange, effectiveElements, onToggleRecording]);

    // ВРЕМЕННО: Функция для открытия модального окна с хореографией - будет удалена позже
    const handleShowChoreography = useCallback(() => {
        setShowChoreoModal(true);
    }, []);

    // ВРЕМЕННО: Функция для закрытия модального окна с хореографией - будет удалена позже
    const handleCloseChoreography = useCallback(() => {
        setShowChoreoModal(false);
    }, []);

    // ВРЕМЕННО: Функция для переключения между 3D моделью и видео - будет удалена позже
    const handleViewModeChange = useCallback((mode) => {
        setViewMode(mode);
        setShowChoreoModal(true);
    }, []);

    // ВРЕМЕННО: Функция для получения URL видео из элементов - будет удалена позже
    const getVideoUrl = useCallback(() => {
        console.log('Canvas: Checking for video URL in project');

        // Проверяем наличие видео в проекте
        if (project && project.videoUrl) {
            console.log('Canvas: Found videoUrl in project:', project.videoUrl);
            return project.videoUrl;
        }

        // Проверяем наличие тестового видео для отладки
        console.log('Canvas: No video found in project');
        return null;
    }, [project]);

    // ВРЕМЕННО: Функция для показа комбинированного просмотрщика - будет удалена позже
    const handleShowCombinedViewer = useCallback(() => {
        setShowCombinedViewer(true);
    }, []);

    // ВРЕМЕННО: Обработчик сохранения анимаций - будет удален позже
    const handleSaveAnimations = useCallback((data, elementId) => {
        if (!onElementsChange || !elements || !elementId) {
            console.error('Canvas: Cannot save animations - missing required parameters', {
                hasElements: !!elements,
                hasElementId: !!elementId,
                hasOnElementsChange: !!onElementsChange
            });
            return;
        }

        // Extract the animation data and model information
        const {
            animations = [],
            modelUrl,
            modelId,
            isLocalFile = false,
            modelName,
            visible = true,
            style = {}
        } = data;

        // Default opacity to 1 if not provided
        const opacity = style.opacity || 1;

        console.log('Canvas: Saving animations and model path for element:', {
            elementId: elementId,
            animationsCount: animations.length,
            modelUrl: modelUrl || 'none',
            modelId: modelId || 'none',
            isLocalFile: isLocalFile,
            modelName: modelName || 'none',
            visible: visible,
            opacity: opacity
        });

        // Find the element in the elements array
        const element = elements.find(e => e.id === elementId);
        if (!element) {
            console.error(`Canvas: Element with ID ${elementId} not found in elements array`);
            return;
        }

        console.log('Canvas: Current element details:', {
            id: element.id,
            type: element.type,
            currentModelPath: element.modelPath || 'none',
            hasKeyframes: !!element.keyframes && element.keyframes.length > 0,
            keyframesCount: element.keyframes ? element.keyframes.length : 0,
            position: element.position
        });

        // Update the elements array with the new animations and model path
        const updatedElements = elements.map(element => {
            if (element.id === elementId) {
                // Preserve current position, scale, and opacity values
                const currentPosition = element.position;
                const currentStyle = element.style || {};

                // Create updated element with animations and model info
                const updatedElement = {
                    ...element,
                    glbAnimations: animations,
                    // IMPORTANT: Always set modelPath explicitly if modelUrl is provided
                    modelPath: modelUrl || element.modelPath,
                    // Также сохраняем modelUrl для совместимости
                    modelUrl: modelUrl || element.modelUrl,
                    // Preserve existing style with opacity
                    style: {
                        ...currentStyle,
                        opacity: currentStyle.opacity !== undefined ? currentStyle.opacity : opacity
                    },
                    // Preserve existing position
                    position: currentPosition,
                    // Ensure the element is visible in the current state
                    visible: visible,
                    // Вместо изменения типа, добавляем флаг has3DModel
                    has3DModel: true,
                    // Сохраняем оригинальный тип, если его еще нет
                    originalType: element.originalType || element.type
                };

                // Ensure modelPath and modelUrl are consistent and not empty
                if (updatedElement.modelPath || updatedElement.modelUrl) {
                    const modelPathToUse = updatedElement.modelPath || updatedElement.modelUrl;
                    updatedElement.modelPath = modelPathToUse;
                    updatedElement.modelUrl = modelPathToUse;

                    console.log(`Canvas: Ensured consistent model paths for element ${elementId}:`, {
                        modelPath: updatedElement.modelPath,
                        modelUrl: updatedElement.modelUrl
                    });
                }

                // Preserve existing keyframes and only add model information if needed
                if (updatedElement.keyframes && updatedElement.keyframes.length > 0) {
                    updatedElement.keyframes = updatedElement.keyframes.map(keyframe => ({
                        ...keyframe,
                        modelPath: modelUrl || keyframe.modelPath || element.modelPath,
                        modelUrl: modelUrl || keyframe.modelUrl || element.modelUrl
                    }));

                    console.log(`Canvas: Updated modelPath in ${updatedElement.keyframes.length} keyframes while preserving positions and other properties`);
                } else if (modelUrl) {
                    // If there are no keyframes, create a single keyframe with current properties
                    const currentFabricObject = fabricInstances.get(canvasId.current)?.getObjects()
                        .find(obj => obj.data?.elementId === elementId);

                    // Use current object properties for the initial keyframe
                    const initialPosition = currentFabricObject
                        ? { x: currentFabricObject.left, y: currentFabricObject.top }
                        : element.position;

                    const initialOpacity = currentFabricObject
                        ? currentFabricObject.opacity
                        : (element.style?.opacity || opacity);

                    const initialScale = currentFabricObject
                        ? currentFabricObject.scaleX
                        : 1;

                    console.log(`Canvas: Creating initial keyframe with actual object properties:`, {
                        position: initialPosition,
                        opacity: initialOpacity,
                        scale: initialScale
                    });

                    updatedElement.keyframes = [
                        {
                            time: 0,
                            position: initialPosition,
                            opacity: initialOpacity,
                            scale: initialScale,
                            modelPath: modelUrl,
                            modelUrl: modelUrl
                        }
                    ];

                    console.log('Canvas: Created new keyframe with modelPath and current object properties');
                }

                // If this is a local file (blob URL), save additional information
                if (isLocalFile) {
                    updatedElement.isLocalModelFile = true;
                    if (modelName) {
                        updatedElement.modelName = modelName;
                    }
                }

                // If we have a model ID from the server, save it
                if (modelId) {
                    updatedElement.modelId = modelId;
                }

                console.log(`Canvas: Updated element ${elementId} with:`, {
                    animationsCount: animations.length,
                    oldModelPath: element.modelPath || 'none',
                    newModelPath: updatedElement.modelPath || 'none',
                    modelUrl: modelUrl || 'unchanged',
                    isLocalFile: isLocalFile,
                    modelName: modelName || 'none',
                    visible: updatedElement.visible,
                    opacity: updatedElement.style?.opacity,
                    hasType: !!updatedElement.type,
                    type: updatedElement.type || 'none',
                    keyframesCount: updatedElement.keyframes ? updatedElement.keyframes.length : 0,
                    position: updatedElement.position || 'unchanged'
                });

                return updatedElement;
            }
            return element;
        });

        // Update the elements array
        onElementsChange(updatedElements);

        // Позиционируем 3D метки в соответствии с текущими позициями объектов
        setTimeout(() => {
            forceUpdateObjectPositions();
        }, 50);
    }, [elements, onElementsChange, canvasId, forceUpdateObjectPositions]);

    // ВРЕМЕННО: Рендер кнопки просмотра 3D/видео - будет удалено позже
    const renderViewerButton = () => {
        // Только если инициализирован canvas и есть контейнер для кнопок
        if (!initialized || !buttonContainerRef.current) return null;

        // Кнопка должна быть видна только при выборе элемента
        if (!selectedElement) return null;

        const videoUrl = getVideoUrl();
        console.log('Canvas: Video URL for combined viewer button:', videoUrl);

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
                        onClick={handleShowCombinedViewer}
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
                        Просмотр 3D и видео
                    </Button>
                </Paper>
            </Box>,
            buttonContainerRef.current
        );
    };

    // ВРЕМЕННО: Рендер модального окна хореографии - будет удалено позже
    const renderChoreoModal = () => {
        const videoSource = getVideoUrl();

        // Проверяем, есть ли у выбранного элемента 3D модель
        const has3dModel = selectedElement && (selectedElement.modelPath || selectedElement.has3DModel);
        console.log('Canvas: renderChoreoModal - checking for 3D model:', {
            hasSelectedElement: !!selectedElement,
            elementId: selectedElement?.id,
            has3dModel: has3dModel,
            modelPath: selectedElement?.modelPath || 'none',
            has3DModel: selectedElement?.has3DModel || false,
            viewMode: viewMode
        });

        // Если есть выбранный элемент, проверим его keyframes
        if (selectedElement) {
            console.log('Canvas: Selected element keyframes:', {
                hasKeyframes: !!(selectedElement.keyframes && selectedElement.keyframes.length > 0),
                keyframesCount: selectedElement.keyframes ? selectedElement.keyframes.length : 0
            });

            // Если есть keyframes, проверим их на наличие modelPath
            if (selectedElement.keyframes && selectedElement.keyframes.length > 0) {
                const keyframesWithModel = selectedElement.keyframes.filter(kf => kf.modelPath);
                console.log('Canvas: Keyframes with modelPath:', {
                    count: keyframesWithModel.length,
                    paths: keyframesWithModel.map(kf => kf.modelPath)
                });
            }
        }

        return (
            <Modal
                open={showChoreoModal}
                onClose={() => setShowChoreoModal(false)}
                aria-labelledby="choreography-modal-title"
            >
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '80%',
                    height: '80%',
                    bgcolor: 'background.paper',
                    boxShadow: 24,
                    p: 4,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Typography id="choreography-modal-title" variant="h6" component="h2" gutterBottom>
                        {viewMode === '3d' ? '3D модель' : 'Видео'} для {selectedElement?.title || 'танцора'}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }}>
                        {viewMode === '3d' && has3dModel ? (
                            <ModelViewer
                                isVisible={true}
                                onClose={() => setShowChoreoModal(false)}
                                playerDuration={project?.duration || 60} // Use project duration if available
                                currentTime={currentTime}
                                isPlaying={isPlaying}
                                elementKeyframes={selectedElement?.keyframes || []}
                                elementId={selectedElement?.id}
                                glbAnimationUrl={selectedElement?.modelPath}
                                onSaveAnimations={handleSaveAnimations}
                            />
                        ) : viewMode === 'video' ? (
                            <VideoViewer
                                isVisible={true}
                                videoUrl={videoSource}
                                onClose={() => setShowChoreoModal(false)}
                            />
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Typography variant="body1">
                                    {!selectedElement ? 'Выберите элемент для просмотра.' : 'У этого элемента нет 3D модели. Пожалуйста, добавьте модель в настройках элемента.'}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Modal>
        );
    };

    // ВРЕМЕННО: Получаем GLB анимации для проекта - будет удалено позже
    const getGlbAnimations = () => {
        // Если у нас есть доступ к glbAnimations через props
        if (project && project.glbAnimations) {
            console.log('Canvas: Getting GLB animations from project:', project.glbAnimations);
            return project.glbAnimations;
        }
        console.log('Canvas: No GLB animations found in project');
        return [];
    };

    // Обновленная функция для получения модели элемента с подробным логированием
    const getElementModel = useCallback((element) => {
        if (!element) {
            console.log('Canvas: getElementModel called without element');
            return null;
        }

        console.log('Canvas: getElementModel checking element:', {
            id: element.id,
            hasModelPath: !!element.modelPath,
            modelPath: element.modelPath || 'none'
        });

        // Проверяем наличие пути к модели
        if (element.modelPath) {
            console.log('Canvas: Element has model path:', element.modelPath);

            // Если это локальный файл (blob URL), мы не можем его восстановить напрямую
            // Поэтому возвращаем информацию о модели для отображения
            if (element.isLocalModelFile || element.modelPath.startsWith('blob:')) {
                console.log('Canvas: Element has local model file');
                return {
                    isLocalFile: true,
                    name: element.modelName || 'Локальная модель',
                    message: 'Локальный файл модели недоступен после перезагрузки страницы. Пожалуйста, загрузите модель снова.'
                };
            }

            // Process the URL to ensure it's correctly formatted
            let modelUrl = element.modelPath;

            // If the URL doesn't start with http or blob, ensure it has the correct prefix
            if (!modelUrl.startsWith('http') && !modelUrl.startsWith('blob:')) {
                // Convert /uploads/models/ to /models/ if needed
                if (modelUrl.startsWith('/uploads/models/')) {
                    const filename = modelUrl.split('/').pop();
                    modelUrl = `/models/${filename}`;
                } else if (modelUrl.startsWith('uploads/models/')) {
                    const filename = modelUrl.split('/').pop();
                    modelUrl = `/models/${filename}`;
                }

                // If it doesn't start with /, add it
                if (!modelUrl.startsWith('/')) {
                    modelUrl = `/models/${modelUrl.split('/').pop()}`;
                }

                // If it's not a full URL, add the origin
                if (!modelUrl.includes('://')) {
                    modelUrl = `${window.location.origin}${modelUrl}`;
                }
            }

            console.log('Canvas: Processed model URL:', modelUrl);

            return {
                url: modelUrl,
                name: element.modelName || element.modelPath.split('/').pop() || 'Модель'
            };
        }

        console.log('Canvas: Element does not have a model path');
        return null;
    }, []);

    // Добавляем обработчик двойного клика для элементов с 3D моделями
    useEffect(() => {
        if (!fabricInstances.has(canvasId.current)) return;

        const fabricCanvas = fabricInstances.get(canvasId.current);

        // Добавляем обработчик двойного клика
        fabricCanvas.on('mouse:dblclick', (e) => {
            console.log('Canvas: Double click detected');

            // Случай двойного клика на объекте
            if (e.target && e.target.data && e.target.data.elementId) {
                const elementId = e.target.data.elementId;
                const element = effectiveElements.find(el => el.id === elementId);

                if (element) {
                    console.log('Canvas: Double clicked on element:', {
                        id: element.id,
                        type: element.type,
                        hasModelPath: !!element.modelPath,
                        modelPath: element.modelPath || 'none'
                    });

                    // Если у элемента есть 3D модель, открываем модальное окно
                    if (element.modelPath || element.has3DModel) {
                        console.log('Canvas: Opening 3D model viewer for element:', element.id);
                        setViewMode('3d');
                        setShowChoreoModal(true);
                    }
                }
            }
        });

        return () => {
            // Удаляем обработчик при размонтировании
            fabricCanvas.off('mouse:dblclick');
        };
    }, [effectiveElements, setViewMode, setShowChoreoModal]);

    // Эффект для загрузки моделей при монтировании компонента
    useEffect(() => {
        if (selectedElement) {
            console.log('Canvas: Selected element changed:', {
                id: selectedElement.id,
                type: selectedElement.type,
                hasModelPath: !!selectedElement.modelPath,
                modelPath: selectedElement.modelPath || 'none',
                visible: selectedElement.visible !== undefined ? selectedElement.visible : 'not set',
                opacity: selectedElement.style?.opacity || 'not set'
            });

            const model = getElementModel(selectedElement);
            if (model) {
                console.log('Canvas: Model for selected element:', {
                    isLocalFile: model.isLocalFile || false,
                    name: model.name || 'unnamed',
                    url: model.url || 'none',
                    message: model.message || 'none'
                });

                if (model.isLocalFile) {
                    console.warn('Canvas: Selected element has a local model file that may not be accessible');
                }
            } else {
                console.log('Canvas: No model found for selected element');
            }
        } else {
            console.log('Canvas: No element selected');
        }
    }, [selectedElement, getElementModel]);

    // ВРЕМЕННО: Функция для скрытия комбинированного просмотрщика - будет удалена позже
    const handleCloseCombinedViewer = useCallback(() => {
        // ModelViewer сам вызовет onSaveAnimations при закрытии
        // Просто скрываем просмотрщик
        setShowCombinedViewer(false);

        console.log('Canvas: Closing combined viewer, refreshing canvas objects');

        // Force refresh the canvas to ensure all objects are visible
        if (fabricInstances.has(canvasId.current)) {
            const fabricCanvas = fabricInstances.get(canvasId.current);

            console.log('Canvas: Objects before refresh:', fabricCanvas.getObjects().map(obj => ({
                id: obj.data?.elementId || 'unknown',
                type: obj.type,
                visible: obj.visible,
                opacity: obj.opacity,
                position: obj.data?.element?.position || 'unknown'
            })));

            // Ensure all objects are visible and correctly positioned
            fabricCanvas.getObjects().forEach(obj => {
                if (obj.data && obj.data.element) {
                    const element = obj.data.element;
                    const currentPosition = element.position;

                    // Only update if position is different to avoid jitter
                    if (obj.left !== currentPosition.x || obj.top !== currentPosition.y) {
                        obj.set({
                            left: currentPosition.x,
                            top: currentPosition.y
                        });
                    }

                    // Always ensure visibility and proper opacity
                    obj.set({
                        visible: true,
                        opacity: element.style?.opacity || 1
                    });

                    // Make sure object is clickable
                    obj.selectable = !readOnly;
                    obj.evented = !readOnly;
                    obj.hasControls = !readOnly;
                    obj.hasBorders = !readOnly;
                }
            });

            // Force canvas re-rendering
            fabricCanvas.renderAll();

            console.log('Canvas: Refreshed after closing 3D model viewer');
        }
    }, [readOnly]);

    // Используем ReactDOM.createPortal для рендеринга кнопок в отдельном контейнере
    const renderButtons = () => {
        // Только если инициализирован canvas и есть контейнер для кнопок
        if (!initialized || !buttonContainerRef.current) return null;

        return ReactDOM.createPortal(
            <>
                {/* Кнопки управления выбранным элементом - в левом верхнем углу */}
                {selectedElement && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '20px',
                            left: '20px',
                            display: 'flex',
                            gap: 1,
                            pointerEvents: 'auto',
                            zIndex: 100
                        }}
                    >
                        {/* Кнопка копирования элемента */}
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                // Создаем копию выбранного элемента
                                const elementCopy = {
                                    ...selectedElement,
                                    id: `${selectedElement.type}-${Date.now()}`, // Новый ID
                                    position: {
                                        x: selectedElement.position.x + 20,
                                        y: selectedElement.position.y + 20
                                    }
                                };

                                // Добавляем копию в список элементов
                                onElementsChange([...effectiveElements, elementCopy]);

                                // Выбираем новый элемент
                                onElementSelect(elementCopy);
                            }}
                            sx={{
                                backgroundColor: 'rgba(33, 150, 243, 0.7)',
                                '&:hover': {
                                    backgroundColor: 'rgba(33, 150, 243, 0.9)',
                                },
                                minWidth: '40px',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%'
                            }}
                        >
                            <ContentCopy />
                        </Button>

                        {/* Кнопка удаления элемента */}
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleDeleteElement}
                            sx={{
                                backgroundColor: 'rgba(255, 87, 87, 0.7)',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 87, 87, 0.9)',
                                },
                                minWidth: '40px',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%'
                            }}
                        >
                            <Delete />
                        </Button>
                    </Box>
                )}

                {/* Отладочная кнопка в правом верхнем углу */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        pointerEvents: 'auto',
                        zIndex: 100
                    }}
                >
                    {/* Отладочная кнопка для проверки 3D моделей */}
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => {
                            console.log('Canvas: Debug - Checking all elements for 3D models');

                            // Проверяем все элементы на наличие 3D моделей
                            const elementsWithModels = effectiveElements.filter(el => el.modelPath);

                            console.log('Canvas: Elements with 3D models:', {
                                count: elementsWithModels.length,
                                elements: elementsWithModels.map(el => ({
                                    id: el.id,
                                    type: el.type,
                                    modelPath: el.modelPath
                                }))
                            });

                            // Если есть элементы с моделями, выбираем первый и открываем просмотрщик
                            if (elementsWithModels.length > 0) {
                                const element = elementsWithModels[0];
                                console.log('Canvas: Selecting element with 3D model:', element.id);
                                onElementSelect(element);
                                setViewMode('3d');
                                setShowChoreoModal(true);
                            } else {
                                console.log('Canvas: No elements with 3D models found');
                                alert('Нет элементов с 3D моделями');
                            }
                        }}
                        sx={{ textTransform: 'none' }}
                    >
                        Проверить 3D модели
                    </Button>
                </Box>
            </>,
            buttonContainerRef.current
        );
    };

    // Cleanup function to remove all 3D icons
    const removeAll3DLabels = useCallback(() => {
        if (!fabricInstances.has(canvasId.current)) return;

        const fabricCanvas = fabricInstances.get(canvasId.current);

        // Find and remove all 3D model labels
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.modelIcon) {
                fabricCanvas.remove(obj.modelIcon);
                delete obj.modelIcon;
            }
        });

        fabricCanvas.renderAll();
        console.log('Removed all 3D model labels from canvas');
    }, [canvasId]);

    // Call removeAll3DLabels on component mount
    useEffect(() => {
        if (initialized) {
            removeAll3DLabels();
        }
    }, [initialized, removeAll3DLabels]);

    // Сохраняем последнюю позицию при остановке анимации
    useEffect(() => {
        // Когда воспроизведение останавливается, сохраняем текущие позиции
        if (!isPlaying) {
            console.log('Animation stopped, saving current positions at time', currentTime);

            // Если у нас есть canvas и он инициализирован
            if (initialized && fabricInstances.has(canvasId.current)) {
                const fabricCanvas = fabricInstances.get(canvasId.current);

                // Принудительно применяем анимацию один раз для всех объектов для текущего времени
                fabricCanvas.getObjects().forEach(obj => {
                    if (obj.data && obj.data.element) {
                        const element = obj.data.element;

                        // Если у элемента есть ключевые кадры, применяем анимацию
                        if (element.keyframes && element.keyframes.length > 0) {
                            // Вызываем функцию применения анимации в последний раз
                            applyAnimationEffects(obj, element);
                        }
                    }
                });

                // Отрисовываем холст с окончательными позициями
                fabricCanvas.renderAll();
            }
        }
    }, [isPlaying, currentTime, initialized, canvasId, applyAnimationEffects]);

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
            {/* Рендерим кнопки только если не в режиме чтения */}
            {!readOnly && renderButtons()}

            {/* ВРЕМЕННО: Рендерим кнопку просмотра 3D/видео - будет удалено позже */}
            {renderViewerButton()}

            {/* ВРЕМЕННО: Модальное окно выбора хореографии - будет удалено позже */}
            {showChoreoModal && renderChoreoModal()}

            {/* ВРЕМЕННО: Комбинированный просмотрщик 3D и видео - будет удален позже */}
            <CombinedViewer
                isVisible={showCombinedViewer}
                onClose={handleCloseCombinedViewer}
                videoUrl={getVideoUrl()}
                playerDuration={project?.duration || 60} // Use project duration if available
                currentTime={currentTime}
                isPlaying={isPlaying}
                onTimeUpdate={() => { }} // Добавьте обработчик обновления времени при необходимости
                elementKeyframes={selectedElement?.keyframes || []}
                elementId={selectedElement?.id}
                onSaveAnimations={handleSaveAnimations}
                glbAnimations={getGlbAnimations()}
                glbAnimationUrl={selectedElement?.modelPath}
            />
        </Box>
    );
};

export default Canvas; 