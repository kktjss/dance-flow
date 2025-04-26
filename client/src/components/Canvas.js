import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Box } from '@mui/material';

const Canvas = ({ elements, currentTime, isPlaying, onElementsChange, selectedElement, onElementSelect }) => {
    const canvasRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const [isRecordingKeyframe, setIsRecordingKeyframe] = useState(false);

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
        if (!element.keyframes || element.keyframes.length < 2) return;

        // Find the two keyframes we're between
        let prevKeyframe = null;
        let nextKeyframe = null;

        // Sort keyframes by time
        const sortedKeyframes = [...element.keyframes].sort((a, b) => a.time - b.time);

        for (let i = 0; i < sortedKeyframes.length; i++) {
            if (sortedKeyframes[i].time <= currentTime) {
                prevKeyframe = sortedKeyframes[i];
            }

            if (sortedKeyframes[i].time > currentTime && !nextKeyframe) {
                nextKeyframe = sortedKeyframes[i];
            }
        }

        // If we don't have both keyframes, use the closest one
        if (!prevKeyframe) {
            prevKeyframe = sortedKeyframes[0];
        }

        if (!nextKeyframe) {
            // Use the last keyframe's properties
            fabricObject.set({
                left: prevKeyframe.position.x,
                top: prevKeyframe.position.y,
                opacity: prevKeyframe.opacity,
                scaleX: prevKeyframe.scale,
                scaleY: prevKeyframe.scale
            });
            return;
        }

        // Calculate progress between keyframes
        const totalDuration = nextKeyframe.time - prevKeyframe.time;
        if (totalDuration === 0) return;

        const progress = (currentTime - prevKeyframe.time) / totalDuration;

        // Interpolate position
        const currentX = prevKeyframe.position.x + (nextKeyframe.position.x - prevKeyframe.position.x) * progress;
        const currentY = prevKeyframe.position.y + (nextKeyframe.position.y - prevKeyframe.position.y) * progress;

        // Interpolate opacity
        const currentOpacity = prevKeyframe.opacity + (nextKeyframe.opacity - prevKeyframe.opacity) * progress;

        // Interpolate scale
        const currentScale = prevKeyframe.scale + (nextKeyframe.scale - prevKeyframe.scale) * progress;

        // Apply properties
        fabricObject.set({
            left: currentX,
            top: currentY,
            opacity: currentOpacity,
            scaleX: currentScale,
            scaleY: currentScale
        });
    };

    // Helper to add or update a keyframe for an element
    const addOrUpdateKeyframe = useCallback((element, time, properties) => {
        // Create a deep copy of the element
        const updatedElement = JSON.parse(JSON.stringify(element));

        // Initialize keyframes array if it doesn't exist
        if (!updatedElement.keyframes) {
            updatedElement.keyframes = [];
        }

        // Check if a keyframe already exists at this time
        const existingKeyframeIndex = updatedElement.keyframes.findIndex(k => Math.abs(k.time - time) < 0.01);

        if (existingKeyframeIndex >= 0) {
            // Update existing keyframe
            updatedElement.keyframes[existingKeyframeIndex] = {
                ...updatedElement.keyframes[existingKeyframeIndex],
                ...properties,
                time
            };
        } else {
            // Add new keyframe
            updatedElement.keyframes.push({
                time,
                ...properties
            });
        }

        // Sort keyframes by time
        updatedElement.keyframes.sort((a, b) => a.time - b.time);

        return updatedElement;
    }, []);

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

                            // Apply animation effects based on keyframes
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

                // Apply animation effects based on keyframes
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

    // Handle object modifications for keyframe recording
    useEffect(() => {
        if (!fabricCanvasRef.current) return;

        const handleObjectModified = (e) => {
            const modifiedObject = e.target;
            if (!modifiedObject || !modifiedObject.data || !modifiedObject.data.elementId) return;

            const elementId = modifiedObject.data.elementId;
            const element = elements.find(el => el.id === elementId);

            if (!element) return;

            // Create updatedElements array
            let updatedElements;

            // Normal update (position, size)
            const basicUpdate = {
                position: {
                    x: modifiedObject.left,
                    y: modifiedObject.top
                },
                size: {
                    width: modifiedObject.width * (modifiedObject.scaleX || 1),
                    height: modifiedObject.height * (modifiedObject.scaleY || 1)
                }
            };

            // If we're recording a keyframe, also update the keyframes array
            if (isRecordingKeyframe) {
                // Create properties to save in the keyframe
                const keyframeProps = {
                    position: {
                        x: modifiedObject.left,
                        y: modifiedObject.top
                    },
                    opacity: modifiedObject.opacity,
                    scale: modifiedObject.scaleX || 1
                };

                // Add or update keyframe for the current time
                const updatedElement = addOrUpdateKeyframe(
                    element,
                    currentTime,
                    keyframeProps
                );

                // Update elements list with the modified element
                updatedElements = elements.map(elem =>
                    elem.id === elementId ? updatedElement : elem
                );
            } else {
                // Just update the basic properties
                updatedElements = elements.map(elem =>
                    elem.id === elementId ? { ...elem, ...basicUpdate } : elem
                );
            }

            onElementsChange(updatedElements);
        };

        fabricCanvasRef.current.on('object:modified', handleObjectModified);

        return () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.off('object:modified', handleObjectModified);
            }
        };
    }, [elements, onElementsChange, isRecordingKeyframe, currentTime, addOrUpdateKeyframe]);

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

    // Toggle keyframe recording
    const toggleKeyframeRecording = () => {
        setIsRecordingKeyframe(prev => !prev);
    };

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
            <Box
                sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 100,
                    backgroundColor: isRecordingKeyframe ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 1,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                }}
                onClick={toggleKeyframeRecording}
            >
                {isRecordingKeyframe ? 'Запись ключевых кадров (ВКЛ)' : 'Запись ключевых кадров (ВЫКЛ)'}
            </Box>
            <canvas ref={canvasRef} />
        </Box>
    );
};

export default Canvas; 