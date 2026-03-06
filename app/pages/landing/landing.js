app.controller('LandingController', function($scope, $location) {
    $scope.goSignup = function() {
        $location.path('/signup');
    };
    $scope.goLogin = function() {
        $location.path('/login');
    };
});
