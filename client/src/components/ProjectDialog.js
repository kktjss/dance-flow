import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, Box, Grid, Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Add, FolderOpen } from '@mui/icons-material';
import ProjectsList from './ProjectsList';

// Стили компонента в соответствии с ProjectsList.js
const styles = {
    dialogPaper: {
        backgroundColor: 'rgba(32, 38, 52, 0.95)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'none',
        maxWidth: '90%',
        width: '1000px',
        margin: '0 auto',
        overflow: 'hidden',
        // Адаптивные стили для мобильных устройств
        '@media (max-width: 600px)': {
            width: '95%',
            maxHeight: '90vh'
        }
    },
    dialogTitle: {
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column'
    },
    dialogContent: {
        padding: '24px'
    },
    dialogActions: {
        padding: '16px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
    },
    button: {
        borderRadius: '12px',
        padding: '12px 24px',
        fontWeight: 600,
        textTransform: 'none',
        transition: 'all 0.2s'
    },
    actionButton: {
        padding: '24px',
        borderRadius: '12px',
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '1rem',
        minHeight: '4.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        transition: 'all 0.2s',
        '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)'
        }
    },
    iconContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        padding: '12px',
        marginBottom: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    textField: {
        '& .MuiOutlinedInput-root': {
            borderRadius: '12px'
        },
        marginBottom: '16px',
        '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)'
        },
        '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.2)'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.3)'
        },
        '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'primary.main'
        }
    },
    title: {
        fontWeight: 600,
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center'
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '0.95rem'
    },
    gridContainer: {
        marginTop: '16px'
    }
};

// Переработанная кнопка выбора действия
const ActionButton = ({ icon, text, onClick, variant = 'contained', color = 'primary' }) => (
    <Button
        variant={variant}
        color={color}
        onClick={onClick}
        sx={{
            ...styles.actionButton,
            ...(variant === 'outlined' ? {
                borderColor: 'rgba(255, 255, 255, 0.2)',
                '&:hover': {
                    ...styles.actionButton['&:hover'],
                    borderColor: 'rgba(255, 255, 255, 0.4)'
                }
            } : {})
        }}
    >
        <Box sx={{
            ...styles.iconContainer,
            backgroundColor: variant === 'contained'
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(255, 255, 255, 0.1)'
        }}>
            {icon}
        </Box>
        {text}
    </Button>
);

// Стилизованный диалог с полностью прозрачным фоном для списка проектов
const TransparentDialog = styled(Dialog)(({ theme }) => ({
    // Полностью прозрачный фон и backdrop
    '& .MuiBackdrop-root': {
        backgroundColor: 'transparent',
        backdropFilter: 'none',
        opacity: '0 !important' // Принудительно делаем прозрачным
    },
    // Прозрачная бумага диалога
    '& .MuiDialog-paper': {
        backgroundColor: 'transparent',
        boxShadow: 'none',
        maxWidth: '100%',
        width: '100%',
        height: '100%',
        margin: 0,
        maxHeight: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'none' // Убираем любой эффект размытия
    },
    // Убираем отступы в содержимом
    '& .MuiDialogContent-root': {
        padding: 0,
        overflow: 'hidden'
    }
}));

