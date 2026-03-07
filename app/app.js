// Tutor App — AngularJS 1.8.2
var app = angular.module('tutorApp', ['ngRoute']);

app.config(function($routeProvider, $locationProvider) {
    $routeProvider
        .when('/landing', {
            templateUrl: 'pages/landing/landing.html',
            controller: 'LandingController'
        })
        .when('/login', {
            templateUrl: 'pages/login/login.html',
            controller: 'LoginController'
        })
        .when('/signup', {
            templateUrl: 'pages/signup/signup.html',
            controller: 'SignupController'
        })
        // Parent routes
        .when('/parent', {
            templateUrl: 'pages/dashboard-parent/dashboard-parent.html',
            controller: 'ParentDashboardController'
        })
        .when('/parent/child/:childId', {
            templateUrl: 'pages/trail/trail.html',
            controller: 'TrailController'
        })
        .when('/parent/child/:childId/folder/:folderId', {
            templateUrl: 'pages/trail/trail.html',
            controller: 'TrailController'
        })
        .when('/parent/edit-child/:childId', {
            templateUrl: 'pages/edit-child/edit-child.html',
            controller: 'EditChildController'
        })
        .when('/parent/add-child', {
            templateUrl: 'pages/add-child/add-child.html',
            controller: 'AddChildController'
        })
        .when('/capture', {
            templateUrl: 'pages/capture/capture.html',
            controller: 'CaptureController',
            reloadOnSearch: false
        })
        // Child routes
        .when('/child', {
            templateUrl: 'pages/dashboard-child/dashboard-child.html',
            controller: 'ChildDashboardController'
        })
        .when('/child/folder/:folderId', {
            templateUrl: 'pages/trail/trail.html',
            controller: 'TrailController'
        })
        // Quiz
        .when('/quiz/:quizId', {
            templateUrl: 'pages/quiz/quiz.html',
            controller: 'QuizController',
            reloadOnSearch: false
        })
        .otherwise({
            redirectTo: '/landing'
        });
});

app.run(function($rootScope, $location, AuthService) {
    $rootScope.CONFIG = CONFIG;
    
    // Check auth on route change
    $rootScope.$on('$routeChangeStart', function(event, next) {
        var publicRoutes = ['/landing', '/login', '/signup'];
        var path = next.$$route ? next.$$route.originalPath : '/landing';
        
        if (publicRoutes.indexOf(path) === -1 && !AuthService.isLoggedIn()) {
            event.preventDefault();
            $location.path('/login');
        }
    });
    
    // Auto-redirect if logged in and on landing
    if (AuthService.isLoggedIn()) {
        var role = AuthService.getRole();
        var currentPath = $location.path();
        if (currentPath === '' || currentPath === '/' || currentPath === '/landing') {
            $location.path(role === 'child' ? '/child' : '/parent');
        }
    }
});
