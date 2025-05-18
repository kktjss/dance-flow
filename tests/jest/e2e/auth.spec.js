// Тест процесса аутентификации
describe('Authentication Flow', () => {
    beforeEach(() => {
        // Перед каждым тестом очищаем localStorage и куки
        cy.clearLocalStorage();
        cy.clearCookies();

        // Перед каждым тестом перезагружаем начальную страницу
        cy.visit('/');
    });

    it('should navigate to login page', () => {
        // Проверяем, что мы начинаем с домашней страницы
        cy.url().should('include', '/');

        // Находим и кликаем по кнопке входа в навигационной панели
        cy.get('[data-testid=nav-login-button]').click();

        // Проверяем, что мы перешли на страницу входа
        cy.url().should('include', '/login');

        // Проверяем, что форма входа отображается
        cy.get('[data-testid=login-form]').should('be.visible');
    });

    it('should display validation errors when submitting empty form', () => {
        // Переходим на страницу входа
        cy.visit('/login');

        // Находим и нажимаем на кнопку входа без ввода данных
        cy.get('[data-testid=login-button]').click();

        // Проверяем, что отображаются сообщения об ошибках
        cy.get('[data-testid=username-error]').should('be.visible');
        cy.get('[data-testid=password-error]').should('be.visible');
    });

    it('should login with valid credentials', () => {
        // Мокаем API запрос на вход
        cy.intercept('POST', '/api/auth/login', {
            statusCode: 200,
            body: {
                token: 'test.jwt.token',
                user: {
                    _id: 'user123',
                    username: 'testuser',
                    email: 'test@example.com'
                }
            }
        }).as('loginRequest');

        // Переходим на страницу входа
        cy.visit('/login');

        // Вводим данные для входа
        cy.get('[data-testid=username-input]').type('testuser');
        cy.get('[data-testid=password-input]').type('password123');

        // Отправляем форму
        cy.get('[data-testid=login-button]').click();

        // Ждем завершения запроса
        cy.wait('@loginRequest');

        // Проверяем, что мы были перенаправлены на панель управления
        cy.url().should('include', '/dashboard');

        // Проверяем, что имя пользователя отображается в навигационной панели
        cy.get('[data-testid=user-menu]').should('contain', 'testuser');
    });

    it('should display error message with invalid credentials', () => {
        // Мокаем API запрос на вход с ошибкой
        cy.intercept('POST', '/api/auth/login', {
            statusCode: 401,
            body: {
                error: 'Invalid username or password'
            }
        }).as('failedLoginRequest');

        // Переходим на страницу входа
        cy.visit('/login');

        // Вводим неверные данные для входа
        cy.get('[data-testid=username-input]').type('testuser');
        cy.get('[data-testid=password-input]').type('wrongpassword');

        // Отправляем форму
        cy.get('[data-testid=login-button]').click();

        // Ждем завершения запроса
        cy.wait('@failedLoginRequest');

        // Проверяем, что мы остались на странице входа
        cy.url().should('include', '/login');

        // Проверяем, что сообщение об ошибке отображается
        cy.get('[data-testid=login-error]').should('be.visible');
        cy.get('[data-testid=login-error]').should('contain', 'Invalid username or password');
    });

    it('should navigate to registration page', () => {
        // Переходим на страницу входа
        cy.visit('/login');

        // Находим и кликаем по ссылке "Sign up"
        cy.get('[data-testid=signup-link]').click();

        // Проверяем, что мы перешли на страницу регистрации
        cy.url().should('include', '/register');

        // Проверяем, что форма регистрации отображается
        cy.get('[data-testid=register-form]').should('be.visible');
    });

    it('should register a new user', () => {
        // Мокаем API запрос на регистрацию
        cy.intercept('POST', '/api/auth/register', {
            statusCode: 201,
            body: {
                token: 'test.jwt.token',
                user: {
                    _id: 'newuser123',
                    username: 'newuser',
                    email: 'newuser@example.com'
                }
            }
        }).as('registerRequest');

        // Переходим на страницу регистрации
        cy.visit('/register');

        // Вводим данные для регистрации
        cy.get('[data-testid=username-input]').type('newuser');
        cy.get('[data-testid=email-input]').type('newuser@example.com');
        cy.get('[data-testid=password-input]').type('password123');
        cy.get('[data-testid=confirm-password-input]').type('password123');

        // Отправляем форму
        cy.get('[data-testid=register-button]').click();

        // Ждем завершения запроса
        cy.wait('@registerRequest');

        // Проверяем, что мы были перенаправлены на панель управления
        cy.url().should('include', '/dashboard');

        // Проверяем, что имя пользователя отображается в навигационной панели
        cy.get('[data-testid=user-menu]').should('contain', 'newuser');
    });

    it('should logout successfully', () => {
        // Мокаем API запрос на вход
        cy.intercept('POST', '/api/auth/login', {
            statusCode: 200,
            body: {
                token: 'test.jwt.token',
                user: {
                    _id: 'user123',
                    username: 'testuser',
                    email: 'test@example.com'
                }
            }
        });

        // Имитируем вход пользователя (устанавливаем токен и сохраняем в localStorage)
        cy.visit('/login');
        cy.get('[data-testid=username-input]').type('testuser');
        cy.get('[data-testid=password-input]').type('password123');
        cy.get('[data-testid=login-button]').click();

        // Убеждаемся, что перешли в личный кабинет
        cy.url().should('include', '/dashboard');

        // Находим и кликаем по кнопке выхода в выпадающем меню пользователя
        cy.get('[data-testid=user-menu]').click();
        cy.get('[data-testid=logout-button]').click();

        // Проверяем, что мы вернулись на домашнюю страницу
        cy.url().should('eq', Cypress.config().baseUrl + '/');

        // Проверяем, что кнопка входа снова отображается
        cy.get('[data-testid=nav-login-button]').should('be.visible');

        // Проверяем, что localStorage не содержит токен
        cy.window().then((win) => {
            expect(win.localStorage.getItem('token')).to.be.null;
        });
    });

    it('should automatically redirect to login when accessing protected routes', () => {
        // Пытаемся получить доступ к защищенному маршруту без аутентификации
        cy.visit('/dashboard');

        // Проверяем, что нас перенаправили на страницу входа
        cy.url().should('include', '/login');

        // Проверяем, что отображается сообщение о необходимости войти
        cy.get('[data-testid=auth-required-message]').should('be.visible');
    });
}); 