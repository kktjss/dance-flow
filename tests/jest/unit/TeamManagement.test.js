import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import TeamManagement from '../../../client/src/pages/TeamManagement';

// Мокаем сервисы
jest.mock('../../../client/src/services/teamService', () => ({
    getTeams: jest.fn().mockResolvedValue({
        data: [
            {
                _id: 'team1',
                name: 'Dance Studio Team',
                description: 'Professional dancers team',
                createdBy: 'user1',
                members: [
                    { _id: 'user1', username: 'testuser', role: 'owner' },
                    { _id: 'user2', username: 'member1', role: 'member' },
                    { _id: 'user3', username: 'member2', role: 'member' }
                ],
                projects: [
                    { _id: 'project1', name: 'Team Project 1' },
                    { _id: 'project2', name: 'Team Project 2' }
                ],
                createdAt: '2023-01-15T10:00:00Z'
            },
            {
                _id: 'team2',
                name: 'Dance Class',
                description: 'Weekly dance class group',
                createdBy: 'user2',
                members: [
                    { _id: 'user2', username: 'member1', role: 'owner' },
                    { _id: 'user1', username: 'testuser', role: 'member' }
                ],
                projects: [
                    { _id: 'project3', name: 'Class Routine' }
                ],
                createdAt: '2023-02-20T10:00:00Z'
            }
        ]
    }),
    createTeam: jest.fn().mockImplementation((teamData) => Promise.resolve({
        data: {
            _id: 'new-team-id',
            ...teamData,
            members: [{ _id: 'user1', username: 'testuser', role: 'owner' }],
            projects: [],
            createdAt: new Date().toISOString()
        }
    })),
    deleteTeam: jest.fn().mockResolvedValue({ data: { message: 'Team deleted successfully' } }),
    addMember: jest.fn().mockImplementation((teamId, userData) => Promise.resolve({
        data: {
            message: 'Member added successfully',
            member: { _id: userData.userId, username: userData.username, role: 'member' }
        }
    })),
    removeMember: jest.fn().mockResolvedValue({ data: { message: 'Member removed successfully' } }),
    updateTeam: jest.fn().mockImplementation((teamId, updates) => Promise.resolve({
        data: {
            _id: teamId,
            ...updates,
            members: [{ _id: 'user1', username: 'testuser', role: 'owner' }],
            projects: [],
            createdAt: '2023-01-15T10:00:00Z'
        }
    }))
}));

// Мокаем сервис пользователей для поиска участников
jest.mock('../../../client/src/services/userService', () => ({
    searchUsers: jest.fn().mockResolvedValue({
        data: [
            { _id: 'user4', username: 'newmember1', email: 'new1@example.com' },
            { _id: 'user5', username: 'newmember2', email: 'new2@example.com' }
        ]
    })
}));

