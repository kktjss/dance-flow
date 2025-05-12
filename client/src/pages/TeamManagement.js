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
            setAddMemberDialog(false);
            setSelectedUserId('');
            setSelectedUserRole('viewer');
            setError(null);

            // Update teams list
            fetchTeams();
        } catch (err) {
            console.error('Error adding member:', err);
            const errorMessage = err.response?.data?.error || 'Не удалось добавить участника. Пожалуйста, попробуйте позже.';
            setError(errorMessage);
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
                                            <React.Fragment key={team._id || team.id}>
                                                <ListItem
                                                    button
                                                    selected={selectedTeam && (selectedTeam._id === team._id || selectedTeam._id === team.id || selectedTeam.id === team._id || selectedTeam.id === team.id)}
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
                                                                primary={selectedTeam.owner.username || selectedTeam.owner.name || 'Владелец'}
                                                                secondary={selectedTeam.owner.email || ''}
                                                            />
                                                            <Chip label="Владелец" color="primary" size="small" />
                                                        </ListItem>
                                                    )}
                                                    <Divider />

                                                    {/* Members */}
                                                    {console.log('Team members data:', selectedTeam.members)}

                                                    {Array.isArray(selectedTeam.members) && selectedTeam.members.length > 0 ? (
                                                        selectedTeam.members.map((member) => {
                                                            console.log('Rendering member:', member);

                                                            // Проверка на наличие данных пользователя
                                                            if (!member || !member.userId) {
                                                                console.log('Invalid member data:', member);
                                                                return null;
                                                            }

                                                            // Адаптация к разным форматам данных с сервера
                                                            const userId = typeof member.userId === 'object' ?
                                                                (member.userId._id || member.userId.id) :
                                                                member.userId;

                                                            const username = typeof member.userId === 'object' ?
                                                                (member.userId.username || member.userId.name || 'Неизвестный пользователь') :
                                                                (member.name || 'Неизвестный пользователь');

                                                            const email = typeof member.userId === 'object' ?
                                                                member.userId.email :
                                                                member.email;

                                                            // Проверка, что это не владелец команды
                                                            const isOwner = selectedTeam.owner &&
                                                                (userId === (typeof selectedTeam.owner === 'object' ?
                                                                    (selectedTeam.owner._id || selectedTeam.owner.id) :
                                                                    selectedTeam.owner));

                                                            if (isOwner) {
                                                                console.log('Skipping owner in members list');
                                                                return null;
                                                            }

                                                            // Получаем данные текущего пользователя
                                                            const currentUser = JSON.parse(localStorage.getItem('user'));
                                                            const currentUserId = currentUser?._id || currentUser?.id;

                                                            // Определяем, имеет ли текущий пользователь право удалять участников
                                                            const currentUserRole = getUserRole(selectedTeam, currentUserId);
                                                            const canRemoveMember = currentUserRole === 'owner' ||
                                                                (currentUserRole === 'admin' && member.role !== 'admin');

                                                            return (
                                                                <React.Fragment key={userId}>
                                                                    <ListItem>
                                                                        <ListItemText
                                                                            primary={username}
                                                                            secondary={email || ''}
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
                                                                            {canRemoveMember && (
                                                                                <IconButton
                                                                                    edge="end"
                                                                                    size="small"
                                                                                    onClick={() => handleRemoveMember(userId)}
                                                                                    title={member.role === 'admin' ?
                                                                                        'Удалить администратора' :
                                                                                        'Удалить участника'}
                                                                                >
                                                                                    <DeleteIcon />
                                                                                </IconButton>
                                                                            )}
                                                                        </Box>
                                                                    </ListItem>
                                                                    <Divider />
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        <ListItem>
                                                            <ListItemText primary="В команде пока нет участников кроме владельца" />
                                                        </ListItem>
                                                    )}
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
                                                    {!Array.isArray(selectedTeam.projects) || selectedTeam.projects.length === 0 ? (
                                                        <ListItem>
                                                            <ListItemText primary="У команды пока нет проектов" />
                                                        </ListItem>
                                                    ) : (
                                                        selectedTeam.projects.map((project) => {
                                                            // Получаем данные пользователя один раз для всего блока рендеринга
                                                            const currentUser = JSON.parse(localStorage.getItem('user'));
                                                            const currentUserId = currentUser?._id || currentUser?.id;
                                                            const userRole = getUserRole(selectedTeam, currentUserId);

                                                            console.log('Rendering project in list:', project);

                                                            // Убедимся, что у проекта есть ID
                                                            const projectId = project._id || project.id;
                                                            if (!projectId) {
                                                                console.error('Project without ID in render:', project);
                                                                return null;
                                                            }

                                                            // Проверка наличия имени проекта
                                                            const projectName = project.name || 'Без названия';
                                                            const projectDesc = project.description || 'Без описания';

                                                            return (
                                                                <React.Fragment key={projectId}>
                                                                    <ListItem
                                                                        button
                                                                        onClick={() => {
                                                                            console.log('Project item clicked:', project);
                                                                            handleProjectClick(project);
                                                                        }}
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
                                                                            primary={projectName}
                                                                            secondary={projectDesc}
                                                                        />
                                                                        {(userRole === 'admin' || userRole === 'owner') && (
                                                                            <IconButton
                                                                                edge="end"
                                                                                size="small"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    console.log('Remove project button clicked:', {
                                                                                        projectId,
                                                                                        project
                                                                                    });
                                                                                    handleRemoveProject(projectId);
                                                                                }}
                                                                                title="Удалить проект из команды"
                                                                            >
                                                                                <DeleteIcon />
                                                                            </IconButton>
                                                                        )}
                                                                    </ListItem>
                                                                    <Divider />
                                                                </React.Fragment>
                                                            );
                                                        })
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

                    {users.length > 0 ? (
                        <List sx={{ maxHeight: 200, overflow: 'auto', mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                            {users.map((user) => (
                                <ListItem
                                    key={user._id}
                                    button
                                    onClick={() => handleUserSelect(user)}
                                    selected={selectedUserId === user._id}
                                    sx={{
                                        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                                        backgroundColor: selectedUserId === user._id ? 'rgba(25, 118, 210, 0.12)' : 'transparent'
                                    }}
                                >
                                    <ListItemText
                                        primary={user.username}
                                        secondary={user.email}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    ) : searchQuery ? (
                        <Box sx={{ mb: 2, p: 1, textAlign: 'center', color: 'text.secondary' }}>
                            Пользователи не найдены
                        </Box>
                    ) : null}

                    {selectedUserId && (
                        <Box sx={{ mb: 2, p: 1, border: 1, borderColor: 'primary.main', borderRadius: 1, bgcolor: 'background.paper' }}>
                            <Typography variant="body2" color="primary">
                                Выбран пользователь: {searchQuery}
                            </Typography>
                        </Box>
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
                        variant="contained"
                        color="primary"
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
                <DialogActions>
                    <Button onClick={() => setAddProjectDialog(false)}>Отмена</Button>
                    <Button
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