// Стилизуем обычный диалог для согласованности
const StyledDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        backgroundColor: 'rgba(32, 38, 52, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        overflow: 'hidden'
    },
    // Полностью убираем затемнение фона
    '& .MuiBackdrop-root': {
        backgroundColor: 'rgba(0, 0, 0, 0)'
    },
    // Стиль для полей ввода
    '& .MuiInputBase-root': {
        color: 'rgba(255, 255, 255, 0.9)'
    },
    '& .MuiSwitch-switchBase.Mui-checked': {
        color: theme.palette.primary.main
    },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
        backgroundColor: theme.palette.primary.main
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
        console.log('ProjectDialog - handleProjectSelect called with:', projectId);

        // Если projectId является объектом, извлекаем ID
        if (typeof projectId === 'object' && projectId !== null) {
            const id = projectId._id || projectId.id;
            if (id) {
                console.log('ProjectDialog - Extracted ID from project object:', id);
                onSelectProject(id);
            } else {
                console.error('ProjectDialog - Invalid project object, no ID found:', projectId);
            }
        } else {
            console.log('ProjectDialog - Using ID directly:', projectId);
            onSelectProject(projectId);
        }

        onClose();
    };

    const handleCreateNewWithDetails = () => {
        console.log('ProjectDialog - handleCreateNewWithDetails called with:', {
            name: projectName || 'Новый проект',
            description: projectDescription
        });

        onCreateNew({
            name: projectName || 'Новый проект',
            description: projectDescription
        });
        onClose();
    };

    const handleBack = () => {
        console.log('ProjectDialog - handleBack called, closing projects list');
        setShowNewProjectForm(false);
        setShowProjectsList(false);
    };

    // Обработчик клика по фону для закрытия списка проектов (для более естественного UX)
    const handleBackdropClick = (e) => {
        // Проверяем, что клик был по фону, а не по содержимому
        if (e.target === e.currentTarget) {
            console.log('ProjectDialog - backdrop clicked, closing projects list');
            handleBack();
        }
    };

    // Используем разные диалоги в зависимости от состояния
    const DialogComponent = showProjectsList ? TransparentDialog : StyledDialog;

    return (
        <DialogComponent
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            {!showNewProjectForm && !showProjectsList ? (
                <>
                    <DialogTitle sx={styles.dialogTitle}>
                        <Typography variant="h5" component="div" gutterBottom sx={styles.title}>
                            <FolderOpen sx={{ mr: 1, opacity: 0.9 }} />
                            Конструктор хореографии
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={styles.subtitle}>
                            Выберите действие для начала работы
                        </Typography>
                    </DialogTitle>
                    <DialogContent sx={styles.dialogContent}>
                        <Grid container spacing={3} sx={styles.gridContainer}>
                            <Grid item xs={12} sm={6}>
                                <ActionButton
                                    icon={<Add sx={{ fontSize: 28 }} />}
                                    text="Создать новый проект"
                                    onClick={handleCreateNewClick}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <ActionButton
                                    icon={<FolderOpen sx={{ fontSize: 28 }} />}
                                    text="Открыть существующий проект"
                                    onClick={handleOpenProjectsClick}
                                    variant="outlined"
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                </>
            ) : showNewProjectForm ? (
                <>
                    <DialogTitle sx={styles.dialogTitle}>
                        <Typography variant="h5" component="div" sx={styles.title}>
                            <Add sx={{ mr: 1, opacity: 0.9 }} />
                            Создание нового проекта
                        </Typography>
                    </DialogTitle>
                    <DialogContent sx={styles.dialogContent}>
                        <Box sx={{ pt: 1 }}>
                            <TextField
                                autoFocus
                                margin="dense"
                                label="Название проекта"
                                fullWidth
                                variant="outlined"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                sx={styles.textField}
                                placeholder="Введите название проекта"
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
                                sx={styles.textField}
                                placeholder="Добавьте краткое описание проекта"
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={styles.dialogActions}>
                        <Button
                            onClick={handleBack}
                            variant="text"
                            sx={styles.button}
                            color="inherit"
                        >
                            Назад
                        </Button>
                        <Button
                            onClick={handleCreateNewWithDetails}
                            variant="contained"
                            color="primary"
                            sx={{ ...styles.button, ml: 1 }}
                            disabled={!projectName.trim()}
                        >
                            Создать
                        </Button>
                    </DialogActions>
                </>
            ) : (
                <Box sx={{
                    height: '100vh',
                    width: '100vw',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1300,
                    backgroundColor: 'transparent',
                    pointerEvents: 'auto', // Для обработки кликов
                    backdropFilter: 'none', // Явно убираем размытие
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'transparent',
                        pointerEvents: 'none'
                    }
                }}
                    onClick={handleBackdropClick}
                >
                    <ProjectsList
                        onSelectProject={handleProjectSelect}
                        setShowProjects={handleBack}
                        isDialog={true}
                        onCreateNewProject={(projectData) => {
                            console.log('ProjectDialog - onCreateNewProject called with:', projectData);
                            // Создаем проект и возвращаем его с ID
                            const newProject = onCreateNew(projectData);
                            return newProject;
                        }}
                    />
                </Box>
            )}
        </DialogComponent>
    );
};

export default ProjectDialog;