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
        .when('/parent', {
            templateUrl: 'pages/dashboard-parent/dashboard-parent.html',
            controller: 'ParentDashboardController'
        })
        .when('/child', {
            templateUrl: 'pages/dashboard-child/dashboard-child.html',
            controller: 'ChildDashboardController'
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
    
    // Auto-login if token exists
    if (AuthService.isLoggedIn()) {
        var user = AuthService.getUser();
        var role = AuthService.getRole();
        // Route based on role
        if (role === 'parent') {
            $location.path('/parent');
        } else {
            $location.path('/child');
        }
    }
});
