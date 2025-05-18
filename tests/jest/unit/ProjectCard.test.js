import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import ProjectCard from '../../../client/src/components/ProjectCard';

// Мок для react-router-dom
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
}));

describe('ProjectCard Component', () => {
    // Тестовые данные
    const mockProject = {
        _id: 'project123',
        name: 'Test Project',
        description: 'This is a test project description',
        createdAt: '2023-05-15T10:00:00Z',
        updatedAt: '2023-05-16T12:00:00Z',
        tags: ['dance', 'test'],
        user: {
            _id: 'user123',
            username: 'testuser'
        },
        isPrivate: false
    };

    // Мок для функции удаления проекта
    const mockDeleteProject = jest.fn();

    // Мок для функции лайка проекта
    const mockLikeProject = jest.fn();

    // Базовый рендер компонента для каждого теста
    beforeEach(() => {
        render(
            <BrowserRouter>
                <ProjectCard
                    project={mockProject}
                    onDelete={mockDeleteProject}
                    onLike={mockLikeProject}
                    isOwner={true}
                />
            </BrowserRouter>
        );
    });

    // Сброс моков после каждого теста
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders project name and description', () => {
        // Проверяем, что имя проекта отображается
        expect(screen.getByText('Test Project')).toBeInTheDocument();

        // Проверяем, что описание проекта отображается
        expect(screen.getByText('This is a test project description')).toBeInTheDocument();
    });

    test('renders project tags', () => {
        // Проверяем, что теги проекта отображаются
        expect(screen.getByText('dance')).toBeInTheDocument();
        expect(screen.getByText('test')).toBeInTheDocument();
    });

    test('renders project creator information', () => {
        // Проверяем, что информация о создателе проекта отображается
        expect(screen.getByText('@testuser')).toBeInTheDocument();
    });

    test('renders edit and delete buttons when user is owner', () => {
        // Проверяем наличие кнопки редактирования
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();

        // Проверяем наличие кнопки удаления
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    test('calls delete function when delete button is clicked', () => {
        // Находим кнопку удаления
        const deleteButton = screen.getByRole('button', { name: /delete/i });

        // Имитируем клик по кнопке
        fireEvent.click(deleteButton);

        // Проверяем, что функция удаления была вызвана с правильным ID проекта
        expect(mockDeleteProject).toHaveBeenCalledWith('project123');
    });

    test('calls like function when like button is clicked', () => {
        // Находим кнопку лайка
        const likeButton = screen.getByRole('button', { name: /like/i });

        // Имитируем клик по кнопке
        fireEvent.click(likeButton);

        // Проверяем, что функция лайка была вызвана с правильным ID проекта
        expect(mockLikeProject).toHaveBeenCalledWith('project123');
    });

    test('does not render edit and delete buttons when user is not owner', () => {
        // Перерендерим компонент с isOwner = false
        render(
            <BrowserRouter>
                <ProjectCard
                    project={mockProject}
                    onDelete={mockDeleteProject}
                    onLike={mockLikeProject}
                    isOwner={false}
                />
            </BrowserRouter>
        );

        // Проверяем отсутствие кнопки редактирования
        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();

        // Проверяем отсутствие кнопки удаления
        expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    test('formats dates correctly', () => {
        // Проверяем, что даты отформатированы правильно
        // Формат зависит от реализации компонента, но обычно это что-то вроде "15 May 2023"
        expect(screen.getByText(/15 May 2023/i)).toBeInTheDocument();
    });
}); 