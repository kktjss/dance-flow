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
            {choreographies.map((choreography, index) => (
                <React.Fragment key={choreography._id || index}>
                    <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                            <Box>
                                <IconButton
                                    edge="end"
                                    aria-label="view"
                                    onClick={() => navigate(`/projects/${choreography._id}`)}
                                >
                                    <VisibilityIcon />
                                </IconButton>
                                <IconButton
                                    edge="end"
                                    aria-label="edit"
                                    onClick={() => navigate(`/constructor/${choreography._id}`)}
                                >
                                    <EditIcon />
                                </IconButton>
                                <IconButton
                                    edge="end"
                                    aria-label="delete"
                                    onClick={() => onDelete(choreography._id)}
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
            ))}
        </List>
    );
};

export default ChoreographyList;
