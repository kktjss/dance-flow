import React, { useState, useEffect } from 'react';
import {
    Container, Typography, Box, Button, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, TextField,
    List, ListItem, ListItemText, ListItemSecondaryAction,
    IconButton, Divider, Card, CardContent, CardActions,
    Tabs, Tab, Paper, CircularProgress, Chip, MenuItem,
    Select, FormControl, InputLabel, Grid, Avatar, useTheme,
    alpha, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FolderIcon from '@mui/icons-material/Folder';
import GroupsIcon from '@mui/icons-material/Groups';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { useNavigate } from 'react-router-dom';
import { styled, keyframes } from '@mui/material/styles';
import { COLORS } from '../constants/colors';

// Анимации
const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

// Декоративные элементы
const DecorativeCircle = styled(Box)(({ size = 120, top, left, color = COLORS.primary, delay = 0 }) => ({
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color}55 0%, ${color}00 70%)`,
    top: top,
    left: left,
    opacity: 0.7,
    pointerEvents: 'none',
    animation: `${fadeIn} 1s ${delay}s ease-out forwards`,
}));

// Стилизованные компоненты
const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    borderRadius: '20px',
    backgroundColor: 'rgba(17, 21, 54, 0.9)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(138, 43, 226, 0.2)',
    position: 'relative',
    overflow: 'hidden',
    animation: `${fadeIn} 0.5s ease-out forwards`,
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
    }
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: '12px',
    fontWeight: 600,
    textTransform: 'none',
    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
    color: '#FFFFFF',
    transition: 'all 0.3s ease',
    boxShadow: `0 4px 15px rgba(138, 43, 226, 0.3)`,
    '&:hover': {
        boxShadow: `0 8px 20px rgba(138, 43, 226, 0.5)`,
        transform: 'translateY(-2px)'
    }
}));

const StyledOutlinedButton = styled(Button)(({ theme }) => ({
    borderRadius: '12px',
    fontWeight: 600,
    textTransform: 'none',
    borderColor: alpha(COLORS.primary, 0.3),
    color: theme.palette.mode === 'dark' ? '#FFFFFF' : COLORS.primary,
    '&:hover': {
        borderColor: COLORS.primary,
        backgroundColor: alpha(COLORS.primary, 0.08),
        transform: 'translateY(-2px)',
    }
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        backgroundColor: 'rgba(17, 21, 54, 0.95)',
        color: '#FFFFFF',
        borderRadius: '20px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(138, 43, 226, 0.3)',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '3px',
            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
        }
    },
    '& .MuiDialogTitle-root': {
        color: '#FFFFFF'
    },
    '& .MuiDialogContent-root': {
        color: 'rgba(255, 255, 255, 0.9)'
    }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        color: 'rgba(255, 255, 255, 0.9)',
        '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        '&:hover fieldset': {
            borderColor: COLORS.primaryLight,
        },
        '&.Mui-focused fieldset': {
            borderColor: COLORS.primary,
        },
    },
    '& .MuiInputLabel-root': {
        color: 'rgba(255, 255, 255, 0.7)',
    }
}));

const TeamListItem = styled(ListItem)(({ theme, selected }) => ({
    borderRadius: '12px',
    margin: '4px 0',
    transition: 'all 0.2s ease',
    backgroundColor: selected ? alpha(COLORS.primary, 0.15) : 'transparent',
    '&:hover': {
        backgroundColor: selected ? alpha(COLORS.primary, 0.2) : 'rgba(255, 255, 255, 0.05)',
    },
    position: 'relative',
    overflow: 'hidden',
    ...(selected && {
        '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: '4px',
            background: `linear-gradient(to bottom, ${COLORS.primary}, ${COLORS.tertiary})`,
            borderRadius: '4px 0 0 4px'
        }
    })
}));

const StyledTab = styled(Tab)(({ theme }) => ({
    fontWeight: 600,
    textTransform: 'none',
    minHeight: '48px',
    color: 'rgba(255, 255, 255, 0.6)',
    '&.Mui-selected': {
        color: '#FFFFFF',
    },
    transition: 'all 0.2s',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontWeight: 700,
    marginBottom: theme.spacing(2),
    position: 'relative',
    display: 'inline-block',
    color: '#FFFFFF',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: -4,
        left: 0,
        width: 40,
        height: 3,
        background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.tertiary})`,
        borderRadius: 1.5
    }
}));

