import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import TeamManagement from '../../../client/src/pages/TeamManagement';

// Mock services
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

// Mock user service for searching members
jest.mock('../../../client/src/services/userService', () => ({
    searchUsers: jest.fn().mockResolvedValue({
        data: [
            { _id: 'user4', username: 'newmember1', email: 'new1@example.com' },
            { _id: 'user5', username: 'newmember2', email: 'new2@example.com' }
        ]
    })
}));

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate
}));

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('TeamManagement Component', () => {
    let store;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create store with initial state
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

        // Check loading indicator displays initially
        expect(screen.getByTestId('teams-loading')).toBeInTheDocument();

        // Verify getTeams is called
        expect(getTeams).toHaveBeenCalled();

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText('My Teams')).toBeInTheDocument();
        });

        // Check team cards are displayed
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
            expect(screen.getByText('Dance Class')).toBeInTheDocument();
        });

        // Check team descriptions
        expect(screen.getByText('Professional dancers team')).toBeInTheDocument();
        expect(screen.getByText('Weekly dance class group')).toBeInTheDocument();

        // Check member counts
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

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText('My Teams')).toBeInTheDocument();
        });

        // Click create team button
        const createButton = screen.getByText('Create Team');
        fireEvent.click(createButton);

        // Check modal appears
        await waitFor(() => {
            expect(screen.getByText('Create New Team')).toBeInTheDocument();
        });

        // Fill out form
        const nameInput = screen.getByLabelText('Team Name');
        const descriptionInput = screen.getByLabelText('Description');

        fireEvent.change(nameInput, { target: { value: 'New Dance Crew' } });
        fireEvent.change(descriptionInput, { target: { value: 'A fresh new dance team' } });

        // Submit form
        const submitButton = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(submitButton);

        // Verify createTeam was called with correct data
        expect(createTeam).toHaveBeenCalledWith({
            name: 'New Dance Crew',
            description: 'A fresh new dance team'
        });

        // Check success message appears
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

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Click on team card to view details
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Check team details view shows up
        await waitFor(() => {
            expect(screen.getByText('Team Details')).toBeInTheDocument();
            expect(screen.getByText('Members (3)')).toBeInTheDocument();
        });

        // Check members list
        expect(screen.getByText('testuser (owner)')).toBeInTheDocument();
        expect(screen.getByText('member1')).toBeInTheDocument();
        expect(screen.getByText('member2')).toBeInTheDocument();

        // Click add member button
        const addMemberButton = screen.getByText('Add Member');
        fireEvent.click(addMemberButton);

        // Check member search modal opens
        await waitFor(() => {
            expect(screen.getByText('Add Team Member')).toBeInTheDocument();
        });

        // Enter search term
        const searchInput = screen.getByPlaceholderText('Search by username or email');
        fireEvent.change(searchInput, { target: { value: 'new' } });

        // Wait for search results
        await waitFor(() => {
            expect(searchUsers).toHaveBeenCalledWith('new');
        });

        // Select a user from results
        await waitFor(() => {
            expect(screen.getByText('newmember1')).toBeInTheDocument();
        });

        const userRow = screen.getByText('newmember1').closest('tr');
        const selectButton = within(userRow).getByRole('button', { name: 'Add' });
        fireEvent.click(selectButton);

        // Verify addMember was called
        expect(addMember).toHaveBeenCalledWith('team1', {
            userId: 'user4',
            username: 'newmember1'
        });

        // Check success message
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

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Click on team card
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Wait for team details to load
        await waitFor(() => {
            expect(screen.getByText('Members (3)')).toBeInTheDocument();
        });

        // Find a member to remove (not the owner)
        const memberItem = screen.getByText('member1').closest('.member-item');
        const removeButton = within(memberItem).getByRole('button', { name: 'Remove' });

        // Click remove button
        fireEvent.click(removeButton);

        // Check confirmation dialog appears
        await waitFor(() => {
            expect(screen.getByText('Are you sure you want to remove this member?')).toBeInTheDocument();
        });

        // Confirm removal
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        fireEvent.click(confirmButton);

        // Verify removeMember was called
        expect(removeMember).toHaveBeenCalledWith('team1', 'user2');

        // Check success message
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

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Click delete button on first team
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        const deleteButton = within(teamCard).getByRole('button', { name: 'Delete' });
        fireEvent.click(deleteButton);

        // Check confirmation dialog appears
        await waitFor(() => {
            expect(screen.getByText('Are you sure you want to delete this team?')).toBeInTheDocument();
        });

        // Confirm deletion
        const confirmButton = screen.getByRole('button', { name: 'Delete' });
        fireEvent.click(confirmButton);

        // Verify deleteTeam was called
        expect(deleteTeam).toHaveBeenCalledWith('team1');

        // Check success message
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

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Click on team card
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Wait for team details to load
        await waitFor(() => {
            expect(screen.getByText('Team Details')).toBeInTheDocument();
        });

        // Click edit button
        const editButton = screen.getByRole('button', { name: 'Edit Team' });
        fireEvent.click(editButton);

        // Check edit form appears
        await waitFor(() => {
            expect(screen.getByLabelText('Team Name')).toBeInTheDocument();
        });

        // Update form fields
        const nameInput = screen.getByLabelText('Team Name');
        const descriptionInput = screen.getByLabelText('Description');

        fireEvent.change(nameInput, { target: { value: 'Updated Dance Studio' } });
        fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });

        // Submit form
        const saveButton = screen.getByRole('button', { name: 'Save Changes' });
        fireEvent.click(saveButton);

        // Verify updateTeam was called with correct data
        expect(updateTeam).toHaveBeenCalledWith('team1', {
            name: 'Updated Dance Studio',
            description: 'Updated description'
        });

        // Check success message
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

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText('Dance Studio Team')).toBeInTheDocument();
        });

        // Click on team card
        const teamCard = screen.getByText('Dance Studio Team').closest('.team-card');
        fireEvent.click(teamCard);

        // Wait for team details to load
        await waitFor(() => {
            expect(screen.getByText('Projects (2)')).toBeInTheDocument();
        });

        // Click view projects button
        const viewProjectsButton = screen.getByRole('button', { name: 'View All Projects' });
        fireEvent.click(viewProjectsButton);

        // Verify navigation
        expect(mockNavigate).toHaveBeenCalledWith('/teams/team1/projects');
    });
}); 