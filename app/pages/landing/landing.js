app.controller('LandingController', function($scope, $location) {
    $scope.mobileMenu = false;

    $scope.goSignup = function() {
        $location.path('/signup');
    };
    $scope.goLogin = function() {
        $location.path('/login');
    };
    $scope.scrollTo = function(id) {
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };
});
