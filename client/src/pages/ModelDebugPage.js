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
                3D Model Manager
            </Typography>

            <Paper elevation={3} sx={{ p: 2, mb: 4 }}>
                <Typography variant="body1" gutterBottom>
                    This page allows you to upload, manage, and preview 3D models in GLB format.
                    You can upload your own models and use them in your dance flow projects.
                </Typography>
            </Paper>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    aria-label="model tabs"
                >
                    <Tab label="Model Uploader" />
                    <Tab label="Model Viewer" />
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
                        Please select a model from the Model Uploader tab to preview it here.
                    </Typography>
                )}
            </TabPanel>
        </Container>
    );
};

export default ModelDebugPage; 