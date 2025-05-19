import React, { useState } from 'react';
import { Container, Typography, Box, Paper, Tabs, Tab } from '@mui/material';
import ModelViewer from '../components/ModelViewer';
import ModelUploader from '../components/ModelUploader';

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`model-tabpanel-${index}`}
            aria-labelledby={`model-tab-${index}`}
            {...other}
            style={{ width: '100%' }}
        >
            {value === index && (
                <Box sx={{ p: 2 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

const ModelDebugPage = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [selectedModel, setSelectedModel] = useState(null);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleModelSelect = (model) => {
        console.log('Selected model:', model);
        setSelectedModel(model);
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>
                Менеджер 3D-моделей
            </Typography>

            <Paper elevation={3} sx={{ p: 2, mb: 4 }}>
                <Typography variant="body1" gutterBottom>
                    Эта страница позволяет загружать, управлять и предпросматривать 3D-модели в формате GLB.
                    Вы можете загрузить свои собственные модели и использовать их в проектах Dance Flow.
                </Typography>
            </Paper>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    aria-label="model tabs"
                >
                    <Tab label="Загрузка моделей" />
                    <Tab label="Просмотр моделей" />
                </Tabs>
            </Box>

            <TabPanel value={activeTab} index={0}>
                <Paper elevation={2} sx={{ p: 3 }}>
                    <ModelUploader onSelectModel={handleModelSelect} />
                </Paper>
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
                <Paper elevation={2} sx={{ p: 0, height: '600px' }}>
                    <ModelViewer
                        isVisible={true}
                        embedded={true}
                        playerDuration={10}
                        glbAnimationUrl={selectedModel ? selectedModel.url : null}
                    />
                </Paper>

                {!selectedModel && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                        Пожалуйста, выберите модель во вкладке "Загрузка моделей", чтобы просмотреть её здесь.
                    </Typography>
                )}
            </TabPanel>
        </Container>
    );
};

export default ModelDebugPage; 