// Мокаем функцию навигации
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate
}));

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('TeamManagement Component', () => {
    let store;

    beforeEach(() => {
        // Сбрасываем моки
        jest.clearAllMocks();

        // Создаем стор с начальным состоянием
        store = mockStore({
            auth: {
                isAuthenticated: true,
                user: {
                    _id: 'user1',
                    username: 'testuser',
                    email: 'test@example.com'
                },
                token: 'test.jwt.token'
            },
            teams: {
                teams: [],
                currentTeam: null,
                isLoading: false,
                error: null
            }
        });
    });

    test('renders team management page with teams list', async () => {
        const { getTeams } = require('../../../client/src/services/teamService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamManagement />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем отображение индикатора загрузки изначально
        expect(screen.getByTestId('teams-loading')).toBeInTheDocument();

        // Проверяем вызов getTeams
        expect(getTeams).toHaveBeenCalled();

        // Ждем загрузки команд
        await waitFor(() => {
            expect(screen.getByText('My Teams')).toBeInTheDocument();
        });

        // Проверяем отображение карточек команд
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
            expect(screen.getByText('Dance Class')).toBeInTheDocument();
        });

        // Проверяем описания команд
        expect(screen.getByText('Professional dancers team')).toBeInTheDocument();
        expect(screen.getByText('Weekly dance class group')).toBeInTheDocument();

        // Проверяем количество участников
        const memberCounts = screen.getAllByText(/members/i);
        expect(memberCounts.length).toBe(2);
    });

    test('creates a new team', async () => {
        const { createTeam } = require('../../../client/src/services/teamService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamManagement />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки команд
        await waitFor(() => {
            expect(screen.getByText('My Teams')).toBeInTheDocument();
        });

        // Нажимаем кнопку создания команды
        const createButton = screen.getByText('Create Team');
        fireEvent.click(createButton);

        // Проверяем появление модального окна
        await waitFor(() => {
            expect(screen.getByText('Create New Team')).toBeInTheDocument();
        });

        // Заполняем форму
        const nameInput = screen.getByLabelText('Team Name');
        const descriptionInput = screen.getByLabelText('Description');

        fireEvent.change(nameInput, { target: { value: 'New Dance Crew' } });
        fireEvent.change(descriptionInput, { target: { value: 'A fresh new dance team' } });

        // Отправляем форму
        const submitButton = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(submitButton);

        // Проверяем вызов createTeam с правильными данными
        expect(createTeam).toHaveBeenCalledWith({
            name: 'New Dance Crew',
            description: 'A fresh new dance team'
        });

        // Проверяем появление сообщения об успехе
        await waitFor(() => {
            expect(screen.getByText('Team created successfully')).toBeInTheDocument();
        });
    });

    test('opens team details and adds a member', async () => {
        const { getTeams, addMember } = require('../../../client/src/services/teamService');
        const { searchUsers } = require('../../../client/src/services/userService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamManagement />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки команд
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Нажимаем на карточку команды для просмотра деталей
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Проверяем отображение деталей команды
        await waitFor(() => {
            expect(screen.getByText('Team Details')).toBeInTheDocument();
            expect(screen.getByText('Members (3)')).toBeInTheDocument();
        });

        // Проверяем список участников
        expect(screen.getByText('testuser (owner)')).toBeInTheDocument();
        expect(screen.getByText('member1')).toBeInTheDocument();
        expect(screen.getByText('member2')).toBeInTheDocument();

        // Нажимаем кнопку добавления участника
        const addMemberButton = screen.getByText('Add Member');
        fireEvent.click(addMemberButton);

        // Проверяем открытие модального окна поиска участников
        await waitFor(() => {
            expect(screen.getByText('Add Team Member')).toBeInTheDocument();
        });

        // Вводим поисковый запрос
        const searchInput = screen.getByPlaceholderText('Search by username or email');
        fireEvent.change(searchInput, { target: { value: 'new' } });

        // Ждем результатов поиска
        await waitFor(() => {
            expect(searchUsers).toHaveBeenCalledWith('new');
        });

        // Выбираем пользователя из результатов
        await waitFor(() => {
            expect(screen.getByText('newmember1')).toBeInTheDocument();
        });

        const userRow = screen.getByText('newmember1').closest('tr');
        const selectButton = within(userRow).getByRole('button', { name: 'Add' });
        fireEvent.click(selectButton);

        // Проверяем вызов addMember
        expect(addMember).toHaveBeenCalledWith('team1', {
            userId: 'user4',
            username: 'newmember1'
        });

        // Проверяем сообщение об успехе
        await waitFor(() => {
            expect(screen.getByText('Member added successfully')).toBeInTheDocument();
        });
    });

    test('removes a team member', async () => {
        const { removeMember } = require('../../../client/src/services/teamService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamManagement />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки команд
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Нажимаем на карточку команды
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Ждем загрузки деталей команды
        await waitFor(() => {
            expect(screen.getByText('Members (3)')).toBeInTheDocument();
        });

        // Находим участника для удаления (не владельца)
        const memberItem = screen.getByText('member1').closest('.member-item');
        const removeButton = within(memberItem).getByRole('button', { name: 'Remove' });

        // Нажимаем кнопку удаления
        fireEvent.click(removeButton);

        // Проверяем появление диалога подтверждения
        await waitFor(() => {
            expect(screen.getByText('Are you sure you want to remove this member?')).toBeInTheDocument();
        });

        // Подтверждаем удаление
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        fireEvent.click(confirmButton);

        // Проверяем вызов removeMember
        expect(removeMember).toHaveBeenCalledWith('team1', 'user2');

        // Проверяем сообщение об успехе
        await waitFor(() => {
            expect(screen.getByText('Member removed successfully')).toBeInTheDocument();
        });
    });

    test('deletes a team', async () => {
        const { deleteTeam } = require('../../../client/src/services/teamService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamManagement />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки команд
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Нажимаем кнопку удаления на первой команде
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        const deleteButton = within(teamCard).getByRole('button', { name: 'Delete' });
        fireEvent.click(deleteButton);

        // Проверяем появление диалога подтверждения
        await waitFor(() => {
            expect(screen.getByText('Are you sure you want to delete this team?')).toBeInTheDocument();
        });

        // Подтверждаем удаление
        const confirmButton = screen.getByRole('button', { name: 'Delete' });
        fireEvent.click(confirmButton);

        // Проверяем вызов deleteTeam
        expect(deleteTeam).toHaveBeenCalledWith('team1');

        // Проверяем сообщение об успехе
        await waitFor(() => {
            expect(screen.getByText('Team deleted successfully')).toBeInTheDocument();
        });
    });

    test('updates team information', async () => {
        const { updateTeam } = require('../../../client/src/services/teamService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamManagement />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки команд
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Нажимаем на карточку команды
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Ждем загрузки деталей команды
        await waitFor(() => {
            expect(screen.getByText('Team Details')).toBeInTheDocument();
        });

        // Нажимаем кнопку редактирования
        const editButton = screen.getByRole('button', { name: 'Edit Team' });
        fireEvent.click(editButton);

        // Проверяем появление формы редактирования
        await waitFor(() => {
            expect(screen.getByLabelText('Team Name')).toBeInTheDocument();
        });

        // Обновляем поля формы
        const nameInput = screen.getByLabelText('Team Name');
        const descriptionInput = screen.getByLabelText('Description');

        fireEvent.change(nameInput, { target: { value: 'Updated Dance Studio' } });
        fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });

        // Отправляем форму
        const saveButton = screen.getByRole('button', { name: 'Save Changes' });
        fireEvent.click(saveButton);

        // Проверяем вызов updateTeam с правильными данными
        expect(updateTeam).toHaveBeenCalledWith('team1', {
            name: 'Updated Dance Studio',
            description: 'Updated description'
        });

        // Проверяем сообщение об успехе
        await waitFor(() => {
            expect(screen.getByText('Team updated successfully')).toBeInTheDocument();
        });
    });

    test('navigates to team projects page', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamManagement />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки команд
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Нажимаем на карточку команды
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Ждем загрузки деталей команды
        await waitFor(() => {
            expect(screen.getByText('Projects (2)')).toBeInTheDocument();
        });

        // Нажимаем кнопку просмотра проектов
        const viewProjectsButton = screen.getByRole('button', { name: 'View All Projects' });
        fireEvent.click(viewProjectsButton);

        // Проверяем навигацию
        expect(mockNavigate).toHaveBeenCalledWith('/teams/team1/projects');
    });
}); 