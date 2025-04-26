import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Box } from '@mui/material';

const Canvas = ({ elements, currentTime, isPlaying, onElementsChange, selectedElement, onElementSelect }) => {
    const canvasRef = useRef(null);
    const fabricCanvasRef = useRef(null);

    // Initialize fabric canvas
    useEffect(() => {
        fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
            width: 800,
            height: 600,
            backgroundColor: '#ffffff'
        });

        // Cleanup on component unmount
        return () => {
            fabricCanvasRef.current.dispose();
        };
    }, []);

    // Function to apply animation effects based on current time
    const applyAnimationEffects = (fabricObject, element) => {
        if (!element.animation || !element.animation.effects) return;

        element.animation.effects.forEach(effect => {
            if (currentTime >= effect.startTime && currentTime <= effect.endTime) {
                const progress = (currentTime - effect.startTime) / (effect.endTime - effect.startTime);

                switch (effect.type) {
                    case 'fade':
                        if (effect.params && 'startOpacity' in effect.params && 'endOpacity' in effect.params) {
                            const currentOpacity = effect.params.startOpacity +
                                (effect.params.endOpacity - effect.params.startOpacity) * progress;
                            fabricObject.set('opacity', currentOpacity);
                        }
                        break;

                    case 'move':
                        if (effect.params && effect.params.startPosition && effect.params.endPosition) {
                            const currentX = effect.params.startPosition.x +
                                (effect.params.endPosition.x - effect.params.startPosition.x) * progress;
                            const currentY = effect.params.startPosition.y +
                                (effect.params.endPosition.y - effect.params.startPosition.y) * progress;

                            fabricObject.set({
                                left: currentX,
                                top: currentY
                            });
                        }
                        break;

                    case 'scale':
                        if (effect.params && 'startScale' in effect.params && 'endScale' in effect.params) {
                            const currentScale = effect.params.startScale +
                                (effect.params.endScale - effect.params.startScale) * progress;

                            fabricObject.set({
                                scaleX: currentScale,
                                scaleY: currentScale
                            });
                        }
                        break;

                    default:
                        break;
                }
            }
        });
    };

    // Update canvas when elements change or time changes
    useEffect(() => {
        if (!fabricCanvasRef.current) return;

        // Store the currently selected object ID before clearing the canvas
        const selectedObjectId = fabricCanvasRef.current.getActiveObject()?.data?.elementId;

        // Clear canvas
        fabricCanvasRef.current.clear();
        fabricCanvasRef.current.backgroundColor = '#ffffff';

        // Add elements to canvas
        elements.forEach(element => {
            // Check if element should be visible at current time
            const startTime = element.animation?.startTime || 0;
            const endTime = element.animation?.endTime;

            if (currentTime >= startTime && (endTime === null || currentTime <= endTime)) {
                let fabricObject;

                // Create fabric object based on element type
                switch (element.type) {
                    case 'rectangle':
                        fabricObject = new fabric.Rect({
                            left: element.position.x,
                            top: element.position.y,
                            width: element.size.width,
                            height: element.size.height,
                            fill: element.style.backgroundColor,
                            stroke: element.style.borderColor,
                            strokeWidth: element.style.borderWidth,
                            opacity: element.style.opacity,
                        });
                        break;

                    case 'circle':
                        fabricObject = new fabric.Circle({
                            left: element.position.x,
                            top: element.position.y,
                            radius: Math.min(element.size.width, element.size.height) / 2,
                            fill: element.style.backgroundColor,
                            stroke: element.style.borderColor,
                            strokeWidth: element.style.borderWidth,
                            opacity: element.style.opacity,
                        });
                        break;

                    case 'text':
                        fabricObject = new fabric.Textbox(element.content, {
                            left: element.position.x,
                            top: element.position.y,
                            width: element.size.width,
                            fill: element.style.color,
                            fontSize: 20,
                            opacity: element.style.opacity,
                        });
                        break;

                    case 'image':
                        // Load image from URL
                        fabric.Image.fromURL(element.content, (img) => {
                            img.set({
                                left: element.position.x,
                                top: element.position.y,
                                opacity: element.style.opacity,
                            });
                            img.scaleToWidth(element.size.width);
                            img.scaleToHeight(element.size.height);

                            // Add data attribute to identify the element
                            img.data = { elementId: element.id };

                            // Apply animation effects
                            applyAnimationEffects(img, element);

                            fabricCanvasRef.current.add(img);

                            // If this was the selected element, select it again
                            if (selectedElement && element.id === selectedElement.id) {
                                fabricCanvasRef.current.setActiveObject(img);
                            }

                            fabricCanvasRef.current.renderAll();
                        });
                        return; // Skip the rest for images as they're added asynchronously

                    default:
                        return; // Skip unknown types
                }

                // Add data attribute to identify the element
                fabricObject.data = { elementId: element.id };

                // Apply animation effects based on current time
                applyAnimationEffects(fabricObject, element);

                // Add to canvas
                fabricCanvasRef.current.add(fabricObject);

                // If this was the selected element, select it again
                if (selectedElement && element.id === selectedElement.id) {
                    fabricCanvasRef.current.setActiveObject(fabricObject);
                }
            }
        });

        fabricCanvasRef.current.renderAll();
    }, [elements, currentTime, selectedElement]);

    // Setup animation timer if playing
    useEffect(() => {
        let animationFrame;

        const updateCanvas = () => {
            if (isPlaying) {
                fabricCanvasRef.current.renderAll();
                animationFrame = requestAnimationFrame(updateCanvas);
            }
        };

        if (isPlaying) {
            animationFrame = requestAnimationFrame(updateCanvas);
        }

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [isPlaying]);

    // Handle object modifications
    useEffect(() => {
        if (!fabricCanvasRef.current) return;

        const handleObjectModified = (e) => {
            const modifiedObject = e.target;
            if (!modifiedObject || !modifiedObject.data || !modifiedObject.data.elementId) return;

            const elementId = modifiedObject.data.elementId;
            const updatedElements = elements.map(element => {
                if (element.id === elementId) {
                    return {
                        ...element,
                        position: {
                            x: modifiedObject.left,
                            y: modifiedObject.top
                        },
                        size: {
                            width: modifiedObject.width * (modifiedObject.scaleX || 1),
                            height: modifiedObject.height * (modifiedObject.scaleY || 1)
                        }
                    };
                }
                return element;
            });

            onElementsChange(updatedElements);
        };

        fabricCanvasRef.current.on('object:modified', handleObjectModified);

        return () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.off('object:modified', handleObjectModified);
            }
        };
    }, [elements, onElementsChange]);

    // Handle element selection
    useEffect(() => {
        if (!fabricCanvasRef.current || !onElementSelect) return;

        const handleSelection = (e) => {
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];
                if (selectedObject.data && selectedObject.data.elementId) {
                    const element = elements.find(el => el.id === selectedObject.data.elementId);
                    onElementSelect(element);
                }
            } else {
                onElementSelect(null);
            }
        };

        fabricCanvasRef.current.on('selection:created', handleSelection);
        fabricCanvasRef.current.on('selection:updated', handleSelection);
        fabricCanvasRef.current.on('selection:cleared', () => onElementSelect(null));

        return () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.off('selection:created', handleSelection);
                fabricCanvasRef.current.off('selection:updated', handleSelection);
                fabricCanvasRef.current.off('selection:cleared');
            }
        };
    }, [elements, onElementSelect]);

    return (
        <Box
            sx={{
                width: '100%',
                height: 600,
                border: '1px solid #ccc',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1
            }}
        >
            <canvas ref={canvasRef} />
        </Box>
    );
};

export default Canvas; 