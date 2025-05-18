import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';

const fabricInstances = new Map();

export default function useFabricCanvas({
    elements = [],
    mode = 'view', // 'edit' | 'view'
    onElementSelect,
    canvasId,
    containerRef,
    buttonContainerRef,
    selectedElement,
    currentTime,
    isPlaying,
    onElementsChange
}) {
    const [initialized, setInitialized] = useState(false);
    const [localSelected, setLocalSelected] = useState(null);
    const actualSelected = selectedElement !== undefined ? selectedElement : localSelected;

    // DEBUG: Проверяем, что контейнер есть
    useEffect(() => {
        console.log('DEBUG: useFabricCanvas mount, containerRef:', containerRef?.current);
    }, []);

    // DEBUG: Глобальный обработчик клика
    useEffect(() => {
        const handler = (e) => {
            console.log('DEBUG: GLOBAL CLICK', e.target);
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, []);

    // Инициализация canvas и контейнера
    useEffect(() => {
        if (!containerRef.current) return;

        // Создаем отдельный контейнер для canvas
        const canvasContainer = document.createElement('div');
        canvasContainer.id = `fabric-container-${canvasId}`;
        canvasContainer.style.position = 'absolute';
        canvasContainer.style.top = '0';
        canvasContainer.style.left = '0';
        canvasContainer.style.width = '100%';
        canvasContainer.style.height = '100%';
        canvasContainer.style.pointerEvents = 'auto';
        containerRef.current.appendChild(canvasContainer);

        // Создаем canvas
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;

        setTimeout(() => {
            canvas.width = canvasContainer.clientWidth;
            canvas.height = canvasContainer.clientHeight;
            canvasContainer.appendChild(canvas);

            // Инициализируем Fabric
            const fabricCanvas = new fabric.Canvas(canvasId, {
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight,
                backgroundColor: 'rgba(0, 0, 0, 0)',
                preserveObjectStacking: true
            });

            console.log('DEBUG: Fabric canvas created:', fabricCanvas, 'canvasId:', canvasId);

            fabricInstances.set(canvasId, fabricCanvas);
            setInitialized(true);

            return () => {
                if (fabricInstances.has(canvasId)) {
                    const instance = fabricInstances.get(canvasId);
                    instance.dispose();
                    fabricInstances.delete(canvasId);
                }
            };
        }, 0);

        // Контейнер для кнопок
        if (buttonContainerRef) {
            const btnContainer = document.createElement('div');
            btnContainer.id = `btn-container-${canvasId}`;
            btnContainer.style.position = 'absolute';
            btnContainer.style.top = '0';
            btnContainer.style.left = '0';
            btnContainer.style.width = '100%';
            btnContainer.style.height = '100%';
            btnContainer.style.pointerEvents = 'none';
            btnContainer.style.zIndex = '10';
            containerRef.current.appendChild(btnContainer);
            buttonContainerRef.current = btnContainer;
        }

        return () => {
            if (containerRef.current) {
                const canvasContainer = document.getElementById(`fabric-container-${canvasId}`);
                if (canvasContainer) containerRef.current.removeChild(canvasContainer);
                if (buttonContainerRef && buttonContainerRef.current) {
                    containerRef.current.removeChild(buttonContainerRef.current);
                }
            }
        };
    }, []);

    // Рендер объектов и настройка canvas/обработчиков
    useEffect(() => {
        if (!initialized || !fabricInstances.has(canvasId)) return;
        const fabricCanvas = fabricInstances.get(canvasId);
        fabricCanvas.clear();
        const isEdit = mode === 'edit';
        const imagePromises = [];
        elements.forEach((element) => {
            let fabricObject;
            const baseProps = {
                left: element.position.x,
                top: element.position.y,
                selectable: true,
                evented: true,
                hasControls: isEdit,
                hasBorders: isEdit,
                opacity: typeof element.style?.opacity === 'number' ? element.style.opacity : 1
            };
            switch (element.type) {
                case 'rectangle':
                    fabricObject = new fabric.Rect({
                        ...baseProps,
                        width: element.size.width,
                        height: element.size.height,
                        fill: element.style.backgroundColor || '#cccccc',
                        stroke: element.style.borderColor || '#000000',
                        strokeWidth: element.style.borderWidth || 1
                    });
                    fabricObject.data = { elementId: element.id, element };
                    fabricCanvas.add(fabricObject);
                    console.log('DEBUG: Added rectangle', fabricObject, 'selectable:', fabricObject.selectable);
                    break;
                case 'circle':
                    fabricObject = new fabric.Circle({
                        ...baseProps,
                        radius: Math.min(element.size.width, element.size.height) / 2,
                        fill: element.style.backgroundColor || '#cccccc',
                        stroke: element.style.borderColor || '#000000',
                        strokeWidth: element.style.borderWidth || 1
                    });
                    fabricObject.data = { elementId: element.id, element };
                    fabricCanvas.add(fabricObject);
                    console.log('DEBUG: Added circle', fabricObject, 'selectable:', fabricObject.selectable);
                    break;
                case 'text':
                    fabricObject = new fabric.Text(element.content || 'Text', {
                        ...baseProps,
                        fontSize: element.size.height,
                        fill: element.style.color || '#000000'
                    });
                    fabricObject.data = { elementId: element.id, element };
                    fabricCanvas.add(fabricObject);
                    console.log('DEBUG: Added text', fabricObject, 'selectable:', fabricObject.selectable);
                    break;
                case 'image':
                    imagePromises.push(new Promise((resolve) => {
                        fabric.Image.fromURL(element.content, (img) => {
                            img.set({
                                ...baseProps,
                                scaleX: element.size.width / (img.width || 1),
                                scaleY: element.size.height / (img.height || 1)
                            });
                            img.data = { elementId: element.id, element };
                            fabricCanvas.add(img);
                            console.log('DEBUG: Added image', img, 'selectable:', img.selectable);
                            resolve();
                        }, { crossOrigin: 'anonymous' });
                    }));
                    break;
                default:
                    break;
            }
        });
        // После добавления всех объектов — настройки canvas
        fabricCanvas.selection = true;
        fabricCanvas.skipTargetFind = false;
        fabricCanvas.defaultCursor = isEdit ? 'move' : 'pointer';
        fabricCanvas.hoverCursor = isEdit ? 'move' : 'pointer';
        fabricCanvas.renderAll();

        // DEBUG: mouse:down на fabricCanvas
        fabricCanvas.on('mouse:down', (e) => {
            if (e.target) {
                console.log('DEBUG: mouse:down on object', e.target, e.target.data);
            } else {
                console.log('DEBUG: mouse:down on canvas background');
            }
        });

        // Сброс обработчиков
        fabricCanvas.off('selection:created');
        fabricCanvas.off('selection:updated');
        fabricCanvas.off('selection:cleared');
        fabricCanvas.off('object:moving');
        fabricCanvas.off('object:modified');

        // DEBUG: логируем навешивание обработчиков выделения
        console.log('DEBUG: Навешиваем обработчики выделения на fabricCanvas', fabricCanvas, 'mode:', mode);

        // Обработчики выделения (всегда)
        fabricCanvas.on('selection:created', (e) => {
            console.log('DEBUG: selection:created', e);
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];
                if (selectedObject.data && selectedObject.data.elementId) {
                    let element = elements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
                        if (onElementSelect) onElementSelect(element);
                        if (selectedElement === undefined) setLocalSelected(element);
                    }
                }
            }
        });
        fabricCanvas.on('selection:updated', (e) => {
            console.log('DEBUG: selection:updated', e);
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];
                if (selectedObject.data && selectedObject.data.elementId) {
                    let element = elements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
                        if (onElementSelect) onElementSelect(element);
                        if (selectedElement === undefined) setLocalSelected(element);
                    }
                }
            }
        });
        fabricCanvas.on('selection:cleared', () => {
            console.log('DEBUG: selection:cleared');
            if (onElementSelect) onElementSelect(null);
            if (selectedElement === undefined) setLocalSelected(null);
        });

        // Только для режима edit — обработчики перемещения/масштабирования
        if (isEdit && onElementsChange) {
            fabricCanvas.on('object:moving', (e) => {
                const obj = e.target;
                if (obj && obj.data && obj.data.elementId) {
                    const updatedElements = elements.map(el =>
                        el.id === obj.data.elementId
                            ? { ...el, position: { x: obj.left, y: obj.top } }
                            : el
                    );
                    onElementsChange(updatedElements);
                }
            });
            fabricCanvas.on('object:modified', (e) => {
                const obj = e.target;
                if (obj && obj.data && obj.data.elementId) {
                    const updatedElements = elements.map(el => {
                        if (el.id === obj.data.elementId) {
                            let newSize = el.size;
                            if (obj.type === 'rect' || obj.type === 'circle') {
                                newSize = {
                                    width: obj.width * (obj.scaleX || 1),
                                    height: obj.height * (obj.scaleY || 1)
                                };
                            }
                            return {
                                ...el,
                                position: { x: obj.left, y: obj.top },
                                size: newSize,
                                style: {
                                    ...el.style,
                                    opacity: obj.opacity || 1
                                }
                            };
                        }
                        return el;
                    });
                    onElementsChange(updatedElements);
                }
            });
        }
    }, [initialized, elements, mode]);

    return {
        initialized,
        fabricCanvas: fabricInstances.get(canvasId),
        selected: actualSelected,
        setSelected: setLocalSelected
    };
} 