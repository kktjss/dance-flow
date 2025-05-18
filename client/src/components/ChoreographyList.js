import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    List,
    ListItem,
    ListItemText,
    IconButton,
    Typography,
    Box,
    Paper,
    Divider
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';

const ChoreographyList = ({ choreographies, onDelete }) => {
    const navigate = useNavigate();

    // Валидация ID проекта
    const navigateToProject = (projectId, route) => {
        if (!projectId || projectId === 'undefined' || projectId === 'null') {
            console.error('Attempted to navigate with invalid project ID:', projectId);
            return;
        }
        navigate(`${route}/${projectId}`);
    };

    if (!choreographies || choreographies.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                    У вас пока нет хореографий. Создайте новую!
                </Typography>
            </Box>
        );
    }

    return (
        <List>
            {choreographies.map((choreography, index) => {
                const uniqueKey = choreography._id || choreography.id || `choreography-${index}`;

                return (
                    <React.Fragment key={uniqueKey}>
                        <ListItem
                            alignItems="flex-start"
                            secondaryAction={
                                <Box>
                                    <IconButton
                                        edge="end"
                                        aria-label="view"
                                        onClick={() => navigateToProject(choreography._id || choreography.id, '/projects')}
                                    >
                                        <VisibilityIcon />
                                    </IconButton>
                                    <IconButton
                                        edge="end"
                                        aria-label="edit"
                                        onClick={() => navigateToProject(choreography._id || choreography.id, '/constructor')}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        edge="end"
                                        aria-label="delete"
                                        onClick={() => onDelete(choreography._id || choreography.id)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            }
                        >
                            <ListItemText
                                primary={choreography.name}
                                secondary={
                                    <React.Fragment>
                                        <Typography
                                            component="span"
                                            variant="body2"
                                            color="text.primary"
                                        >
                                            {new Date(choreography.createdAt).toLocaleDateString()}
                                        </Typography>
                                        {` — ${choreography.description || 'Нет описания'}`}
                                    </React.Fragment>
                                }
                            />
                        </ListItem>
                        {index < choreographies.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                );
            })}
        </List>
    );
};

export default ChoreographyList;
