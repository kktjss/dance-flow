import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, Box, Grid
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Add, FolderOpen } from '@mui/icons-material';
import ProjectsList from './ProjectsList';

const StyledButton = styled(Button)(({ theme }) => ({
    padding: theme.spacing(2, 3),
    borderRadius: '12px',
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '1rem',
    minHeight: '4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    transition: 'all 0.2s',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: theme.palette.mode === 'dark'
            ? '0 6px 16px rgba(30, 144, 255, 0.3)'
            : '0 6px 16px rgba(30, 144, 255, 0.2)',
    }
}));

const ProjectDialog = ({
    open,
    onClose,
    onCreateNew,
    onSelectProject,
    createNewWithDetails
}) => {
    const [showNewProjectForm, setShowNewProjectForm] = useState(false);
    const [showProjectsList, setShowProjectsList] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');

    const handleCreateNewClick = () => {
        if (createNewWithDetails) {
            setShowNewProjectForm(true);
        } else {
            onCreateNew();
            onClose();
        }
    };

    const handleOpenProjectsClick = () => {
        setShowProjectsList(true);
    };

    const handleProjectSelect = (projectId) => {
        onSelectProject(projectId);
        onClose();
    };

    const handleCreateNewWithDetails = () => {
        onCreateNew({
            name: projectName || 'Новый проект',
            description: projectDescription
        });
        onClose();
    };

    const handleBack = () => {
        setShowNewProjectForm(false);
        setShowProjectsList(false);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            {!showNewProjectForm && !showProjectsList ? (
                <>
                    <DialogTitle>
                        <Typography variant="h5" component="div" gutterBottom sx={{ fontWeight: 600 }}>
                            Конструктор хореографии
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Выберите действие для начала работы
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Grid container spacing={3} sx={{ mt: 1 }}>
                            <Grid item xs={12} sm={6}>
                                <StyledButton
                                    variant="contained"
                                    color="primary"
                                    startIcon={<Add sx={{ fontSize: 28 }} />}
                                    onClick={handleCreateNewClick}
                                >
                                    Создать новый проект
                                </StyledButton>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <StyledButton
                                    variant="outlined"
                                    startIcon={<FolderOpen sx={{ fontSize: 28 }} />}
                                    onClick={handleOpenProjectsClick}
                                >
                                    Открыть существующий проект
                                </StyledButton>
                            </Grid>
                        </Grid>
                    </DialogContent>
                </>
            ) : showNewProjectForm ? (
                <>
                    <DialogTitle>Создание нового проекта</DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 1 }}>
                            <TextField
                                autoFocus
                                margin="dense"
                                label="Название проекта"
                                fullWidth
                                variant="outlined"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                margin="dense"
                                label="Описание (опционально)"
                                fullWidth
                                multiline
                                rows={3}
                                variant="outlined"
                                value={projectDescription}
                                onChange={(e) => setProjectDescription(e.target.value)}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3 }}>
                        <Button onClick={handleBack} variant="text">
                            Назад
                        </Button>
                        <Button
                            onClick={handleCreateNewWithDetails}
                            variant="contained"
                            color="primary"
                        >
                            Создать
                        </Button>
                    </DialogActions>
                </>
            ) : (
                <Box sx={{ height: '80vh', position: 'relative' }}>
                    <ProjectsList
                        onSelectProject={handleProjectSelect}
                        setShowProjects={handleBack}
                        isDialog={true}
                    />
                </Box>
            )}
        </Dialog>
    );
};

export default ProjectDialog; 