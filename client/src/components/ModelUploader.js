import React, { useState, useRef } from 'react';
import {
    Box,
    Button,
    Typography,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField
} from '@mui/material';
import { Upload, Delete, Visibility } from '@mui/icons-material';
import axios from 'axios';

const ModelUploader = ({ onSelectModel }) => {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [modelName, setModelName] = useState('');
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Fetch models on component mount
    React.useEffect(() => {
        fetchModels();
    }, []);

    // Fetch available models from server
    const fetchModels = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get('/api/models');
            setModels(response.data);
        } catch (err) {
            console.error('Error fetching models:', err);
            setError('Failed to load models. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // Handle file selection
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.glb')) {
            setSelectedFile(file);
            // Extract name from filename without extension
            const baseName = file.name.split('.').slice(0, -1).join('.');
            setModelName(baseName);
            setUploadDialogOpen(true);
        } else {
            setError('Please select a valid .glb file');
        }
    };

    // Handle model upload
    const handleUpload = async () => {
        if (!selectedFile || !modelName.trim()) return;

        setLoading(true);
        setError(null);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('model', selectedFile);
        formData.append('name', modelName);

        try {
            const response = await axios.post('/api/models/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setUploadProgress(percentCompleted);
                }
            });

            // Add the new model to the list
            setModels([...models, response.data]);
            setUploadDialogOpen(false);
            setSelectedFile(null);
            setModelName('');
        } catch (err) {
            console.error('Error uploading model:', err);
            setError('Failed to upload model. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle model deletion
    const handleDeleteModel = async (modelId) => {
        if (!window.confirm('Are you sure you want to delete this model?')) return;

        setLoading(true);
        setError(null);

        try {
            await axios.delete(`/api/models/${modelId}`);
            // Remove the deleted model from the list
            setModels(models.filter(model => model.id !== modelId));
        } catch (err) {
            console.error('Error deleting model:', err);
            setError('Failed to delete model. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle model selection
    const handleSelectModel = (model) => {
        if (onSelectModel) {
            onSelectModel(model);
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">3D Models</Typography>
                <Button
                    variant="contained"
                    startIcon={<Upload />}
                    onClick={() => fileInputRef.current.click()}
                    disabled={loading}
                >
                    Upload Model
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".glb"
                    onChange={handleFileSelect}
                />
            </Box>

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>
                    {error}
                </Typography>
            )}

            {loading && !uploadDialogOpen && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {models.length > 0 ? (
                <List sx={{ bgcolor: 'background.paper' }}>
                    {models.map((model) => (
                        <ListItem
                            key={model.id}
                            secondaryAction={
                                <Box>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleSelectModel(model)}
                                        title="Use this model"
                                    >
                                        <Visibility />
                                    </IconButton>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleDeleteModel(model.id)}
                                        title="Delete model"
                                    >
                                        <Delete />
                                    </IconButton>
                                </Box>
                            }
                        >
                            <ListItemText
                                primary={model.name}
                                secondary={`Uploaded: ${new Date(model.createdAt).toLocaleDateString()}`}
                            />
                        </ListItem>
                    ))}
                </List>
            ) : !loading && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No models uploaded yet. Click "Upload Model" to add your first 3D model.
                </Typography>
            )}

            {/* Upload Dialog */}
            <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)}>
                <DialogTitle>Upload 3D Model</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Model Name"
                        fullWidth
                        variant="outlined"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                    />
                    {selectedFile && (
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            File: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                        </Typography>
                    )}
                    {loading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                            <CircularProgress variant="determinate" value={uploadProgress} size={24} sx={{ mr: 1 }} />
                            <Typography variant="body2">{uploadProgress}%</Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!selectedFile || !modelName.trim() || loading}
                        variant="contained"
                    >
                        Upload
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ModelUploader; 