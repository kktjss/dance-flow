import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import { Box } from '@mui/material';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Simple model component
const SimpleModel = ({ modelUrl = '/models/xbot.glb' }) => {
    const [model, setModel] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loader = new GLTFLoader();

        setIsLoading(true);
        setError(null);

        // Process URL if needed
        const processedUrl = modelUrl.startsWith('/') && !modelUrl.startsWith('//')
            ? `${window.location.origin}${modelUrl}`
            : modelUrl;

        loader.load(
            processedUrl,
            (gltf) => {
                console.log('Model loaded successfully:', gltf);
                console.log('Animations:', gltf.animations);

                // Apply default transformations
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                setModel(gltf);
                setIsLoading(false);
            },
            (xhr) => {
                console.log(`Loading progress: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
            },
            (error) => {
                console.error('Error loading GLB model:', error);
                setError(error);
                setIsLoading(false);
            }
        );
    }, [modelUrl]);

    return (
        <>
            {isLoading && (
                <mesh position={[0, 0, 0]}>
                    <sphereGeometry args={[0.5, 16, 16]} />
                    <meshStandardMaterial color="gray" wireframe />
                </mesh>
            )}

            {error && (
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="red" />
                </mesh>
            )}

            {model && !isLoading && !error && (
                <primitive
                    object={model.scene}
                    scale={[1.0, 1.0, 1.0]}
                    position={[0, 0, 0]}
                />
            )}

            {/* Grid for reference */}
            <Grid
                position={[0, -1, 0]}
                args={[10, 10]}
                cellSize={1}
                cellThickness={1}
                cellColor="#555"
                sectionSize={3}
                sectionThickness={1.5}
                sectionColor="#888"
                fadeDistance={30}
            />
        </>
    );
};

// Debug viewer component
const DebugModelViewer = ({ modelUrl }) => {
    return (
        <Box sx={{ width: '100%', height: '500px' }}>
            <Canvas style={{ background: '#111' }}>
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <directionalLight position={[-5, 5, 5]} intensity={0.5} />
                <PerspectiveCamera makeDefault position={[0, 2, 10]} />
                <Suspense fallback={null}>
                    <SimpleModel modelUrl={modelUrl} />
                </Suspense>
                <OrbitControls
                    enableDamping
                    dampingFactor={0.1}
                    rotateSpeed={0.5}
                    enableZoom={true}
                    zoomSpeed={0.8}
                />
            </Canvas>
        </Box>
    );
};

export default DebugModelViewer; 