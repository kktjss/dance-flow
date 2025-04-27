import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Grid } from '@react-three/drei';
import { Box as MuiBox, CircularProgress, Button } from '@mui/material';

// Model component for Hatsune Miku
const MikuModel = () => {
    const gltf = useGLTF('/models/hatsune_miku.glb');

    return (
        <primitive
            object={gltf.scene}
            scale={1}
            position={[0, -1, 0]}
            rotation={[0, 0, 0]}
        />
    );
};

const ModelViewer = ({ isVisible, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate loading the engine
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <MuiBox
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1000,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {isLoading ? (
                <MuiBox sx={{ color: 'white', textAlign: 'center' }}>
                    <CircularProgress color="primary" size={60} />
                    <MuiBox mt={2}>Загрузка 3D движка...</MuiBox>
                </MuiBox>
            ) : (
                <MuiBox sx={{ width: '90%', height: '80%', border: '1px solid #444' }}>
                    <Canvas style={{ background: '#111' }}>
                        <ambientLight intensity={0.6} />
                        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
                        <directionalLight position={[-5, 5, 5]} intensity={0.5} />
                        <directionalLight position={[0, 5, -5]} intensity={0.5} />
                        <PerspectiveCamera makeDefault position={[0, 1, 5]} />
                        <Suspense fallback={null}>
                            <MikuModel />
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
                        </Suspense>
                        <OrbitControls />
                    </Canvas>
                </MuiBox>
            )}

            <Button
                variant="contained"
                color="primary"
                onClick={onClose}
                sx={{ mt: 2 }}
            >
                Закрыть
            </Button>
        </MuiBox>
    );
};

// Preload the model
useGLTF.preload('/models/hatsune_miku.glb');

export default ModelViewer; 