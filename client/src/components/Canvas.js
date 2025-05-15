import React, { useEffect, useRef, useState, useCallback, createRef } from 'react';
import { fabric } from 'fabric';
import { Box, IconButton, Modal, Typography, Grid, Button, Tooltip, Paper } from '@mui/material';
import { ContentCopy, Delete, Visibility, ThreeDRotation, Videocam, PlayArrow } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import ReactDOM from 'react-dom';
// ВРЕМЕННО: Импорты для 3D и видео просмотрщиков - будут удалены позже
import ModelViewer from './ModelViewer';
import VideoViewer from './VideoViewer';
import CombinedViewer from './CombinedViewer';

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
    // Use elements as provided without a default element
    const effectiveElements = elements;

    const containerRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const canvasId = useRef(`canvas-${uuidv4()}`);
    const [initialized, setInitialized] = useState(false);
    const buttonContainerRef = useRef(null);

    // ВРЕМЕННО: Состояния для модальных окон 3D и видео - будут удалены позже
    const [showChoreoModal, setShowChoreoModal] = useState(false);
    const [viewMode, setViewMode] = useState('3d'); // '3d' or 'video'
    const [showCombinedViewer, setShowCombinedViewer] = useState(false);

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

            // Инициализируем Fabric
            const fabricCanvas = new fabric.Canvas(canvasId.current, {
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight,
                backgroundColor: '#ffffff',
                preserveObjectStacking: true,
                selection: !readOnly, // Disable selection in readOnly mode
                interactive: !readOnly // Disable interaction in readOnly mode
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
                fabricCanvas.selection = false;
                fabricCanvas.skipTargetFind = true;
                fabricCanvas.selectable = false;
                fabricCanvas.hoverCursor = 'default';
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
                    const objects = fabricCanvas.getObjects();
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
                if (selectedObject.data && selectedObject.data.elementId) {
                    const element = effectiveElements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
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
                if (selectedObject.data && selectedObject.data.elementId) {
                    const element = effectiveElements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
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
    }, [effectiveElements, currentTime, isRecordingKeyframes, onElementsChange, onElementSelect, readOnly]);

    // Функция для применения эффектов анимации
    const applyAnimationEffects = useCallback((fabricObject, element) => {
        // Safety checks for element and fabricObject
        if (!element || !fabricObject) {
            console.warn('Cannot apply animation: element or fabricObject is null');
            return;
        }

        console.log(`Applying animation to ${element.type} element ${element.id} at time ${currentTime}`, {
            elementVisible: element.visible,
            elementOpacity: element.style?.opacity,
            objectVisible: fabricObject.visible,
            objectOpacity: fabricObject.opacity,
            hasModelPath: !!element.modelPath,
            modelPath: element.modelPath || 'none'
        });

        // Always ensure the object is visible regardless of animation state
        const oldVisible = fabricObject.visible;
        const oldOpacity = fabricObject.opacity;

        fabricObject.set({
            visible: true,
            opacity: element.style?.opacity !== undefined ? element.style.opacity : 1
        });

        console.log(`Set basic visibility for element ${element.id}:`, {
            visibilityBefore: oldVisible,
            visibilityAfter: fabricObject.visible,
            opacityBefore: oldOpacity,
            opacityAfter: fabricObject.opacity
        });

        // Проверяем, есть ли у элемента 3D модель, и добавляем значок, если его нет
        if (element.modelPath && !fabricObject.modelIcon) {
            console.log(`Element ${element.id} has 3D model path: ${element.modelPath}, adding 3D icon`);

            // Создаем значок 3D модели
            const modelIcon = new fabric.Text('3D', {
                left: fabricObject.left + 5,
                top: fabricObject.top + 5,
                fontSize: 16,
                fill: '#FFFFFF',
                backgroundColor: 'rgba(0, 0, 255, 0.7)',
                padding: 5,
                selectable: false,
                evented: false,
                visible: true
            });

            // Добавляем значок на холст
            if (fabricInstances.has(canvasId.current)) {
                const fabricCanvas = fabricInstances.get(canvasId.current);
                fabricCanvas.add(modelIcon);

                // Связываем значок с объектом
                fabricObject.modelIcon = modelIcon;

                console.log(`Added 3D model icon for element ${element.id}`);
            }
        }

        // If no keyframes or invalid ones, use base properties
        if (!element.keyframes || !Array.isArray(element.keyframes) || element.keyframes.length === 0) {
            console.log(`No keyframes for element ${element.id}, using base properties`);

            // Ensure base properties are applied
            fabricObject.set({
                left: element.position.x,
                top: element.position.y,
                scaleX: element.size && element.size.width ? element.size.width / fabricObject.width : 1,
                scaleY: element.size && element.size.height ? element.size.height / fabricObject.height : 1,
                visible: true // Explicitly ensure visibility
            });

            // Обновляем позицию значка 3D модели, если он есть
            if (fabricObject.modelIcon) {
                fabricObject.modelIcon.set({
                    left: element.position.x + 5,
                    top: element.position.y + 5,
                    visible: true
                });
            }

            return;
        }

        console.log(`Element ${element.id} has ${element.keyframes.length} keyframes`);

        // Filter out invalid keyframes
        const validKeyframes = element.keyframes.filter(kf => {
            const isValid = kf &&
                typeof kf.time === 'number' && !isNaN(kf.time) &&
                kf.position &&
                typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                typeof kf.position.y === 'number' && !isNaN(kf.position.y);

            if (!isValid) {
                console.warn(`Skipping invalid keyframe in element ${element.id}:`, kf);
            }
            return isValid;
        });

        // If no valid keyframes after filtering, use base properties
        if (validKeyframes.length === 0) {
            console.log(`No valid keyframes for element ${element.id}, using base properties`);
            fabricObject.set({
                left: element.position.x,
                top: element.position.y,
                opacity: element.style?.opacity || 1,
                scaleX: element.size && element.size.width ? element.size.width / fabricObject.width : 1,
                scaleY: element.size && element.size.height ? element.size.height / fabricObject.height : 1,
                visible: true // Explicitly ensure visibility
            });
            return;
        }

        console.log(`Element ${element.id} has ${validKeyframes.length} valid keyframes, current time: ${currentTime}`);

        // Sort keyframes by time
        const sortedKeyframes = [...validKeyframes].sort((a, b) => a.time - b.time);

        // Если текущее время точно соответствует ключевому кадру, используем его без интерполяции
        const exactKeyframe = sortedKeyframes.find(k => Math.abs(k.time - currentTime) < 0.01);
        if (exactKeyframe) {
            console.log(`Using exact keyframe at time ${exactKeyframe.time}`);

            // Make sure all properties exist and are valid
            const posX = exactKeyframe.position?.x ?? element.position.x;
            const posY = exactKeyframe.position?.y ?? element.position.y;
            const opacity = exactKeyframe.opacity !== undefined ? exactKeyframe.opacity : element.style.opacity;
            const scale = exactKeyframe.scale || 1;

            fabricObject.set({
                left: posX,
                top: posY,
                opacity: opacity,
                scaleX: scale,
                scaleY: scale,
                visible: true // Explicitly ensure visibility
            });

            console.log(`Applied keyframe properties: x=${posX}, y=${posY}, opacity=${opacity}, scale=${scale}`);

            // Обновляем позицию значка 3D модели, если он есть
            if (fabricObject.modelIcon) {
                fabricObject.modelIcon.set({
                    left: posX + 5,
                    top: posY + 5,
                    opacity: opacity,
                    visible: true // Explicitly ensure visibility
                });

                // If this is a 3D element, also update the model path display
                if (element.type === '3d' && element.modelPath) {
                    // Add model path information to the tooltip or label
                    fabricObject.set({
                        fill: 'rgba(0, 0, 255, 0.2)',
                        stroke: 'rgba(0, 0, 255, 0.7)',
                        strokeWidth: 2,
                        rx: 10, // Ensure rounded corners are preserved
                        ry: 10  // Ensure rounded corners are preserved
                    });
                }
            }

            return;
        }

        // Находим предыдущий и следующий ключевые кадры
        let prevKeyframe = null;
        let nextKeyframe = null;

        // Находим два keyframe между которыми находимся
        for (let i = 0; i < sortedKeyframes.length; i++) {
            if (sortedKeyframes[i].time <= currentTime) {
                prevKeyframe = sortedKeyframes[i];
            }

            if (sortedKeyframes[i].time > currentTime && !nextKeyframe) {
                nextKeyframe = sortedKeyframes[i];
            }
        }

        // Если у нас нет обоих keyframes, используем ближайший
        if (!prevKeyframe && !nextKeyframe) {
            console.log(`No applicable keyframes for element ${element.id} at time ${currentTime}`);
            // Если нет keyframes вообще, используем базовые свойства
            fabricObject.set({
                left: element.position.x,
                top: element.position.y,
                opacity: element.style.opacity,
                scaleX: element.size && element.size.width ? element.size.width / fabricObject.width : 1,
                scaleY: element.size && element.size.height ? element.size.height / fabricObject.height : 1,
                visible: true // Explicitly ensure visibility
            });
            return;
        }

        if (!prevKeyframe) {
            // Если нет предыдущего кадра, используем первый с базовыми свойствами элемента для предыдущего
            prevKeyframe = {
                time: 0,
                position: { x: element.position.x, y: element.position.y },
                opacity: element.style.opacity,
                scale: 1
            };
        }

        if (!nextKeyframe) {
            // Если нет следующего кадра, используем последний с его же свойствами
            nextKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
        }

        // Вычисляем прогресс между keyframes
        const totalDuration = nextKeyframe.time - prevKeyframe.time;
        if (totalDuration === 0 || prevKeyframe === nextKeyframe) {
            console.log(`Using single keyframe at time ${prevKeyframe.time}`);
            // Если кадры совпадают по времени, используем свойства кадра
            fabricObject.set({
                left: prevKeyframe.position?.x ?? element.position.x,
                top: prevKeyframe.position?.y ?? element.position.y,
                opacity: prevKeyframe.opacity !== undefined ? prevKeyframe.opacity : element.style.opacity,
                scaleX: prevKeyframe.scale || 1,
                scaleY: prevKeyframe.scale || 1,
                visible: true // Explicitly ensure visibility
            });
            return;
        }

        const progress = (currentTime - prevKeyframe.time) / totalDuration;

        console.log(`Interpolating between keyframes at ${prevKeyframe.time} and ${nextKeyframe.time} (progress: ${progress})`);

        // Обеспечиваем существование свойств position или используем базовые свойства элемента
        const prevX = prevKeyframe.position?.x ?? element.position.x;
        const prevY = prevKeyframe.position?.y ?? element.position.y;
        const nextX = nextKeyframe.position?.x ?? element.position.x;
        const nextY = nextKeyframe.position?.y ?? element.position.y;

        // Интерполируем позицию
        const currentX = prevX + (nextX - prevX) * progress;
        const currentY = prevY + (nextY - prevY) * progress;

        // Интерполируем прозрачность
        const prevOpacity = prevKeyframe.opacity !== undefined ? prevKeyframe.opacity : element.style.opacity;
        const nextOpacity = nextKeyframe.opacity !== undefined ? nextKeyframe.opacity : element.style.opacity;
        const currentOpacity = prevOpacity + (nextOpacity - prevOpacity) * progress;

        // Интерполируем масштаб
        const prevScale = prevKeyframe.scale || 1;
        const nextScale = nextKeyframe.scale || 1;
        const currentScale = prevScale + (nextScale - prevScale) * progress;

        // Применяем свойства
        fabricObject.set({
            left: currentX,
            top: currentY,
            opacity: currentOpacity,
            scaleX: currentScale,
            scaleY: currentScale,
            visible: true // Explicitly ensure visibility
        });

        // Обновляем позицию значка 3D модели, если он есть
        if (fabricObject.modelIcon) {
            fabricObject.modelIcon.set({
                left: currentX + 5,
                top: currentY + 5,
                opacity: currentOpacity,
                visible: true // Explicitly ensure visibility
            });

            // If this is a 3D element, also update the model path display
            if (element.type === '3d' && element.modelPath) {
                // Add model path information to the tooltip or label
                fabricObject.set({
                    fill: 'rgba(0, 0, 255, 0.2)',
                    stroke: 'rgba(0, 0, 255, 0.7)',
                    strokeWidth: 2,
                    rx: 10, // Ensure rounded corners are preserved
                    ry: 10  // Ensure rounded corners are preserved
                });
            }
        }

        console.log(`Applied interpolated properties: x=${currentX}, y=${currentY}, opacity=${currentOpacity}, scale=${currentScale}`);
    }, [currentTime]);

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
                    fabricCanvas.backgroundColor = '#ffffff';
                    fabricCanvas.renderAll();
                    return;
                }

                if (!Array.isArray(effectiveElements)) {
                    console.error('Elements is not an array:', effectiveElements);
                    fabricCanvas.clear();
                    fabricCanvas.backgroundColor = '#ffffff';
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
                    fabricCanvas.backgroundColor = '#ffffff';
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
                });

                // Track new objects to add
                const objectsToAdd = [];
                const imageLoadPromises = [];

                // Use only valid elements for rendering
                validElements.forEach((element, index) => {
                    console.log(`Processing element ${index}: id=${element.id}, type=${element.type}, pos=(${element.position?.x},${element.position?.y})`);

                    // Ensure elements with modelPath are marked as 3D type
                    if (element.modelPath && element.type !== '3d') {
                        console.log(`Element ${element.id} has modelPath but type is not '3d', updating type`);
                        element.type = '3d';
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
                            // Create new object if it doesn't exist
                            console.log(`Creating new element ${element.id} for canvas`);

                            // Ensure size exists and has valid values
                            if (!element.size || typeof element.size.width !== 'number' || typeof element.size.height !== 'number') {
                                console.warn(`Element ${element.id} has invalid size:`, element.size);
                                element.size = { width: 100, height: 100 };
                            }

                            // Ensure style exists with minimum properties
                            if (!element.style) {
                                console.warn(`Element ${element.id} has no style, creating default`);
                                element.style = {
                                    backgroundColor: '#cccccc',
                                    borderColor: '#000000',
                                    borderWidth: 1,
                                    color: '#000000',
                                    opacity: 1,
                                    zIndex: 0
                                };
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
                                    break;

                                case '3d':
                                    console.log(`Creating 3D element: id=${element.id}, pos=(${element.position.x},${element.position.y}), modelPath=${element.modelPath || 'none'}`);

                                    // For 3D elements, we create a rectangle with a 3D label
                                    fabricObject = new fabric.Rect({
                                        left: element.position.x,
                                        top: element.position.y,
                                        width: element.size?.width || 100,
                                        height: element.size?.height || 100,
                                        fill: 'rgba(0, 0, 255, 0.2)',
                                        stroke: 'rgba(0, 0, 255, 0.7)',
                                        strokeWidth: 2,
                                        opacity: typeof element.style?.opacity === 'number' ? element.style.opacity : 1,
                                        selectable: !readOnly,
                                        hasControls: !readOnly,
                                        hasBorders: !readOnly,
                                        rx: 10, // Rounded corners
                                        ry: 10  // Rounded corners
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

                                    // Create 3D label
                                    const modelLabel = new fabric.Text('3D', {
                                        left: element.position.x + 5,
                                        top: element.position.y + 5,
                                        fontSize: 16,
                                        fill: '#FFFFFF',
                                        backgroundColor: 'rgba(0, 0, 255, 0.7)',
                                        padding: 5,
                                        selectable: false,
                                        evented: false,
                                        visible: true
                                    });

                                    // Add label to canvas
                                    fabricCanvas.add(modelLabel);

                                    // Link label to object
                                    fabricObject.modelIcon = modelLabel;

                                    break;

                                case 'image':
                                    console.log(`Creating image element: id=${element.id}, content URL exists: ${Boolean(element.content)}`);
                                    if (!element.content) {
                                        console.warn(`Image element ${element.id} is missing content URL, skipping`);
                                        return; // Skip this element
                                    }

                                    const promise = new Promise((resolve) => {
                                        fabric.Image.fromURL(element.content, (img) => {
                                            img.set({
                                                left: element.position.x,
                                                top: element.position.y,
                                                opacity: typeof element.style.opacity === 'number' ? element.style.opacity : 1,
                                                selectable: !readOnly,
                                                hasControls: !readOnly,
                                                hasBorders: !readOnly
                                            });
                                            img.scaleToWidth(element.size.width);
                                            img.scaleToHeight(element.size.height);

                                            // Сохраняем полные данные об элементе для доступа к keyframes
                                            img.data = {
                                                elementId: element.id,
                                                element: element // Сохраняем полный элемент для доступа к keyframes
                                            };

                                            // Проверяем, есть ли у элемента 3D модель
                                            if (element.modelPath) {
                                                console.log(`Element ${element.id} has 3D model: ${element.modelPath}`, {
                                                    elementVisible: element.visible,
                                                    elementOpacity: element.style?.opacity,
                                                    imgVisible: img.visible,
                                                    imgOpacity: img.opacity
                                                });

                                                // Создаем значок 3D модели поверх изображения
                                                const modelIcon = new fabric.Text('3D', {
                                                    left: img.left + 5,
                                                    top: img.top + 5,
                                                    fontSize: 16,
                                                    fill: '#FFFFFF',
                                                    backgroundColor: 'rgba(0, 0, 255, 0.7)',
                                                    padding: 5,
                                                    selectable: false,
                                                    evented: false,
                                                    visible: true // Ensure icon is visible
                                                });

                                                // Добавляем значок на холст
                                                fabricCanvas.add(modelIcon);

                                                // Связываем значок с изображением
                                                img.modelIcon = modelIcon;

                                                // Ensure the image is visible
                                                img.set({ visible: true, opacity: element.style?.opacity || 1 });

                                                console.log(`Added 3D model icon for element ${element.id}, image visibility after:`, {
                                                    imgVisible: img.visible,
                                                    imgOpacity: img.opacity,
                                                    iconVisible: modelIcon.visible
                                                });
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

                    // Если у объекта есть связанный значок 3D модели, удаляем и его
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

                    // Если это элемент с 3D моделью, добавляем значок
                    const element = obj.data.element;
                    if (element && element.modelPath && !obj.modelIcon) {
                        console.log(`Adding 3D model icon for element ${element.id}`);

                        // Создаем значок 3D модели
                        const modelIcon = new fabric.Text('3D', {
                            left: obj.left + 5,
                            top: obj.top + 5,
                            fontSize: 16,
                            fill: '#FFFFFF',
                            backgroundColor: 'rgba(0, 0, 255, 0.7)',
                            padding: 5,
                            selectable: false,
                            evented: false,
                            visible: true // Ensure icon is visible
                        });

                        // Добавляем значок на холст
                        fabricCanvas.add(modelIcon);

                        // Связываем значок с объектом
                        obj.modelIcon = modelIcon;

                        // Ensure the object is visible
                        obj.set({ visible: true });
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

        // Анимация для плеера
        let animationFrame;

        const animateCanvas = () => {
            if (isPlaying) {
                // Update all objects based on current time
                const objects = fabricCanvas.getObjects();
                objects.forEach(obj => {
                    if (obj.data && obj.data.element) {
                        applyAnimationEffects(obj, obj.data.element);
                    }
                });

                fabricCanvas.renderAll();
                animationFrame = requestAnimationFrame(animateCanvas);
            }
        };

        if (isPlaying) {
            animationFrame = requestAnimationFrame(animateCanvas);
        }

        return () => {
            clearTimeout(timeoutId);
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [initialized, effectiveElements, currentTime, selectedElement, isPlaying, setupEventHandlers, applyAnimationEffects, readOnly]);

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
            keyframesCount: element.keyframes ? element.keyframes.length : 0
        });

        // Update the elements array with the new animations and model path
        const updatedElements = elements.map(element => {
            if (element.id === elementId) {
                // Create updated element with animations and model info
                const updatedElement = {
                    ...element,
                    glbAnimations: animations,
                    // IMPORTANT: Always set modelPath explicitly if modelUrl is provided
                    modelPath: modelUrl || element.modelPath,
                    // Также сохраняем modelUrl для совместимости
                    modelUrl: modelUrl || element.modelUrl,
                    // Ensure visibility is explicitly set
                    style: {
                        ...element.style,
                        opacity: opacity
                    },
                    // Ensure the element is visible in the current state
                    visible: visible,
                    // Set the element type as '3d' to ensure it's recognized
                    type: '3d'
                };

                // Если у элемента есть ключевые кадры, добавляем modelPath и modelUrl в каждый кадр
                if (updatedElement.keyframes && updatedElement.keyframes.length > 0) {
                    updatedElement.keyframes = updatedElement.keyframes.map(keyframe => ({
                        ...keyframe,
                        modelPath: modelUrl || keyframe.modelPath || element.modelPath,
                        modelUrl: modelUrl || keyframe.modelUrl || element.modelUrl
                    }));

                    console.log(`Canvas: Updated modelPath in ${updatedElement.keyframes.length} keyframes`);
                } else if (modelUrl) {
                    // Если у элемента нет ключевых кадров, но есть modelUrl, создаем ключевой кадр
                    updatedElement.keyframes = [
                        {
                            time: 0,
                            position: element.position,
                            opacity: opacity,
                            scale: 1,
                            modelPath: modelUrl,
                            modelUrl: modelUrl
                        }
                    ];

                    console.log('Canvas: Created new keyframe with modelPath');
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
                    keyframesCount: updatedElement.keyframes ? updatedElement.keyframes.length : 0
                });

                return updatedElement;
            }
            return element;
        });

        // Update the elements array
        onElementsChange(updatedElements);
    }, [elements, onElementsChange]);

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
                hasModelIcon: !!obj.modelIcon,
                modelIconVisible: obj.modelIcon ? obj.modelIcon.visible : 'N/A'
            })));

            // Ensure all objects are visible
            fabricCanvas.getObjects().forEach(obj => {
                if (obj.data && obj.data.element) {
                    const oldVisible = obj.visible;
                    const oldOpacity = obj.opacity;

                    obj.set({ visible: true });

                    // Also ensure 3D model icons are visible
                    if (obj.modelIcon) {
                        const oldIconVisible = obj.modelIcon.visible;
                        obj.modelIcon.set({ visible: true });

                        console.log(`Canvas: Updated 3D model icon for element ${obj.data.elementId}:`, {
                            iconVisibilityBefore: oldIconVisible,
                            iconVisibilityAfter: obj.modelIcon.visible
                        });
                    }

                    console.log(`Canvas: Updated object visibility for element ${obj.data.elementId}:`, {
                        visibilityBefore: oldVisible,
                        visibilityAfter: obj.visible,
                        opacityBefore: oldOpacity,
                        opacityAfter: obj.opacity,
                        hasModelPath: !!obj.data.element.modelPath,
                        modelPath: obj.data.element.modelPath || 'none'
                    });
                }
            });

            // Re-render the canvas
            fabricCanvas.renderAll();

            console.log('Canvas: Objects after refresh:', fabricCanvas.getObjects().map(obj => ({
                id: obj.data?.elementId || 'unknown',
                type: obj.type,
                visible: obj.visible,
                opacity: obj.opacity,
                hasModelIcon: !!obj.modelIcon,
                modelIconVisible: obj.modelIcon ? obj.modelIcon.visible : 'N/A'
            })));

            console.log('Canvas: Refreshed after closing 3D model viewer');
        } else {
            console.warn('Canvas: Cannot refresh canvas - no fabric instance found');
        }
    }, [canvasId]);

    // Используем ReactDOM.createPortal для рендеринга кнопок в отдельном контейнере
    const renderButtons = () => {
        // Safety check: don't try to render if the ref isn't available
        if (!buttonContainerRef.current) {
            console.warn('Button container ref is not available');
            return null;
        }

        try {
            return ReactDOM.createPortal(
                <>
                    <div
                        style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 100,
                            backgroundColor: isRecordingKeyframes ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            pointerEvents: 'auto'
                        }}
                        onClick={toggleKeyframeRecording}
                    >
                        {isRecordingKeyframes ? 'Запись ключевых кадров (ВКЛ)' : 'Запись ключевых кадров (ВЫКЛ)'}
                    </div>

                    {selectedElement && (
                        <div style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            zIndex: 100,
                            display: 'flex',
                            gap: '8px'
                        }}>
                            <IconButton
                                onClick={handleDuplicateElement}
                                sx={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    },
                                    pointerEvents: 'auto'
                                }}
                                title="Дублировать элемент"
                            >
                                <ContentCopy fontSize="small" />
                            </IconButton>

                            <IconButton
                                onClick={handleDeleteElement}
                                sx={{
                                    backgroundColor: 'rgba(255, 87, 87, 0.7)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 87, 87, 0.9)',
                                    },
                                    pointerEvents: 'auto'
                                }}
                                title="Удалить элемент (Delete)"
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                        </div>
                    )}
                </>,
                buttonContainerRef.current
            );
        } catch (error) {
            console.error('Error rendering buttons:', error);
            return null;
        }
    };

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
                        {viewMode === '3d' ? (
                            <ModelViewer
                                isVisible={true}
                                onClose={() => setShowChoreoModal(false)}
                                playerDuration={60} // Default duration of 60 seconds
                                currentTime={currentTime}
                                isPlaying={isPlaying}
                                elementKeyframes={selectedElement?.keyframes || []}
                                elementId={selectedElement?.id}
                            />
                        ) : (
                            <VideoViewer
                                isVisible={true}
                                videoUrl={videoSource}
                                onClose={() => setShowChoreoModal(false)}
                            />
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

    // Функция для получения модели элемента
    const getElementModel = useCallback((element) => {
        if (!element) return null;

        // Проверяем наличие пути к модели
        if (element.modelPath) {
            console.log('Canvas: Element has model path:', element.modelPath);

            // Если это локальный файл (blob URL), мы не можем его восстановить напрямую
            // Поэтому возвращаем информацию о модели для отображения
            if (element.isLocalModelFile) {
                console.log('Canvas: Element has local model file');
                return {
                    isLocalFile: true,
                    name: element.modelName || 'Локальная модель',
                    message: 'Локальный файл модели недоступен после перезагрузки страницы. Пожалуйста, загрузите модель снова.'
                };
            }

            return {
                url: element.modelPath,
                name: element.modelName || element.modelPath.split('/').pop() || 'Модель'
            };
        }

        return null;
    }, []);

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
                playerDuration={60} // Используйте актуальную длительность проекта
                currentTime={currentTime}
                isPlaying={isPlaying}
                onTimeUpdate={() => { }} // Добавьте обработчик обновления времени при необходимости
                elementKeyframes={selectedElement?.keyframes || []}
                elementId={selectedElement?.id}
                onSaveAnimations={handleSaveAnimations}
                glbAnimations={getGlbAnimations()}
            />
        </Box>
    );
};

export default Canvas; 