function TeamManagement() {
    const theme = useTheme();
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
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    // Check if user can add members
    const canOpenAddMemberDialog = selectedTeam && userStr && (() => {
        try {
            const user = JSON.parse(userStr);
            const userId = user._id || user.id;
            const userRole = getUserRole(selectedTeam, userId);
            return userRole === 'owner' || userRole === 'admin';
        } catch (err) {
            console.error('Error parsing user role:', err);
            return false;
        }
    })();

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
            setLoading(true);
            const token = localStorage.getItem('token');
            console.log('Fetching projects with token:', token ? 'Token exists' : 'No token');

            if (!token) {
                console.error('No token found for project fetch');
                setLoading(false);
                return;
            }

            console.log(`Sending request to: ${API_BASE_URL}/api/projects`);
            const response = await axios.get(`${API_BASE_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log(`Received ${response.data.length} projects:`, response.data);

            // Проверяем наличие ID у каждого проекта и исправляем данные при необходимости
            const validProjects = Array.isArray(response.data)
                ? response.data.map(project => {
                    // Если это не объект, пропускаем
                    if (!project || typeof project !== 'object') {
                        console.error('Invalid project data (not an object):', project);
                        return null;
                    }

                    // Если у проекта нет _id, но есть id, копируем id в _id
                    if (!project._id && project.id) {
                        console.log('Project found with id but no _id, fixing:', project);
                        return { ...project, _id: project.id };
                    }

                    // Если нет ни _id, ни id - невалидный проект
                    if (!project._id && !project.id) {
                        console.error('Project without any ID:', project);
                        return null;
                    }

                    // Проверяем корректность _id
                    if (typeof project._id !== 'string') {
                        console.error('Project with invalid _id type:', project);
                        if (typeof project.id === 'string') {
                            return { ...project, _id: project.id };
                        }
                        return null;
                    }

                    return project;
                }).filter(Boolean) // Удаляем null/undefined
                : [];

            console.log(`After validation: ${validProjects.length} valid projects:`, validProjects);
            setProjects(validProjects);
        } catch (err) {
            console.error('Error fetching projects:', err);
            console.error('Response details:', err.response?.status, err.response?.data);

            // Try fallback endpoint if main one fails
            try {
                const token = localStorage.getItem('token');
                console.log('Trying fallback projects endpoint...');
                const fallbackResponse = await axios.get(`${API_BASE_URL}/api/projects-test`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                console.log(`Received ${fallbackResponse.data.length} projects from fallback:`, fallbackResponse.data);

                // Та же проверка на валидные ID для фоллбэка
                const validProjects = Array.isArray(fallbackResponse.data)
                    ? fallbackResponse.data.map(project => {
                        if (!project || typeof project !== 'object') {
                            return null;
                        }

                        if (!project._id && project.id) {
                            return { ...project, _id: project.id };
                        }

                        if (!project._id && !project.id) {
                            return null;
                        }

                        if (typeof project._id !== 'string') {
                            if (typeof project.id === 'string') {
                                return { ...project, _id: project.id };
                            }
                            return null;
                        }

                        return project;
                    }).filter(Boolean)
                    : [];

                console.log(`After fallback validation: ${validProjects.length} valid projects:`, validProjects);
                setProjects(validProjects);
            } catch (fallbackErr) {
                console.error('Fallback endpoint also failed:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async (search = '') => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token found for user search');
                setError('Необходима авторизация для поиска пользователей');
                return;
            }

            // Получаем текущего пользователя
            const user = userStr ? JSON.parse(userStr) : null;
            const currentUserId = user ? (user._id || user.id) : null;
            console.log('Current user ID:', currentUserId);

            // Получаем ID всех участников команды
            const currentTeamMembers = selectedTeam?.members || [];
            const existingMemberIds = currentTeamMembers.map(member => {
                return typeof member.userId === 'object' ?
                    (member.userId._id || member.userId.id) : member.userId;
            });
            console.log('Existing member IDs:', existingMemberIds);

            // ID команды
            const teamId = selectedTeam?._id || selectedTeam?.id;

            console.log('Searching for users with query:', search);

            try {
                // Делаем запрос к API без дополнительных параметров фильтрации
                const response = await axios.get(`${API_BASE_URL}/api/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { search } // Только поисковый запрос
                });

                console.log('API response:', response.data);

                if (Array.isArray(response.data)) {
                    // Отфильтруем только участников, которые еще не в команде
                    const usersNotInTeam = response.data.filter(user => {
                        // Базовая проверка данных пользователя
                        if (!user || (!user._id && !user.id)) {
                            console.log('Invalid user data:', user);
                            return false;
                        }

                        // Получаем ID пользователя
                        const userId = user._id || user.id;

                        // Проверяем, не находится ли пользователь уже в команде
                        if (existingMemberIds.includes(userId)) {
                            console.log('User already in team:', user.username || userId);
                            return false;
                        }

                        return true;
                    });

                    console.log('Users not in team:', usersNotInTeam);
                    setUsers(usersNotInTeam);

                    if (usersNotInTeam.length === 0) {
                        console.log('No users found matching search criteria or all users already in team');
                    }
                } else {
                    console.error('API returned non-array result:', response.data);
                    setUsers([]);
                }
            } catch (apiErr) {
                console.error('API error:', apiErr);

                // Попробуем альтернативный эндпоинт
                try {
                    console.log('Trying alternative API endpoint...');
                    const altResponse = await axios.get(`${API_BASE_URL}/api/users/search`, {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { query: search } // Используем 'query' вместо 'search'
                    });

                    console.log('Alternative API response:', altResponse.data);

                    if (Array.isArray(altResponse.data)) {
                        const validUsers = altResponse.data.filter(user => {
                            if (!user || (!user._id && !user.id)) return false;

                            const userId = user._id || user.id;
                            return !existingMemberIds.includes(userId);
                        });

                        console.log('Valid users from alt endpoint:', validUsers);
                        setUsers(validUsers);
                    } else {
                        setUsers([]);
                    }
                } catch (altErr) {
                    console.error('Alternative API also failed:', altErr);

                    // Попробуем использовать тестовый эндпоинт
                    try {
                        console.log('Trying test endpoint...');
                        const testResponse = await axios.get(`${API_BASE_URL}/api/users-test`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        console.log('Test endpoint response:', testResponse.data);

                        if (Array.isArray(testResponse.data)) {
                            const filteredTestUsers = testResponse.data.filter(user => {
                                if (!user || (!user._id && !user.id)) return false;

                                const userId = user._id || user.id;
                                if (existingMemberIds.includes(userId)) return false;

                                // Если есть поисковый запрос, фильтруем по нему
                                if (search && user.username) {
                                    return user.username.toLowerCase().includes(search.toLowerCase()) ||
                                        (user.email && user.email.toLowerCase().includes(search.toLowerCase()));
                                }

                                return true;
                            });

                            console.log('Filtered test users:', filteredTestUsers);
                            setUsers(filteredTestUsers);
                        } else {
                            setUsers([]);
                        }
                    } catch (testErr) {
                        console.error('Test endpoint failed:', testErr);
                        setUsers([]);
                    }
                }
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setUsers([]);
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

        // Clear selected user when search changes
        if (selectedUserId) {
            setSelectedUserId('');
        }
    };

    // Add handler for user selection from search results
    const handleUserSelect = (user) => {
        console.log('User selected:', user);
        // Используем id или _id, в зависимости от того, что доступно
        const userId = user._id || user.id;
        setSelectedUserId(userId);
        setSearchQuery(user.username); // Show selected user in search field
    };

    // Update useEffect to fetch users when team is selected
    useEffect(() => {
        if (selectedTeam) {
            fetchUsers(searchQuery);
        }
    }, [selectedTeam]);

    // Add a new useEffect to debug selectedUserId changes
    useEffect(() => {
        console.log('Selected user ID changed:', selectedUserId);
    }, [selectedUserId]);

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

            // Проверка наличия необходимых данных
            if (!selectedTeam) {
                console.error('Error: Team is undefined');
                setError('Ошибка: команда не выбрана');
                return;
            }

            // Используем id или _id, в зависимости от того, что доступно
            const teamId = selectedTeam._id || selectedTeam.id;

            if (!teamId) {
                console.error('Error: Team ID is undefined', selectedTeam);
                setError('Ошибка: ID команды не определен');
                return;
            }

            if (!selectedUserId) {
                console.error('Error: User ID is undefined');
                setError('Ошибка: необходимо выбрать пользователя');
                return;
            }

            console.log('Adding member with data:', {
                teamId: teamId,
                userId: selectedUserId,
                role: selectedUserRole
            });

            try {
                const response = await axios.post(`${API_BASE_URL}/api/teams/${teamId}/members`, {
                    userId: selectedUserId,
                    role: selectedUserRole
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                console.log('Add member response:', response.data);

                // Проверка данных команды перед установкой в state
                const teamData = response.data;

                // Убедимся, что members существует и является массивом
                if (!teamData.members) {
                    teamData.members = [];
                }

                // Убедимся, что все члены команды имеют корректную структуру
                if (Array.isArray(teamData.members)) {
                    console.log('Processing team members after add:', teamData.members);

                    // Фильтруем некорректные данные участников
                    teamData.members = teamData.members.filter(member => {
                        return member && (
                            (typeof member.userId === 'object' && member.userId) ||
                            (typeof member.userId === 'string' && member.userId)
                        );
                    });

                    console.log('Filtered team members after add:', teamData.members);
                }

                setSelectedTeam(teamData);

                // Очищаем данные диалога и закрываем его
                setAddMemberDialog(false);
                setSearchQuery('');
                setSelectedUserId('');
                setSelectedUserRole('viewer');
                setUsers([]);  // Очищаем результаты поиска
                setError(null);

                // Показываем сообщение об успехе
                setError('Участник успешно добавлен в команду');

                // Через 3 секунды убираем сообщение
                setTimeout(() => {
                    setError(null);
                }, 3000);

                // Update teams list
                fetchTeams();

                // Переключаемся на вкладку с участниками
                setTabValue(0);
            } catch (apiErr) {
                console.error('API error when adding member:', apiErr);

                if (apiErr.response) {
                    const statusCode = apiErr.response.status;
                    const errorData = apiErr.response.data;

                    console.error('API error details:', {
                        statusCode,
                        errorData
                    });

                    // Показываем конкретную ошибку от сервера, если есть
                    if (errorData && errorData.error) {
                        setError(`Ошибка: ${errorData.error}`);
                    } else if (statusCode === 401) {
                        setError('Ошибка авторизации. Пожалуйста, войдите в систему заново.');
                    } else if (statusCode === 403) {
                        setError('У вас нет прав для добавления участников в эту команду.');
                    } else if (statusCode === 404) {
                        setError('Команда или пользователь не найдены.');
                    } else if (statusCode === 409) {
                        setError('Этот пользователь уже является участником команды.');
                    } else {
                        setError('Не удалось добавить участника. Пожалуйста, попробуйте позже.');
                    }
                } else {
                    setError('Ошибка соединения с сервером. Проверьте подключение к интернету.');
                }
            }
        } catch (err) {
            console.error('Unexpected error in handleAddMember:', err);
            setError('Произошла неожиданная ошибка при добавлении участника.');
        }
    };

    const handleAddProject = async () => {
        try {
            // Проверяем входные данные
            if (!selectedTeam) {
                setError('Нет выбранной команды');
                return;
            }

            // Получаем корректный ID команды
            const teamId = selectedTeam._id || selectedTeam.id;
            if (!teamId) {
                console.error('Team ID is missing:', selectedTeam);
                setError('Ошибка: не удалось определить ID команды');
                return;
            }

            if (!selectedProjectId) {
                setError('Не выбран проект для добавления');
                return;
            }

            // Получаем токен
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Для добавления проекта необходимо войти в систему');
                return;
            }

            // Подробный лог
            console.log('Добавление проекта в команду:', {
                teamId: teamId,
                projectId: selectedProjectId,
                hasToken: Boolean(token)
            });

            // Отправляем запрос на сервер
            try {
                // Упрощенный запрос с точным форматом данных, как ожидает сервер
                const response = await axios.post(
                    `${API_BASE_URL}/api/teams/${teamId}/projects`,
                    { projectId: selectedProjectId }, // Важно: именно projectId, как ожидает сервер
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                console.log('Ответ сервера:', response.data);

                // Для отладки выведем предыдущее и новое состояние команды
                console.log('Команда до обновления:', selectedTeam);

                // Загружаем обновленные данные команды
                const updatedTeamResponse = await axios.get(
                    `${API_BASE_URL}/api/teams/${teamId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                console.log('Обновленные данные команды:', updatedTeamResponse.data);

                // Обновляем состояние
                setSelectedTeam(updatedTeamResponse.data);
                setAddProjectDialog(false);
                setSelectedProjectId('');
                setError(null);

                // Перезагружаем списки
                fetchTeams();
                fetchProjects();

                // Переключаем на вкладку с проектами
                setTabValue(1);

            } catch (err) {
                console.error('Ошибка при добавлении проекта:', err);
                console.error('Детали ошибки:', {
                    status: err.response?.status,
                    data: err.response?.data,
                    message: err.message
                });

                setError(`Ошибка при добавлении проекта: ${err.response?.data?.error || err.message}`);
            }
        } catch (err) {
            console.error('Непредвиденная ошибка:', err);
            setError('Произошла непредвиденная ошибка при попытке добавить проект');
        }
    };

    const handleRemoveMember = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            console.log('Removing member with userId:', userId);

            if (!selectedTeam) {
                console.error('Team is missing');
                setError('Ошибка: данные команды отсутствуют');
                return;
            }

            const teamId = selectedTeam._id || selectedTeam.id;

            if (!teamId) {
                console.error('Team ID is missing');
                setError('Ошибка: идентификатор команды отсутствует');
                return;
            }

            // Проверим, не пытается ли пользователь удалить владельца команды
            if (selectedTeam.owner) {
                const ownerId = typeof selectedTeam.owner === 'object' ?
                    (selectedTeam.owner._id || selectedTeam.owner.id) :
                    selectedTeam.owner;

                if (ownerId === userId) {
                    setError('Невозможно удалить владельца команды');
                    return;
                }
            }

            // Проверим, не пытается ли пользователь удалить админа
            const memberToRemove = selectedTeam.members?.find(member => {
                const memberId = typeof member.userId === 'object' ?
                    (member.userId._id || member.userId.id) :
                    member.userId;
                return memberId === userId;
            });

            if (memberToRemove && memberToRemove.role === 'admin') {
                // Получим текущего пользователя
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const currentUserId = currentUser?._id || currentUser?.id;

                // Проверяем, является ли текущий пользователь владельцем команды
                const isOwner = selectedTeam.owner &&
                    (typeof selectedTeam.owner === 'object' ?
                        (selectedTeam.owner._id === currentUserId || selectedTeam.owner.id === currentUserId) :
                        selectedTeam.owner === currentUserId);

                if (!isOwner) {
                    setError('Только владелец команды может удалить администратора');
                    return;
                }
            }

            const response = await axios.delete(`${API_BASE_URL}/api/teams/${teamId}/members/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('Remove member response:', response.data);

            // Проверка данных команды перед установкой в state
            const teamData = response.data;

            // Убедимся, что members существует и является массивом
            if (!teamData.members) {
                teamData.members = [];
            }

            // Убедимся, что все члены команды имеют корректную структуру
            if (Array.isArray(teamData.members)) {
                console.log('Processing team members after removal:', teamData.members);

                // Фильтруем некорректные данные участников и удаляем дубликаты
                const uniqueUserIds = new Set();
                teamData.members = teamData.members.filter(member => {
                    if (!member || !member.userId) return false;

                    const memberId = typeof member.userId === 'object' ?
                        (member.userId._id || member.userId.id) :
                        member.userId;

                    // Если userId уже был добавлен, пропускаем этот элемент
                    if (uniqueUserIds.has(memberId)) return false;

                    uniqueUserIds.add(memberId);
                    return true;
                });

                console.log('Filtered team members after removal:', teamData.members);
            }

            setSelectedTeam(teamData);
            setError(null);

            // Update teams list
            fetchTeams();
        } catch (err) {
            console.error('Error removing member:', err);

            // Улучшенная обработка ошибок с сервера
            if (err.response) {
                if (err.response.status === 403) {
                    const errorMsg = err.response.data?.error || 'У вас нет прав для удаления этого участника';
                    setError(errorMsg);
                } else if (err.response.data?.error) {
                    setError(err.response.data.error);
                } else {
                    setError('Не удалось удалить участника. Пожалуйста, попробуйте позже.');
                }
            } else {
                setError('Не удалось связаться с сервером. Проверьте подключение к интернету.');
            }
        }
    };

    const handleRemoveProject = async (projectId) => {
        try {
            if (!selectedTeam || !selectedTeam._id) {
                console.error('No selected team or team ID');
                setError('Ошибка: не выбрана команда');
                return;
            }

            if (!projectId) {
                console.error('No project ID provided');
                setError('Ошибка: не указан ID проекта для удаления');
                return;
            }

            console.log('Removing project from team:', {
                teamId: selectedTeam._id,
                projectId: projectId
            });

            const token = localStorage.getItem('token');
            if (!token) {
                setError('Для удаления проекта необходимо войти в систему');
                return;
            }

            await axios.delete(
                `${API_BASE_URL}/api/teams/${selectedTeam._id}/projects/${projectId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('Project successfully removed');

            // Refresh team data
            const response = await axios.get(
                `${API_BASE_URL}/api/teams/${selectedTeam._id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('Updated team data after project removal:', response.data);

            setSelectedTeam(response.data);
            setError(null);

            // Update teams list
            fetchTeams();
            fetchProjects();
        } catch (err) {
            console.error('Error removing project:', err);
            console.error('Response details:', err.response?.status, err.response?.data);
            setError(`Не удалось удалить проект: ${err.response?.data?.error || err.message}`);
        }
    };

    const handleDeleteTeam = async () => {
        try {
            if (!selectedTeam) {
                setError('Нет выбранной команды');
                return;
            }

            const teamId = selectedTeam._id || selectedTeam.id;
            if (!teamId) {
                setError('Ошибка: не удалось определить ID команды');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                setError('Для удаления команды необходимо войти в систему');
                return;
            }

            console.log(`Deleting team with ID: ${teamId}`);
            await axios.delete(`${API_BASE_URL}/api/teams/${teamId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Удаляем команду из списка, учитывая разные форматы ID
            setTeams(teams.filter(team => {
                const currentTeamId = team._id || team.id;
                return currentTeamId !== teamId;
            }));

            setSelectedTeam(null);
            setConfirmDeleteDialog(false);
        } catch (err) {
            console.error('Error deleting team:', err);
            console.error('Response details:', err.response?.status, err.response?.data);
            setError('Не удалось удалить команду. Пожалуйста, попробуйте позже.');
        }
    };

    const handleSelectTeam = async (team) => {
        try {
            const token = localStorage.getItem('token');
            console.log('Selecting team with token:', token ? 'Token exists' : 'No token');
            console.log('Selected team data:', team);

            if (!token) {
                setError('Для просмотра команды необходимо войти в систему.');
                return;
            }

            // Проверка валидности данных команды - принимаем как id, так и _id
            if (!team || (!team._id && !team.id)) {
                console.error('Invalid team data (no ID):', team);
                setError('Некорректные данные команды');
                return;
            }

            // Get the team ID, handling potential different field names
            const teamId = team._id || team.id;
            console.log('Using team ID:', teamId);

            if (!teamId) {
                console.error('Team ID is missing');
                setError('Ошибка: идентификатор команды отсутствует.');
                return;
            }

            try {
                // Сначала загрузим актуальный список всех проектов
                await fetchProjects();

                console.log('Trying main API endpoint...');
                const response = await axios.get(`${API_BASE_URL}/api/teams/${teamId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                console.log('Team details response:', response.data);

                // Проверка данных команды перед установкой в state
                const teamData = { ...response.data };

                // Убедимся, что у команды есть _id (копируем из id если нужно)
                if (!teamData._id && teamData.id) {
                    teamData._id = teamData.id;
                }

                // Проверка наличия _id
                if (!teamData || (!teamData._id && !teamData.id)) {
                    console.error('Invalid team data from server (no ID):', teamData);
                    setError('Получены некорректные данные команды с сервера');
                    return;
                }

                // Убедимся, что members существует и является массивом
                if (!teamData.members) {
                    teamData.members = [];
                }

                // Ensure projects array exists and process it properly
                if (Array.isArray(teamData.projectObjects)) {
                    console.log('Using projectObjects from API response:', teamData.projectObjects);
                    // Use the full project objects directly from the API response
                    teamData.projects = teamData.projectObjects;
                } else if (!teamData.projects) {
                    teamData.projects = [];
                    console.log('No projects in team data, using empty array');
                } else {
                    console.log('Raw team projects from API:', teamData.projects);

                    // If projects is an array of strings (project IDs), process them
                    if (Array.isArray(teamData.projects)) {
                        // Get all project IDs from the team
                        const teamProjectIds = teamData.projects.map(project =>
                            typeof project === 'string' ? project : (project?._id || project?.id)
                        ).filter(Boolean);

                        // Find full project objects from the projects list
                        const fullProjects = projects.filter(project =>
                            teamProjectIds.includes(project._id)
                        );

                        // If we found all projects, use them
                        if (fullProjects.length === teamProjectIds.length) {
                            console.log('Found all projects in projects list:', fullProjects);
                            teamData.projects = fullProjects;
                        } else {
                            // For any missing projects, create minimal objects
                            const processedProjects = teamProjectIds.map(projectId => {
                                const fullProject = projects.find(p => p._id === projectId);
                                return fullProject || null;
                            }).filter(Boolean);

                            console.log('Processed projects:', processedProjects);
                            teamData.projects = processedProjects;
                        }
                    }
                }

                console.log('Final team data to set:', teamData);
                setSelectedTeam(teamData);
                setError(null);

                // Reset tab to first tab when selecting a new team
                setTabValue(0);
            } catch (mainErr) {
                console.error('Main API error:', mainErr);
                console.error('Response details:', mainErr.response?.status, mainErr.response?.data);

                // Try test endpoint if main endpoint fails
                try {
                    console.log('Trying test endpoint...');
                    const testResponse = await axios.get(`${API_BASE_URL}/api/teams-test/${teamId}`);
                    console.log('Test endpoint response:', testResponse.data);

                    if (testResponse.data.success && testResponse.data.team) {
                        const teamData = { ...testResponse.data.team };

                        // Убедимся, что у команды есть _id (копируем из id если нужно)
                        if (!teamData._id && teamData.id) {
                            teamData._id = teamData.id;
                        }

                        // Проверка наличия _id или id
                        if (!teamData || (!teamData._id && !teamData.id)) {
                            console.error('Invalid team data from test server (no ID):', teamData);
                            setError('Получены некорректные данные команды с тестового сервера');
                            return;
                        }

                        // Та же проверка для тестовых данных
                        if (!teamData.members) {
                            teamData.members = [];
                        }

                        if (Array.isArray(teamData.members)) {
                            const uniqueUserIds = new Set();
                            teamData.members = teamData.members.filter(member => {
                                if (!member || !member.userId) return false;

                                const userId = typeof member.userId === 'object' ?
                                    (member.userId._id || member.userId.id) : member.userId;

                                // Если userId уже был добавлен, пропускаем этот элемент
                                if (uniqueUserIds.has(userId)) return false;

                                uniqueUserIds.add(userId);
                                return true;
                            });
                        }

                        // Обработка проектов так же, как в основном блоке
                        if (Array.isArray(teamData.projectObjects)) {
                            console.log('Using projectObjects from test API response:', teamData.projectObjects);
                            // Use the full project objects directly from the API response
                            teamData.projects = teamData.projectObjects;
                        } else if (!teamData.projects) {
                            teamData.projects = [];
                        } else if (Array.isArray(teamData.projects)) {
                            // Get all project IDs from the team
                            const teamProjectIds = teamData.projects.map(project =>
                                typeof project === 'string' ? project : (project?._id || project?.id)
                            ).filter(Boolean);

                            // Find full project objects from the projects list
                            const fullProjects = projects.filter(project =>
                                teamProjectIds.includes(project._id)
                            );

                            // If we found all projects, use them
                            if (fullProjects.length === teamProjectIds.length) {
                                teamData.projects = fullProjects;
                            } else {
                                // For any missing projects, create minimal objects
                                const processedProjects = teamProjectIds.map(projectId => {
                                    const fullProject = projects.find(p => p._id === projectId);
                                    return fullProject || null;
                                }).filter(Boolean);

                                teamData.projects = processedProjects;
                            }
                        } else {
                            teamData.projects = [];
                        }

                        setSelectedTeam(teamData);
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

    // Dialog handlers with safety checks
    const openAddMemberDialog = () => {
        // Получаем текущего пользователя
        try {
            if (!selectedTeam) {
                setError('Выберите команду, чтобы добавить участников');
                return;
            }

            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) {
                console.error('No user found in localStorage');
                setError('Ошибка: данные пользователя не найдены');
                return;
            }

            const userId = user._id || user.id;
            console.log('Current user ID:', userId);

            const teamOwnerId = typeof selectedTeam.owner === 'object' ?
                (selectedTeam.owner._id || selectedTeam.owner.id) : selectedTeam.owner;
            console.log('Team owner ID:', teamOwnerId);

            // Проверяем, является ли текущий пользователь владельцем
            const isOwner = teamOwnerId === userId;
            console.log('Is user the owner:', isOwner);

            // Находим пользователя в списке участников
            const userMember = selectedTeam.members?.find(member => {
                const memberId = typeof member.userId === 'object' ?
                    (member.userId._id || member.userId.id) : member.userId;
                return memberId === userId;
            });

            const userRole = userMember ? userMember.role : (isOwner ? 'owner' : null);
            console.log('User role in team:', userRole);

            if (isOwner || userRole === 'admin') {
                console.log('User can add members');
                // Очистим поле поиска и загрузим начальный список пользователей
                setSearchQuery('');
                // Обнуляем selectedUserId при открытии диалога
                setSelectedUserId('');
                // Загружаем список пользователей
                fetchUsers('');
                // Показываем диалог
                setAddMemberDialog(true);
            } else {
                console.log('User cannot add members');
                setError('У вас недостаточно прав для добавления участников. Только владельцы и администраторы команды могут добавлять новых участников.');
            }
        } catch (err) {
            console.error('Error in openAddMemberDialog:', err);
            setError('Произошла ошибка при проверке прав доступа');
        }
    };

    const openAddProjectDialog = () => {
        if (selectedTeam) {
            // Refresh projects before opening dialog to ensure we have the latest list
            fetchProjects();
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

        // Нормализация ID пользователя
        if (typeof userId === 'object') {
            userId = userId._id || userId.id;
        }

        // Проверяем, является ли пользователь владельцем
        if (team.owner) {
            const ownerId = typeof team.owner === 'object' ?
                (team.owner._id || team.owner.id) : team.owner;

            console.log('Comparing owner id', { ownerId, userId });

            if (ownerId === userId) {
                console.log('User is owner');
                return 'owner';
            }
        }

        // Проверяем роль в списке участников
        if (team.members && Array.isArray(team.members)) {
            // Ищем пользователя в списке участников
            const member = team.members.find(m => {
                if (!m || !m.userId) return false;

                const memberId = typeof m.userId === 'object' ?
                    (m.userId._id || m.userId.id) : m.userId;

                console.log('Comparing member id', { memberId, userId });
                return memberId === userId;
            });

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

            if (!selectedTeam) {
                console.log('Missing team data');
                setError('Ошибка: отсутствуют данные команды');
                return;
            }

            // Проверка данных проекта
            const projectId = project._id || project.id;
            if (!projectId) {
                console.error('Project ID is missing', project);
                setError('Ошибка: отсутствует ID проекта');
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
                setError('У вас нет доступа к этому проекту');
                return;
            }

            // Определяем маршрут в зависимости от роли
            const route = (userRole === 'owner' || userRole === 'admin' || userRole === 'editor')
                ? `/teams/${selectedTeam._id}/projects/${projectId}/constructor`
                : `/teams/${selectedTeam._id}/projects/${projectId}/viewer`;

            console.log('Navigating to:', route);
            navigate(route);
        } catch (error) {
            console.error('Error in handleProjectClick:', error);
            setError('Произошла ошибка при открытии проекта');
        }
    };

    if (loading) {
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: `linear-gradient(135deg, #0a0e24 0%, #111536 100%)`
            }}>
                <Navbar />
                <Box sx={{
                    flexGrow: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    pt: 8
                }}>
                    <CircularProgress sx={{ color: COLORS.tertiary }} />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: `linear-gradient(135deg, #0a0e24 0%, #111536 100%)`,
            position: 'relative',
        }}>
            {/* Decorative elements */}
            <DecorativeCircle top="15%" left="-5%" size={300} color={COLORS.primary} delay={0.2} />
            <DecorativeCircle top="70%" left="90%" size={200} color={COLORS.tertiary} delay={0.4} />
            <DecorativeCircle top="90%" left="10%" size={150} color={COLORS.secondary} delay={0.6} />

            <Navbar />
            <Container component="main" maxWidth="lg" sx={{ py: 6, mt: 4, position: 'relative', zIndex: 2 }}>
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 5,
                    animation: `${fadeIn} 0.7s ease-out forwards`
                }}>
                    <Box>
                        <Typography variant="h4" component="h1" sx={{
                            fontWeight: 700,
                            color: '#FFFFFF',
                            mb: 1,
                            position: 'relative',
                            display: 'inline-block',
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                bottom: -8,
                                left: 0,
                                width: '40%',
                                height: 3,
                                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                                borderRadius: 2
                            }
                        }}>
                            Управление командами
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            Создавайте команды и управляйте совместными проектами
                        </Typography>
                    </Box>

                    <StyledButton
                        startIcon={<AddIcon />}
                        onClick={() => setCreateTeamDialog(true)}
                        sx={{ px: 3, py: 1 }}
                    >
                        Создать команду
                    </StyledButton>
                </Box>

                {error && (
                    <Alert
                        severity="error"
                        sx={{
                            mb: 4,
                            borderRadius: '12px',
                            '& .MuiAlert-icon': {
                                color: COLORS.tertiary
                            }
                        }}
                    >
                        {error}
                    </Alert>
                )}

                <Grid container spacing={4}>
                    {/* Teams list */}
                    <Grid item xs={12} md={4}>
                        <StyledPaper sx={{ height: '100%' }}>
                            <SectionTitle variant="h5">
                                <GroupsIcon sx={{ mr: 1, color: COLORS.tertiary, verticalAlign: 'middle' }} />
                                Мои команды
                            </SectionTitle>

                            <Box sx={{ mt: 3 }}>
                                {teams.length === 0 ? (
                                    <Box sx={{
                                        py: 4,
                                        textAlign: 'center',
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        borderRadius: '12px',
                                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                                        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
                                        backgroundSize: '20px 20px',
                                    }}>
                                        <Typography variant="body1" sx={{ mb: 2 }}>
                                            У вас пока нет команд
                                        </Typography>
                                        <StyledButton
                                            startIcon={<AddIcon />}
                                            onClick={() => setCreateTeamDialog(true)}
                                            size="small"
                                        >
                                            Создать команду
                                        </StyledButton>
                                    </Box>
                                ) : (
                                    <List sx={{
                                        bgcolor: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: 3,
                                        p: 1
                                    }}>
                                        {teams.map((team) => (
                                            <TeamListItem
                                                key={team._id || team.id}
                                                button
                                                selected={selectedTeam && (selectedTeam._id === team._id || selectedTeam.id === team.id)}
                                                onClick={() => handleSelectTeam(team)}
                                            >
                                                <Avatar
                                                    sx={{
                                                        mr: 1.5,
                                                        bgcolor: `${COLORS.primary}30`,
                                                        color: COLORS.primary
                                                    }}
                                                >
                                                    {team.name.charAt(0).toUpperCase()}
                                                </Avatar>
                                                <ListItemText
                                                    primary={
                                                        <Typography
                                                            variant="body1"
                                                            sx={{
                                                                fontWeight: 600,
                                                                color: selectedTeam && (selectedTeam._id === team._id || selectedTeam.id === team.id)
                                                                    ? COLORS.primary
                                                                    : 'white'
                                                            }}
                                                        >
                                                            {team.name}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Typography
                                                            variant="body2"
                                                            sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                                                        >
                                                            {team.members?.length || 0} участников
                                                        </Typography>
                                                    }
                                                />
                                            </TeamListItem>
                                        ))}
                                    </List>
                                )}
                            </Box>
                        </StyledPaper>
                    </Grid>

                    {/* Team details */}
                    <Grid item xs={12} md={8}>
                        {selectedTeam ? (
                            <StyledPaper>
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    mb: 3
                                }}>
                                    <Box>
                                        <Typography variant="h5" sx={{
                                            fontWeight: 700,
                                            color: '#FFFFFF',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            <WorkspacesIcon sx={{ mr: 1, color: COLORS.tertiary }} />
                                            {selectedTeam.name}
                                        </Typography>
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                mt: 1
                                            }}
                                        >
                                            {selectedTeam.description || 'Описание отсутствует'}
                                        </Typography>
                                    </Box>

                                    <StyledOutlinedButton
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => setConfirmDeleteDialog(true)}
                                        sx={{ color: COLORS.tertiary }}
                                    >
                                        Удалить команду
                                    </StyledOutlinedButton>
                                </Box>

                                <Box sx={{ mt: 4 }}>
                                    <Tabs
                                        value={tabValue}
                                        onChange={handleTabChange}
                                        sx={{
                                            borderBottom: 1,
                                            borderColor: 'rgba(255, 255, 255, 0.1)',
                                            mb: 3
                                        }}
                                        TabIndicatorProps={{
                                            style: {
                                                backgroundColor: COLORS.tertiary,
                                                height: 3,
                                                borderRadius: '3px 3px 0 0'
                                            }
                                        }}
                                    >
                                        <StyledTab
                                            label="Участники"
                                            icon={<PeopleAltIcon />}
                                            iconPosition="start"
                                        />
                                        <StyledTab
                                            label="Проекты"
                                            icon={<FolderSharedIcon />}
                                            iconPosition="start"
                                        />
                                    </Tabs>

                                    {tabValue === 0 && (
                                        <Box>
                                            <Box sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                mb: 2
                                            }}>
                                                <Typography variant="h6" sx={{
                                                    color: '#FFFFFF',
                                                    fontWeight: 600
                                                }}>
                                                    Участники команды
                                                </Typography>

                                                <StyledButton
                                                    size="small"
                                                    startIcon={<PersonAddIcon />}
                                                    onClick={openAddMemberDialog}
                                                >
                                                    Добавить участника
                                                </StyledButton>
                                            </Box>

                                            <Box sx={{
                                                bgcolor: 'rgba(0, 0, 0, 0.2)',
                                                borderRadius: 3,
                                                p: 2
                                            }}>
                                                {/* List of members */}
                                                {selectedTeam ? (
                                                    (selectedTeam.members?.length > 0 || selectedTeam.owner) ? (
                                                        <List>
                                                            {/* Отображение владельца команды */}
                                                            {selectedTeam.owner && (
                                                                (() => {
                                                                    const ownerData = typeof selectedTeam.owner === 'object' ?
                                                                        selectedTeam.owner :
                                                                        selectedTeam.members?.find(m => {
                                                                            const memberId = typeof m.userId === 'object' ?
                                                                                (m.userId._id || m.userId.id) : m.userId;
                                                                            const ownerId = typeof selectedTeam.owner === 'object' ?
                                                                                (selectedTeam.owner._id || selectedTeam.owner.id) : selectedTeam.owner;
                                                                            return memberId === ownerId;
                                                                        })?.userId;

                                                                    const ownerId = typeof ownerData === 'object' ?
                                                                        (ownerData._id || ownerData.id) : selectedTeam.owner;

                                                                    const ownerUsername = typeof ownerData === 'object' ?
                                                                        ownerData.username : 'Владелец';

                                                                    return (
                                                                        <ListItem
                                                                            key={`owner-${ownerId}`}
                                                                            button
                                                                            onClick={() => handleUserSelect({ _id: ownerId, username: ownerUsername })}
                                                                            selected={selectedUserId === ownerId}
                                                                            sx={{
                                                                                borderRadius: 1,
                                                                                m: 0.5,
                                                                                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
                                                                                backgroundColor: selectedUserId === ownerId ? alpha(COLORS.primary, 0.2) : 'transparent',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                        >
                                                                            <Avatar
                                                                                sx={{
                                                                                    mr: 1.5,
                                                                                    bgcolor: `${COLORS.primary}50`,
                                                                                    color: COLORS.primary
                                                                                }}
                                                                            >
                                                                                {ownerUsername?.charAt(0).toUpperCase()}
                                                                            </Avatar>
                                                                            <ListItemText
                                                                                primary={
                                                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                                        <Typography variant="body1" sx={{ color: '#FFFFFF' }}>
                                                                                            {ownerUsername}
                                                                                        </Typography>
                                                                                        <Chip
                                                                                            size="small"
                                                                                            label="Владелец"
                                                                                            sx={{
                                                                                                ml: 1,
                                                                                                backgroundColor: `${COLORS.primary}30`,
                                                                                                color: COLORS.primary,
                                                                                                fontSize: '0.7rem',
                                                                                                height: 20
                                                                                            }}
                                                                                        />
                                                                                    </Box>
                                                                                }
                                                                                secondary={
                                                                                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                                                                        {ownerId}
                                                                                    </Typography>
                                                                                }
                                                                            />
                                                                        </ListItem>
                                                                    );
                                                                })()
                                                            )}

                                                            {/* Отображение остальных участников */}
                                                            {selectedTeam.members && selectedTeam.members
                                                                .filter(member => {
                                                                    // Фильтруем, чтобы не дублировать владельца, если он уже есть в списке участников
                                                                    const memberId = typeof member.userId === 'object' ?
                                                                        (member.userId._id || member.userId.id) : member.userId;

                                                                    const ownerId = typeof selectedTeam.owner === 'object' ?
                                                                        (selectedTeam.owner._id || selectedTeam.owner.id) : selectedTeam.owner;

                                                                    return memberId !== ownerId;
                                                                })
                                                                .map((member) => {
                                                                    const userId = typeof member.userId === 'object' ?
                                                                        (member.userId._id || member.userId.id) : member.userId;

                                                                    const username = typeof member.userId === 'object' ?
                                                                        (member.userId.username) : '';

                                                                    const role = member.role;

                                                                    return (
                                                                        <ListItem
                                                                            key={userId}
                                                                            button
                                                                            onClick={() => handleUserSelect({ _id: userId, username })}
                                                                            selected={selectedUserId === userId}
                                                                            sx={{
                                                                                borderRadius: 1,
                                                                                m: 0.5,
                                                                                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
                                                                                backgroundColor: selectedUserId === userId ? alpha(COLORS.primary, 0.2) : 'transparent',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                        >
                                                                            <Avatar
                                                                                sx={{
                                                                                    mr: 1.5,
                                                                                    bgcolor: `${COLORS.tertiary}30`,
                                                                                    color: COLORS.tertiary
                                                                                }}
                                                                            >
                                                                                {username?.charAt(0).toUpperCase()}
                                                                            </Avatar>
                                                                            <ListItemText
                                                                                primary={
                                                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                                        <Typography variant="body1" sx={{ color: '#FFFFFF' }}>
                                                                                            {username}
                                                                                        </Typography>
                                                                                        {role === 'admin' && (
                                                                                            <Chip
                                                                                                size="small"
                                                                                                label="Админ"
                                                                                                sx={{
                                                                                                    ml: 1,
                                                                                                    backgroundColor: `${COLORS.tertiary}30`,
                                                                                                    color: COLORS.tertiary,
                                                                                                    fontSize: '0.7rem',
                                                                                                    height: 20
                                                                                                }}
                                                                                            />
                                                                                        )}
                                                                                    </Box>
                                                                                }
                                                                                secondary={
                                                                                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                                                                        {userId}
                                                                                    </Typography>
                                                                                }
                                                                            />
                                                                        </ListItem>
                                                                    );
                                                                })}
                                                        </List>
                                                    ) : (
                                                        <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                                                            В команде пока нет участников
                                                        </Box>
                                                    )
                                                ) : (
                                                    <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                                                        Выберите команду
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    )}

                                    {tabValue === 1 && (
                                        <Box>
                                            <Box sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                mb: 2
                                            }}>
                                                <Typography variant="h6" sx={{
                                                    color: '#FFFFFF',
                                                    fontWeight: 600
                                                }}>
                                                    Проекты команды
                                                </Typography>

                                                <StyledButton
                                                    size="small"
                                                    startIcon={<FolderIcon />}
                                                    onClick={openAddProjectDialog}
                                                >
                                                    Добавить проект
                                                </StyledButton>
                                            </Box>

                                            <Box sx={{
                                                bgcolor: 'rgba(0, 0, 0, 0.2)',
                                                borderRadius: 3,
                                                p: 2
                                            }}>
                                                {/* List of projects */}
                                                {selectedTeam?.projects && selectedTeam.projects.length > 0 ? (
                                                    <List>
                                                        {selectedTeam.projects.map((project) => (
                                                            <ListItem
                                                                key={project._id}
                                                                button
                                                                onClick={() => handleProjectClick(project)}
                                                                sx={{
                                                                    borderRadius: 1,
                                                                    m: 0.5,
                                                                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
                                                                    backgroundColor: selectedTeam._id === project._id ? alpha(COLORS.primary, 0.2) : 'transparent',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                <Avatar
                                                                    sx={{
                                                                        mr: 1.5,
                                                                        bgcolor: `${COLORS.tertiary}30`,
                                                                        color: COLORS.tertiary
                                                                    }}
                                                                >
                                                                    {project.name?.charAt(0).toUpperCase()}
                                                                </Avatar>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ color: '#FFFFFF' }}>
                                                                            {project.name}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                                                            {project._id}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                ) : (
                                                    <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                                                        В команде пока нет проектов
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            </StyledPaper>
                        ) : (
                            <StyledPaper sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                p: 8,
                                textAlign: 'center'
                            }}>
                                <GroupsIcon sx={{ fontSize: 80, color: alpha(COLORS.primary, 0.5), mb: 3 }} />
                                <Typography variant="h5" sx={{ mb: 2, color: '#FFFFFF', fontWeight: 600 }}>
                                    Выберите команду
                                </Typography>
                                <Typography variant="body1" sx={{ mb: 4, color: 'rgba(255, 255, 255, 0.7)' }}>
                                    Выберите команду из списка слева или создайте новую
                                </Typography>
                                <StyledButton
                                    startIcon={<AddIcon />}
                                    onClick={() => setCreateTeamDialog(true)}
                                >
                                    Создать команду
                                </StyledButton>
                            </StyledPaper>
                        )}
                    </Grid>
                </Grid>
            </Container>

            {/* Dialogs */}
            {/* Use StyledDialog for all dialogs */}
            <StyledDialog
                open={createTeamDialog}
                onClose={() => setCreateTeamDialog(false)}
                aria-labelledby="create-team-dialog-title"
            >
                <DialogTitle id="create-team-dialog-title">Создать новую команду</DialogTitle>
                <DialogContent>
                    <StyledTextField
                        autoFocus
                        margin="dense"
                        id="teamName"
                        label="Название команды"
                        type="text"
                        fullWidth
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                    />
                    <StyledTextField
                        margin="dense"
                        id="teamDescription"
                        label="Описание команды"
                        type="text"
                        fullWidth
                        multiline
                        rows={3}
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => setCreateTeamDialog(false)}
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            '&:hover': { color: '#FFFFFF' }
                        }}
                    >
                        Отмена
                    </Button>
                    <StyledButton onClick={handleCreateTeam}>
                        Создать
                    </StyledButton>
                </DialogActions>
            </StyledDialog>

            {/* Add Member Dialog */}
            <StyledDialog
                open={addMemberDialog && selectedTeam !== null}
                onClose={() => {
                    setAddMemberDialog(false);
                    setSearchQuery('');
                    setSelectedUserId('');
                }}
                aria-labelledby="add-member-dialog-title"
            >
                <DialogTitle id="add-member-dialog-title">Добавить участника</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
                        Добавьте участника в команду и установите уровень доступа
                    </Typography>

                    <StyledTextField
                        fullWidth
                        margin="dense"
                        label="Поиск пользователей"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Поиск по имени или email..."
                        sx={{ mb: 2 }}
                    />

                    {users.length > 0 ? (
                        <Box sx={{
                            maxHeight: 200,
                            overflow: 'auto',
                            mb: 2,
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 2,
                            bgcolor: 'rgba(0, 0, 0, 0.2)',
                        }}>
                            <List>
                                {users.map((user) => (
                                    <ListItem
                                        key={user._id}
                                        button
                                        onClick={() => handleUserSelect(user)}
                                        selected={selectedUserId === user._id}
                                        sx={{
                                            borderRadius: 1,
                                            m: 0.5,
                                            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
                                            backgroundColor: selectedUserId === user._id ? alpha(COLORS.primary, 0.2) : 'transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Avatar
                                            sx={{
                                                mr: 1.5,
                                                bgcolor: `${COLORS.tertiary}30`,
                                                color: COLORS.tertiary
                                            }}
                                        >
                                            {user.username?.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <ListItemText
                                            primary={
                                                <Typography variant="body1" sx={{ color: '#FFFFFF' }}>
                                                    {user.username}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                                    {user.email}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    ) : searchQuery ? (
                        <Box sx={{
                            mb: 2,
                            p: 2,
                            textAlign: 'center',
                            color: 'rgba(255, 255, 255, 0.5)',
                            border: '1px dashed rgba(255, 255, 255, 0.1)',
                            borderRadius: 2
                        }}>
                            Пользователи не найдены
                        </Box>
                    ) : null}

                    {selectedUserId && (
                        <Box sx={{
                            mb: 2,
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(COLORS.primary, 0.15),
                            border: `1px solid ${alpha(COLORS.primary, 0.2)}`
                        }}>
                            <Typography variant="body2" sx={{ color: COLORS.primary }}>
                                Выбран пользователь: {searchQuery}
                            </Typography>
                        </Box>
                    )}

                    <FormControl fullWidth margin="dense" variant="outlined" sx={{ mt: 2 }}>
                        <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Роль</InputLabel>
                        <Select
                            value={selectedUserRole}
                            onChange={(e) => setSelectedUserRole(e.target.value)}
                            label="Роль"
                            sx={{
                                borderRadius: 2,
                                color: '#FFFFFF',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255, 255, 255, 0.2)'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: COLORS.primaryLight
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: COLORS.primary
                                }
                            }}
                        >
                            <MenuItem value="admin">Администратор</MenuItem>
                            <MenuItem value="editor">Редактор</MenuItem>
                            <MenuItem value="viewer">Просмотр</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => {
                            setAddMemberDialog(false);
                            setSearchQuery('');
                            setSelectedUserId('');
                        }}
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            '&:hover': { color: '#FFFFFF' }
                        }}
                    >
                        Отмена
                    </Button>
                    <StyledButton onClick={handleAddMember}>
                        Добавить
                    </StyledButton>
                </DialogActions>
            </StyledDialog>

            {/* Add Project Dialog */}
            <StyledDialog
                open={addProjectDialog && selectedTeam !== null}
                onClose={() => setAddProjectDialog(false)}
                aria-labelledby="add-project-dialog-title"
            >
                <DialogTitle id="add-project-dialog-title">Добавить проект в команду</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
                        Выберите проект, который хотите добавить в команду
                    </Typography>

                    <FormControl fullWidth margin="dense" variant="outlined" sx={{ mt: 2 }}>
                        <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Проект</InputLabel>
                        <Select
                            value={selectedProjectId}
                            onChange={(e) => {
                                const value = e.target.value;
                                console.log('Selected project ID from dropdown:', value);
                                if (value && value !== 'undefined' && value !== 'null') {
                                    setSelectedProjectId(value);
                                } else {
                                    console.error('Invalid project ID selected:', value);
                                    setError('Выбран некорректный проект');
                                }
                            }}
                            label="Проект"
                            required
                            sx={{
                                borderRadius: 2,
                                color: '#FFFFFF',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255, 255, 255, 0.2)'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: COLORS.primaryLight
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: COLORS.primary
                                }
                            }}
                        >
                            <MenuItem value="" disabled>Выберите проект</MenuItem>
                            {projects && projects.length > 0 ? (
                                projects
                                    .filter(project => {
                                        // Проверяем, есть ли у проекта ID
                                        const projectId = project._id || project.id;
                                        if (!projectId) {
                                            console.log('Project without ID in dropdown filter:', project);
                                            return false;
                                        }

                                        // Fix: properly handle project filtering
                                        if (!selectedTeam || !selectedTeam.projects) {
                                            return true; // If no projects in team, show all
                                        }

                                        // Convert the team's project array to ensure we're comparing properly
                                        const teamProjectIds = Array.isArray(selectedTeam.projects)
                                            ? selectedTeam.projects.map(teamProject => {
                                                console.log('Team project item:', teamProject);
                                                if (typeof teamProject === 'string') {
                                                    return teamProject;
                                                } else if (teamProject && (teamProject._id || teamProject.id)) {
                                                    return teamProject._id || teamProject.id;
                                                }
                                                return null;
                                            }).filter(id => id !== null)
                                            : [];
                                        console.log('Team project IDs:', teamProjectIds);
                                        console.log('Current project ID:', projectId);
                                        const isInTeam = teamProjectIds.includes(projectId);
                                        console.log(`Project ${project.name} (${projectId}) already in team: ${isInTeam}`);
                                        return !isInTeam;
                                    })
                                    .map((project) => {
                                        const projectId = project._id || project.id;
                                        return (
                                            <MenuItem key={projectId} value={projectId}>
                                                {project.name || 'Без названия'} ({projectId})
                                            </MenuItem>
                                        );
                                    })
                            ) : (
                                <MenuItem disabled>
                                    Нет доступных проектов
                                </MenuItem>
                            )}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => setAddProjectDialog(false)}
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            '&:hover': { color: '#FFFFFF' }
                        }}
                    >
                        Отмена
                    </Button>
                    <StyledButton
                        onClick={() => {
                            console.log('Add project button clicked');
                            console.log('Current selectedProjectId:', selectedProjectId);

                            // Дополнительная проверка валидности ID
                            if (!selectedProjectId || selectedProjectId === 'undefined' || selectedProjectId === 'null') {
                                console.error('Invalid project ID:', selectedProjectId);
                                setError('Выбран некорректный проект. Пожалуйста, выберите другой проект из списка.');
                                return;
                            }

                            // Проверяем, существует ли проект с таким ID в списке
                            const selectedProject = projects.find(p => {
                                const projectId = p._id || p.id;
                                return projectId === selectedProjectId;
                            });

                            if (!selectedProject) {
                                console.error('Selected project not found in projects list');
                                setError('Выбранный проект не найден в списке доступных проектов');
                                return;
                            }

                            console.log('Selected project object:', selectedProject);
                            console.log('Is button disabled:', !selectedProjectId);
                            handleAddProject();
                        }}
                        disabled={!selectedProjectId}
                    >
                        Добавить
                    </StyledButton>
                </DialogActions>
            </StyledDialog>

            {/* Confirm Delete Dialog */}
            <StyledDialog
                open={confirmDeleteDialog && selectedTeam !== null}
                onClose={() => setConfirmDeleteDialog(false)}
                aria-labelledby="delete-team-dialog-title"
            >
                <DialogTitle id="delete-team-dialog-title">Удалить команду</DialogTitle>
                <DialogContent>
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        my: 2
                    }}>
                        <DeleteIcon sx={{
                            fontSize: 48,
                            color: COLORS.tertiary,
                            mb: 2
                        }} />
                        <Typography variant="body1" sx={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.9)' }}>
                            Вы уверены, что хотите удалить команду <strong>"{selectedTeam?.name}"</strong>?
                        </Typography>
                        <Typography variant="body2" sx={{
                            textAlign: 'center',
                            color: 'rgba(255, 255, 255, 0.7)',
                            mt: 1
                        }}>
                            Это действие нельзя отменить.
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => setConfirmDeleteDialog(false)}
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            '&:hover': { color: '#FFFFFF' }
                        }}
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={handleDeleteTeam}
                        sx={{
                            backgroundColor: COLORS.tertiary,
                            color: '#FFFFFF',
                            '&:hover': {
                                backgroundColor: alpha(COLORS.tertiary, 0.8)
                            },
                            borderRadius: 2,
                            fontWeight: 600,
                            textTransform: 'none',
                            px: 3
                        }}
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </StyledDialog>
        </Box>
    );
}

export default TeamManagement; 