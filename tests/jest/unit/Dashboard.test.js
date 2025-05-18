import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Dashboard from '../../../client/src/components/Dashboard';

// Мокаем модули, от которых зависит компонент
jest.mock('axios');
jest.mock('../../../client/src/services/projectService', () => ({
    getProjects: jest.fn().mockResolvedValue({
        data: [
            {
                _id: 'project1',
                name: 'Salsa Project',
                description: 'Learning basic salsa moves',
                createdAt: '2023-05-15T10:00:00Z',
                tags: ['salsa', 'beginner'],
                isPrivate: false,
                user: {
                    _id: 'user1',
                    username: 'testuser'
                },
            },
            {
                _id: 'project2',
                name: 'Advanced Bachata',
                description: 'Advanced bachata techniques',
                createdAt: '2023-06-20T10:00:00Z',
                tags: ['bachata', 'advanced'],
                isPrivate: true,
                user: {
                    _id: 'user1',
                    username: 'testuser'
                },
            }
        ]
    }),
    deleteProject: jest.fn().mockResolvedValue({ data: { message: 'Project deleted successfully' } }),
}));

// Мокаем react-router-dom
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    useParams: () => ({ id: 'user1' }),
}));

// Настраиваем мок Redux store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Dashboard Component', () => {
    let store;

    beforeEach(() => {
        // Начальное состояние store для тестов
        store = mockStore({
            auth: {
                isAuthenticated: true,
                user: {
                    _id: 'user1',
                    username: 'testuser',
                    email: 'test@example.com'
                },
                token: 'test.jwt.token',
                isLoading: false,
                error: null
            },
            projects: {
                projects: [],
                currentProject: null,
                isLoading: false,
                error: null
            }
        });

        // Сбрасываем моки
        jest.clearAllMocks();
    });

    test('renders dashboard with project list', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Dashboard />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем, что загрузчик проектов отображается
        expect(screen.getByTestId('projects-loading')).toBeInTheDocument();

        // Ждем, пока проекты загрузятся
        await waitFor(() => {
            expect(screen.getByText('My Dance Projects')).toBeInTheDocument();
        });

        // Проверяем, что проекты отображаются
        await waitFor(() => {
            expect(screen.getByText('Salsa Project')).toBeInTheDocument();
            expect(screen.getByText('Advanced Bachata')).toBeInTheDocument();
        });
    });

    test('filters projects by search term', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Dashboard />
                </BrowserRouter>
            </Provider>
        );

        // Ждем, пока проекты загрузятся
        await waitFor(() => {
            expect(screen.getByText('My Dance Projects')).toBeInTheDocument();
        });

        // Находим поле поиска
        const searchInput = screen.getByPlaceholderText('Search projects...');
        expect(searchInput).toBeInTheDocument();

        // Вводим поисковый запрос
        fireEvent.change(searchInput, { target: { value: 'salsa' } });

        // Проверяем, что только проекты с сальсой отображаются
        await waitFor(() => {
            expect(screen.getByText('Salsa Project')).toBeInTheDocument();
            expect(screen.queryByText('Advanced Bachata')).not.toBeInTheDocument();
        });
    });

    test('opens create project modal', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Dashboard />
                </BrowserRouter>
            </Provider>
        );

        // Ждем, пока основной контент загрузится
        await waitFor(() => {
            expect(screen.getByText('My Dance Projects')).toBeInTheDocument();
        });

        // Находим кнопку создания проекта
        const createButton = screen.getByText('Create Project');
        expect(createButton).toBeInTheDocument();

        // Нажимаем на кнопку создания проекта
        fireEvent.click(createButton);

        // Проверяем, что модальное окно отображается
        await waitFor(() => {
            expect(screen.getByText('Create New Project')).toBeInTheDocument();
            expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Description')).toBeInTheDocument();
        });
    });

    test('deletes a project', async () => {
        const { getProjectsMock, deleteProjectMock } = require('../../../client/src/services/projectService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Dashboard />
                </BrowserRouter>
            </Provider>
        );

        // Ждем, пока проекты загрузятся
        await waitFor(() => {
            expect(screen.getByText('Salsa Project')).toBeInTheDocument();
        });

        // Находим кнопку удаления у первого проекта и нажимаем на неё
        const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
        fireEvent.click(deleteButtons[0]);

        // Проверяем, что появляется окно подтверждения
        await waitFor(() => {
            expect(screen.getByText('Are you sure you want to delete this project?')).toBeInTheDocument();
        });

        // Подтверждаем удаление
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        fireEvent.click(confirmButton);

        // Проверяем, что вызвана функция удаления проекта
        await waitFor(() => {
            expect(deleteProjectMock).toHaveBeenCalledWith('project1');
        });

        // После удаления должно появиться уведомление об успешном удалении
        await waitFor(() => {
            expect(screen.getByText('Project deleted successfully')).toBeInTheDocument();
        });
    });

    test('navigates to project details when clicking on a project', async () => {
        const navigate = jest.fn();
        jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Dashboard />
                </BrowserRouter>
            </Provider>
        );

        // Ждем, пока проекты загрузятся
        await waitFor(() => {
            expect(screen.getByText('Salsa Project')).toBeInTheDocument();
        });

        // Находим карточку проекта и кликаем по ней
        const projectCard = screen.getByText('Salsa Project').closest('.project-card');
        fireEvent.click(projectCard);

        // Проверяем, что произошел переход на страницу проекта
        expect(navigate).toHaveBeenCalledWith('/projects/project1');
    });

    test('shows empty state when no projects', async () => {
        // Мокаем пустой список проектов
        require('../../../client/src/services/projectService').getProjects.mockResolvedValueOnce({
            data: []
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Dashboard />
                </BrowserRouter>
            </Provider>
        );

        // Ждем, пока контент загрузится
        await waitFor(() => {
            expect(screen.getByText('My Dance Projects')).toBeInTheDocument();
        });

        // Проверяем, что отображается сообщение об отсутствии проектов
        await waitFor(() => {
            expect(screen.getByText('You don\'t have any projects yet')).toBeInTheDocument();
            expect(screen.getByText('Create your first dance project to get started!')).toBeInTheDocument();
        });
    });

    test('shows error state when project loading fails', async () => {
        // Мокаем ошибку при загрузке проектов
        require('../../../client/src/services/projectService').getProjects.mockRejectedValueOnce({
            response: {
                data: { error: 'Failed to load projects' }
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Dashboard />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем, что отображается сообщение об ошибке
        await waitFor(() => {
            expect(screen.getByText('Error loading projects')).toBeInTheDocument();
            expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
        });
    });
}); 