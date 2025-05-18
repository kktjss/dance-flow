import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Login from '../../../client/src/pages/Auth/Login';

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate
}));

// Mock auth service
jest.mock('../../../client/src/services/authService', () => ({
    login: jest.fn()
}));

// Mock Redux actions
jest.mock('../../../client/src/actions/authActions', () => ({
    login: jest.fn().mockImplementation((credentials) => {
        return (dispatch) => {
            // Simulate successful login with valid credentials
            if (credentials.email === 'test@example.com' && credentials.password === 'password123') {
                dispatch({ type: 'LOGIN_SUCCESS', payload: { token: 'test.token', user: { _id: 'user1', username: 'testuser' } } });
                return Promise.resolve();
            }
            // Simulate failed login
            dispatch({ type: 'LOGIN_FAIL', payload: { error: 'Invalid credentials' } });
            return Promise.reject({ response: { data: { error: 'Invalid credentials' } } });
        };
    }),
    logout: jest.fn()
}));

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Login Component', () => {
    let store;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create store with initial state
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
                error: null
            }
        });
    });

    test('renders login form', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Check for main elements
        expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
        expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
    });

    test('validates form input', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Try to submit without filling out form
        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Check for validation errors
        await waitFor(() => {
            expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
            expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
        });

        // Fill in with invalid email
        const emailInput = screen.getByLabelText(/Email/i);
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
        fireEvent.click(submitButton);

        // Check for email validation error
        await waitFor(() => {
            expect(screen.getByText(/Please enter a valid email/i)).toBeInTheDocument();
        });
    });

    test('handles successful login', async () => {
        const { login } = require('../../../client/src/actions/authActions');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Fill out form with valid credentials
        const emailInput = screen.getByLabelText(/Email/i);
        const passwordInput = screen.getByLabelText(/Password/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        // Submit form
        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Check login action was called with correct credentials
        expect(login).toHaveBeenCalledWith({
            email: 'test@example.com',
            password: 'password123'
        });

        // Wait for navigation to occur after successful login
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/auth-home');
        });
    });

    test('handles failed login', async () => {
        // Setup store with error state
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
                error: 'Invalid credentials'
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Fill out form with invalid credentials
        const emailInput = screen.getByLabelText(/Email/i);
        const passwordInput = screen.getByLabelText(/Password/i);

        fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

        // Submit form
        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Check for error message
        await waitFor(() => {
            expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
        });

        // Verify we did not navigate
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('navigates to registration page', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Click on register link
        const registerLink = screen.getByText(/Sign up/i);
        fireEvent.click(registerLink);

        // Check navigation
        expect(mockNavigate).toHaveBeenCalledWith('/register');
    });

    test('shows loading state during authentication', async () => {
        // Mock login as pending
        const { login } = require('../../../client/src/actions/authActions');
        login.mockImplementationOnce(() => {
            return (dispatch) => {
                dispatch({ type: 'LOGIN_REQUEST' });
                return new Promise(resolve => {
                    // Simulate delay
                    setTimeout(() => {
                        dispatch({ type: 'LOGIN_SUCCESS', payload: { token: 'test.token', user: { _id: 'user1' } } });
                        resolve();
                    }, 100);
                });
            };
        });

        // Setup store with loading state
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: true,
                error: null
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Fill and submit form
        const emailInput = screen.getByLabelText(/Email/i);
        const passwordInput = screen.getByLabelText(/Password/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Check for loading indicator
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
    });
}); 