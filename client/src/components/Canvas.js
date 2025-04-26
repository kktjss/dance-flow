import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Box } from '@mui/material';

const Canvas = ({ elements, currentTime, isPlaying, onElementsChange }) => {
    const canvasRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const [selectedElement, setSelectedElement] = useState(null);

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

    // Update canvas when elements change
    useEffect(() => {
        if (!fabricCanvasRef.current) return;

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

                            fabricCanvasRef.current.add(img);
                            fabricCanvasRef.current.renderAll();
                        });
                        return; // Skip the rest for images as they're added asynchronously

                    default:
                        return; // Skip unknown types
                }

                // Add data attribute to identify the element
                fabricObject.data = { elementId: element.id };

                // Add to canvas
                fabricCanvasRef.current.add(fabricObject);
            }
        });

        // Apply animation effects if playing
        if (isPlaying) {
            elements.forEach(element => {
                if (element.animation && element.animation.effects) {
                    element.animation.effects.forEach(effect => {
                        if (currentTime >= effect.startTime && currentTime <= effect.endTime) {
                            // Find the fabric object for this element
                            const fabricObject = fabricCanvasRef.current.getObjects().find(
                                obj => obj.data && obj.data.elementId === element.id
                            );

                            if (fabricObject) {
                                // Apply animation effect
                                switch (effect.type) {
                                    case 'fade':
                                        const progress = (currentTime - effect.startTime) / (effect.endTime - effect.startTime);
                                        fabricObject.set('opacity', effect.params.startOpacity +
                                            (effect.params.endOpacity - effect.params.startOpacity) * progress);
                                        break;
                                    case 'move':
                                        // Similar implementation for move animation
                                        break;
                                    // Add more effect types as needed
                                }
                            }
                        }
                    });
                }
            });
        }

        fabricCanvasRef.current.renderAll();
    }, [elements, currentTime, isPlaying]);

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
        if (!fabricCanvasRef.current) return;

        const handleSelection = (e) => {
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];
                if (selectedObject.data && selectedObject.data.elementId) {
                    const element = elements.find(el => el.id === selectedObject.data.elementId);
                    setSelectedElement(element);
                }
            } else {
                setSelectedElement(null);
            }
        };

        fabricCanvasRef.current.on('selection:created', handleSelection);
        fabricCanvasRef.current.on('selection:updated', handleSelection);
        fabricCanvasRef.current.on('selection:cleared', () => setSelectedElement(null));

        return () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.off('selection:created', handleSelection);
                fabricCanvasRef.current.off('selection:updated', handleSelection);
                fabricCanvasRef.current.off('selection:cleared');
            }
        };
    }, [elements]);

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