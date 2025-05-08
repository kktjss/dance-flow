import React, { useState, useEffect } from 'react';
import {
    Container, Typography, Box, Button, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, TextField,
    List, ListItem, ListItemText, ListItemSecondaryAction,
    IconButton, Divider, Card, CardContent, CardActions,
    Tabs, Tab, Paper, CircularProgress, Chip, MenuItem,
    Select, FormControl, InputLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FolderIcon from '@mui/icons-material/Folder';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { useNavigate } from 'react-router-dom';

function TeamManagement() {
    const [teams, setTeams] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);

    // Dialog states
    const [createTeamDialog, setCreateTeamDialog] = useState(false);
    const [addMemberDialog, setAddMemberDialog] = useState(false);
    const [addProjectDialog, setAddProjectDialog] = useState(false);
    const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false);

    // Form states
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDescription, setNewTeamDescription] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedUserRole, setSelectedUserRole] = useState('viewer');
    const [selectedProjectId, setSelectedProjectId] = useState('');

    // Tabs
    const [tabValue, setTabValue] = useState(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchTimeout, setSearchTimeout] = useState(null);

    const navigate = useNavigate();

    // Fetch teams on component mount
    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');

            console.log('Auth check:', {
                hasToken: !!token,
                hasUser: !!user,
                userData: user ? JSON.parse(user) : null
            });

            if (!token || !user) {
                console.log('No auth data, redirecting to login');
                navigate('/login');
                return false;
            }

            try {
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                const expirationTime = tokenData.exp * 1000;
                console.log('Token expiration:', new Date(expirationTime));

                if (Date.now() >= expirationTime) {
                    console.log('Token expired, redirecting to login');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/login');
                    return false;
                }
                return true;
            } catch (err) {
                console.error('Error checking auth:', err);
                navigate('/login');
                return false;
            }
        };

        if (checkAuth()) {
            fetchTeams();
            fetchProjects();
            fetchUsers();
        }
    }, [navigate]);

    const fetchTeams = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');

            console.log('Fetching teams:', {
                hasToken: !!token,
                hasUser: !!user,
                userData: user ? JSON.parse(user) : null
            });

            if (!token || !user) {
                console.log('No auth data for teams fetch');
                setError('Для загрузки команд необходимо войти в систему.');
                setLoading(false);
                return;
            }

            const userData = JSON.parse(user);
            console.log('Current user:', userData);

            const response = await axios.get(`${API_BASE_URL}/api/teams`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('Teams response:', response.data);

            // Проверяем, есть ли у пользователя доступ к командам
            if (Array.isArray(response.data) && response.data.length > 0) {
                console.log('Available teams:', response.data.map(team => ({
                    id: team._id,
                    name: team.name,
                    owner: team.owner,
                    members: team.members
                })));
            } else {
                console.log('No teams available for user');
            }

            setTeams(Array.isArray(response.data) ? response.data : []);
            setError(null);
        } catch (err) {
            console.error('Error fetching teams:', err);
            if (err.response?.status === 401) {
                console.log('Unauthorized, redirecting to login');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
            } else if (err.response?.status === 403) {
                console.log('Forbidden access to teams');
                setError('У вас нет доступа к командам. Пожалуйста, создайте новую команду.');
            } else {
                setError('Не удалось загрузить команды. Пожалуйста, попробуйте позже.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(response.data);
        } catch (err) {
            console.error('Error fetching projects:', err);
        }
    };

    const fetchUsers = async (search = '') => {
        try {
            const token = localStorage.getItem('token');
            console.log('Fetching users with params:', { search, teamId: selectedTeam?._id });
            const response = await axios.get(`${API_BASE_URL}/api/users`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    search,
                    teamId: selectedTeam?._id
                }
            });
            console.log('Search results:', response.data);
            setUsers(response.data);
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    // Add debounced search handler
    const handleSearchChange = (event) => {
        const value = event.target.value;
        console.log('Search input changed:', value);
        setSearchQuery(value);

        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
            console.log('Executing search for:', value);
            fetchUsers(value);
        }, 300); // 300ms delay

        setSearchTimeout(timeout);
    };

    // Add handler for user selection from search results
    const handleUserSelect = (user) => {
        setSelectedUserId(user._id);
        setSearchQuery(user.username); // Show selected user in search field
    };

    // Update useEffect to fetch users when team is selected
    useEffect(() => {
        if (selectedTeam) {
            fetchUsers(searchQuery);
        }
    }, [selectedTeam]);

    const handleCreateTeam = async () => {
        try {
            const token = localStorage.getItem('token');
            console.log('Creating team with token:', token ? 'Token exists' : 'No token');
            console.log('New team data:', { name: newTeamName, description: newTeamDescription });

            if (!token) {
                setError('Для создания команды необходимо войти в систему.');
                return;
            }

            // Проверяем, не истек ли токен
            try {
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                const expirationTime = tokenData.exp * 1000; // конвертируем в миллисекунды
                console.log('Token expiration:', new Date(expirationTime));

                if (Date.now() >= expirationTime) {
                    console.log('Token expired, redirecting to login');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/login');
                    return;
                }
            } catch (tokenErr) {
                console.error('Error parsing token:', tokenErr);
            }

            console.log('Sending request to create team...');
            const response = await axios.post(
                `${API_BASE_URL}/api/teams`,
                {
                    name: newTeamName,
                    description: newTeamDescription
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            console.log('Team creation response:', response.data);
            setTeams([...teams, response.data]);
            setCreateTeamDialog(false);
            setNewTeamName('');
            setNewTeamDescription('');
            setError(null);

            // После создания команды обновим список команд
            fetchTeams();
        } catch (err) {
            console.error('Error creating team:', err);
            console.error('Response data:', err.response?.data);
            console.error('Request config:', err.config);
            setError('Не удалось создать команду. Пожалуйста, попробуйте позже.');
        }
    };

    const handleAddMember = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/teams/${selectedTeam._id}/members`, {
                userId: selectedUserId,
                role: selectedUserRole
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh team data
            const response = await axios.get(`${API_BASE_URL}/api/teams/${selectedTeam._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSelectedTeam(response.data);
            setAddMemberDialog(false);
            setSelectedUserId('');
            setSelectedUserRole('viewer');

            // Update teams list
            fetchTeams();
        } catch (err) {
            console.error('Error adding member:', err);
            setError('Не удалось добавить участника. Пожалуйста, попробуйте позже.');
        }
    };

    const handleAddProject = async () => {
        try {
            const token = localStorage.getItem('token');
            console.log('Adding project to team with token:', token ? 'Token exists' : 'No token');
            console.log('Project data:', { teamId: selectedTeam._id, projectId: selectedProjectId });

            if (!token) {
                setError('Для добавления проекта необходимо войти в систему.');
                return;
            }

            try {
                console.log('Trying main API endpoint...');
                const response = await axios.post(`${API_BASE_URL}/api/teams/${selectedTeam._id}/projects`, {
                    projectId: selectedProjectId
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                console.log('Project added successfully:', response.data);
                if (response.data.success && response.data.team) {
                    setSelectedTeam(response.data.team);
                    setAddProjectDialog(false);
                    setSelectedProjectId('');
                    setError(null);
                }
            } catch (mainErr) {
                console.error('Main API error:', mainErr);

                // Try test endpoint if main endpoint fails
                try {
                    console.log('Trying test endpoint...');
                    const testResponse = await axios.post(`${API_BASE_URL}/api/teams-test/${selectedTeam._id}/projects`, {
                        projectId: selectedProjectId
                    });

                    console.log('Test endpoint response:', testResponse.data);

                    if (testResponse.data.success && testResponse.data.team) {
                        setSelectedTeam(testResponse.data.team);
                        setAddProjectDialog(false);
                        setSelectedProjectId('');
                        setError('Проект добавлен в тестовом режиме.');
                    } else {
                        throw new Error('Invalid test response format');
                    }
                } catch (testErr) {
                    console.error('Test endpoint also failed:', testErr);
                    setError('Не удалось добавить проект. Пожалуйста, попробуйте позже.');
                }
            }
        } catch (err) {
            console.error('Error in project addition flow:', err);
            setError('Не удалось добавить проект. Пожалуйста, попробуйте позже.');
        }
    };

    const handleRemoveMember = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/teams/${selectedTeam._id}/members/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh team data
            const response = await axios.get(`${API_BASE_URL}/api/teams/${selectedTeam._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSelectedTeam(response.data);

            // Update teams list
            fetchTeams();
        } catch (err) {
            console.error('Error removing member:', err);
            setError('Не удалось удалить участника. Пожалуйста, попробуйте позже.');
        }
    };

    const handleRemoveProject = async (projectId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/teams/${selectedTeam._id}/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh team data
            const response = await axios.get(`${API_BASE_URL}/api/teams/${selectedTeam._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSelectedTeam(response.data);

            // Update teams list
            fetchTeams();
        } catch (err) {
            console.error('Error removing project:', err);
            setError('Не удалось удалить проект. Пожалуйста, попробуйте позже.');
        }
    };

    const handleDeleteTeam = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/teams/${selectedTeam._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setTeams(teams.filter(team => team._id !== selectedTeam._id));
            setSelectedTeam(null);
            setConfirmDeleteDialog(false);
        } catch (err) {
            console.error('Error deleting team:', err);
            setError('Не удалось удалить команду. Пожалуйста, попробуйте позже.');
        }
    };

    const handleSelectTeam = async (team) => {
        try {
            const token = localStorage.getItem('token');
            console.log('Selecting team with token:', token ? 'Token exists' : 'No token');
            console.log('Selected team:', team);

            if (!token) {
                setError('Для просмотра команды необходимо войти в систему.');
                return;
            }

            try {
                console.log('Trying main API endpoint...');
                const response = await axios.get(`${API_BASE_URL}/api/teams/${team._id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                console.log('Team details response:', response.data);
                setSelectedTeam(response.data);
                setError(null);
            } catch (mainErr) {
                console.error('Main API error:', mainErr);

                // Try test endpoint if main endpoint fails
                try {
                    console.log('Trying test endpoint...');
                    const testResponse = await axios.get(`${API_BASE_URL}/api/teams-test/${team._id}`);
                    console.log('Test endpoint response:', testResponse.data);

                    if (testResponse.data.success && testResponse.data.team) {
                        setSelectedTeam(testResponse.data.team);
                        setError('Используются тестовые данные.');
                    } else {
                        throw new Error('Invalid test response format');
                    }
                } catch (testErr) {
                    console.error('Test endpoint also failed:', testErr);
                    setError('Не удалось загрузить данные команды. Пожалуйста, попробуйте позже.');
                    setSelectedTeam(null);
                }
            }
        } catch (err) {
            console.error('Error in team selection flow:', err);
            setError('Не удалось загрузить данные команды. Пожалуйста, попробуйте позже.');
            setSelectedTeam(null);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    // Check if the dialogs should be disabled (when no team is selected)
    const canOpenAddMemberDialog = Boolean(selectedTeam);
    const canOpenAddProjectDialog = Boolean(selectedTeam);

    // Dialog handlers with safety checks
    const openAddMemberDialog = () => {
        if (canOpenAddMemberDialog) {
            setAddMemberDialog(true);
        }
    };

    const openAddProjectDialog = () => {
        if (canOpenAddProjectDialog) {
            setAddProjectDialog(true);
        }
    };

    // Обновим функцию getUserRole для более подробного логирования
    const getUserRole = (team, userId) => {
        console.log('getUserRole called with:', { team, userId });

        if (!team || !userId) {
            console.log('Missing team or userId');
            return null;
        }

        // Проверяем, является ли пользователь владельцем
        if (team.owner && (team.owner._id === userId || team.owner.id === userId)) {
            console.log('User is owner');
            return 'owner';
        }

        // Проверяем роль в списке участников
        if (team.members && Array.isArray(team.members)) {
            const member = team.members.find(m =>
                m.userId && (m.userId._id === userId || m.userId.id === userId)
            );
            console.log('Found member:', member);
            return member ? member.role : null;
        }

        console.log('No role found');
        return null;
    };

    // Добавим функцию для обработки клика по проекту
    const handleProjectClick = (project) => {
        try {
            console.log('Project clicked:', project);
            console.log('Selected team:', selectedTeam);

            if (!selectedTeam || !project) {
                console.log('Missing team or project data');
                return;
            }

            const userStr = localStorage.getItem('user');
            console.log('User from localStorage:', userStr);

            if (!userStr) {
                console.log('No user data in localStorage');
                navigate('/login');
                return;
            }

            const user = JSON.parse(userStr);
            console.log('Parsed user data:', user);

            if (!user || (!user._id && !user.id)) {
                console.log('Invalid user data');
                navigate('/login');
                return;
            }

            const userId = user._id || user.id;
            console.log('Using userId:', userId);

            const userRole = getUserRole(selectedTeam, userId);
            console.log('User role:', userRole);

            if (!userRole) {
                console.log('No role found for user');
                return;
            }

            // Определяем маршрут в зависимости от роли
            const route = (userRole === 'owner' || userRole === 'admin')
                ? `/teams/${selectedTeam._id}/projects/${project._id}/constructor`
                : `/teams/${selectedTeam._id}/projects/${project._id}/viewer`;

            console.log('Navigating to:', route);
            navigate(route);
        } catch (error) {
            console.error('Error in handleProjectClick:', error);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navbar />
                <Box sx={{ flexGrow: 1, pt: 8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h4" component="h1">
                            Управление командами
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateTeamDialog(true)}
                        >
                            Создать команду
                        </Button>
                    </Box>

                    {error && (
                        <Box sx={{ mb: 2 }}>
                            <Typography color="error">{error}</Typography>
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', mt: 2 }}>
                        <Box sx={{ width: '30%', pr: 2 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Мои команды
                            </Typography>
                            <Paper elevation={3}>
                                <List>
                                    {teams.length === 0 ? (
                                        <ListItem>
                                            <ListItemText primary="У вас пока нет команд" />
                                        </ListItem>
                                    ) : (
                                        teams.map((team) => (
                                            <React.Fragment key={team._id}>
                                                <ListItem
                                                    button
                                                    selected={selectedTeam && selectedTeam._id === team._id}
                                                    onClick={() => handleSelectTeam(team)}
                                                >
                                                    <ListItemText
                                                        primary={team.name}
                                                        secondary={`${team.members?.length || 0} участников`}
                                                    />
                                                </ListItem>
                                                <Divider />
                                            </React.Fragment>
                                        ))
                                    )}
                                </List>
                            </Paper>
                        </Box>

                        <Box sx={{ width: '70%' }}>
                            {selectedTeam ? (
                                <Card elevation={3}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h5">{selectedTeam.name}</Typography>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => setConfirmDeleteDialog(true)}
                                            >
                                                Удалить
                                            </Button>
                                        </Box>

                                        <Typography variant="body1" color="text.secondary" paragraph>
                                            {selectedTeam.description || 'Описание отсутствует'}
                                        </Typography>

                                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                            <Tabs value={tabValue} onChange={handleTabChange}>
                                                <Tab label="Участники" />
                                                <Tab label="Проекты" />
                                            </Tabs>
                                        </Box>

                                        {tabValue === 0 && (
                                            <Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                    <Typography variant="h6">Участники команды</Typography>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={<PersonAddIcon />}
                                                        onClick={openAddMemberDialog}
                                                        disabled={!canOpenAddMemberDialog}
                                                    >
                                                        Добавить
                                                    </Button>
                                                </Box>

                                                <List>
                                                    {/* Owner */}
                                                    {selectedTeam.owner && (
                                                        <ListItem>
                                                            <ListItemText
                                                                primary={selectedTeam.owner.username || 'Владелец'}
                                                                secondary={selectedTeam.owner.email || ''}
                                                            />
                                                            <Chip label="Владелец" color="primary" size="small" />
                                                        </ListItem>
                                                    )}
                                                    <Divider />

                                                    {/* Members */}
                                                    {selectedTeam.members?.map((member) => (
                                                        member.userId && member.userId._id &&
                                                        (!selectedTeam.owner || member.userId._id !== selectedTeam.owner._id) && (
                                                            <React.Fragment key={member.userId._id}>
                                                                <ListItem>
                                                                    <ListItemText
                                                                        primary={member.userId.username || 'Неизвестный пользователь'}
                                                                        secondary={member.userId.email || ''}
                                                                    />
                                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                        <Chip
                                                                            label={member.role === 'admin' ? 'Админ' :
                                                                                member.role === 'editor' ? 'Редактор' : 'Просмотр'}
                                                                            color={member.role === 'admin' ? 'secondary' :
                                                                                member.role === 'editor' ? 'info' : 'default'}
                                                                            size="small"
                                                                            sx={{ mr: 1 }}
                                                                        />
                                                                        <IconButton
                                                                            edge="end"
                                                                            size="small"
                                                                            onClick={() => handleRemoveMember(member.userId._id)}
                                                                        >
                                                                            <DeleteIcon />
                                                                        </IconButton>
                                                                    </Box>
                                                                </ListItem>
                                                                <Divider />
                                                            </React.Fragment>
                                                        )
                                                    ))}
                                                </List>
                                            </Box>
                                        )}

                                        {tabValue === 1 && (
                                            <Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                    <Typography variant="h6">Проекты команды</Typography>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={<FolderIcon />}
                                                        onClick={openAddProjectDialog}
                                                        disabled={!canOpenAddProjectDialog}
                                                    >
                                                        Добавить проект
                                                    </Button>
                                                </Box>

                                                <List>
                                                    {selectedTeam.projects?.length === 0 ? (
                                                        <ListItem>
                                                            <ListItemText primary="У команды пока нет проектов" />
                                                        </ListItem>
                                                    ) : (
                                                        selectedTeam.projects?.map((project) => (
                                                            <React.Fragment key={project._id}>
                                                                <ListItem
                                                                    button
                                                                    onClick={() => handleProjectClick(project)}
                                                                    sx={{
                                                                        '&:hover': {
                                                                            backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                                                        },
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <ListItemText
                                                                        primary={project.name}
                                                                        secondary={project.description || 'Без описания'}
                                                                    />
                                                                    {getUserRole(selectedTeam, JSON.parse(localStorage.getItem('user'))._id) === 'admin' && (
                                                                        <IconButton
                                                                            edge="end"
                                                                            size="small"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleRemoveProject(project._id);
                                                                            }}
                                                                        >
                                                                            <DeleteIcon />
                                                                        </IconButton>
                                                                    )}
                                                                </ListItem>
                                                                <Divider />
                                                            </React.Fragment>
                                                        ))
                                                    )}
                                                </List>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
                                    <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                                        Выберите команду или создайте новую
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        onClick={() => setCreateTeamDialog(true)}
                                    >
                                        Создать команду
                                    </Button>
                                </Paper>
                            )}
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* Create Team Dialog */}
            <Dialog open={createTeamDialog} onClose={() => setCreateTeamDialog(false)}>
                <DialogTitle>Создать новую команду</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Создайте новую команду и пригласите участников для совместной работы над проектами.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Название команды"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        required
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Описание"
                        type="text"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={3}
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateTeamDialog(false)}>Отмена</Button>
                    <Button
                        onClick={handleCreateTeam}
                        disabled={!newTeamName}
                        variant="contained"
                    >
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog
                open={addMemberDialog && selectedTeam !== null}
                onClose={() => {
                    setAddMemberDialog(false);
                    setSearchQuery('');
                    setSelectedUserId('');
                }}
            >
                <DialogTitle>Добавить участника</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Добавьте участника в команду и установите уровень доступа.
                    </DialogContentText>

                    <TextField
                        fullWidth
                        margin="dense"
                        label="Поиск пользователей"
                        variant="outlined"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Поиск по имени или email..."
                        sx={{ mb: 2 }}
                    />

                    {searchQuery && users.length > 0 && (
                        <List sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                            {users.map((user) => (
                                <ListItem
                                    key={user._id}
                                    button
                                    onClick={() => handleUserSelect(user)}
                                    selected={selectedUserId === user._id}
                                >
                                    <ListItemText
                                        primary={user.username}
                                        secondary={user.email}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}

                    <FormControl fullWidth margin="dense">
                        <InputLabel>Роль</InputLabel>
                        <Select
                            value={selectedUserRole}
                            onChange={(e) => setSelectedUserRole(e.target.value)}
                            label="Роль"
                        >
                            <MenuItem value="admin">Администратор</MenuItem>
                            <MenuItem value="editor">Редактор</MenuItem>
                            <MenuItem value="viewer">Просмотр</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setAddMemberDialog(false);
                        setSearchQuery('');
                        setSelectedUserId('');
                    }}>Отмена</Button>
                    <Button
                        onClick={handleAddMember}
                        disabled={!selectedUserId}
                        variant="contained"
                    >
                        Добавить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Project Dialog */}
            <Dialog
                open={addProjectDialog && selectedTeam !== null}
                onClose={() => setAddProjectDialog(false)}
            >
                <DialogTitle>Добавить проект в команду</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Выберите проект, который хотите добавить в команду.
                    </DialogContentText>

                    <FormControl fullWidth margin="dense">
                        <InputLabel>Проект</InputLabel>
                        <Select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            label="Проект"
                            required
                        >
                            <MenuItem value="" disabled>Выберите проект</MenuItem>
                            {projects
                                .filter(project => selectedTeam && (
                                    // Filter out already added projects
                                    !selectedTeam.projects ||
                                    !selectedTeam.projects.some(teamProject => teamProject._id === project._id)
                                ))
                                .map((project) => (
                                    <MenuItem key={project._id} value={project._id}>
                                        {project.name}
                                    </MenuItem>
                                ))
                            }
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddProjectDialog(false)}>Отмена</Button>
                    <Button
                        onClick={handleAddProject}
                        disabled={!selectedProjectId}
                        variant="contained"
                    >
                        Добавить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <Dialog
                open={confirmDeleteDialog && selectedTeam !== null}
                onClose={() => setConfirmDeleteDialog(false)}
            >
                <DialogTitle>Удалить команду</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Вы уверены, что хотите удалить команду "{selectedTeam?.name}"? Это действие нельзя отменить.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDeleteDialog(false)}>Отмена</Button>
                    <Button onClick={handleDeleteTeam} color="error" variant="contained">
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default TeamManagement; 