app.controller('LoginController', function($scope, $location, $rootScope, AuthService, ApiService) {
    $scope.email = '';
    $scope.password = '';
    $scope.error = '';
    $scope.loading = false;
    $scope.userType = null; // null, 'parent', or 'child'
    
    $scope.selectUserType = function(type) {
        $scope.userType = type;
        $scope.error = '';
    };
    
    $scope.login = function() {
        if (!$scope.email || !$scope.password) {
            $scope.error = 'Preencha e-mail e senha.';
            return;
        }
        
        $scope.loading = true;
        $scope.error = '';
        
        AuthService.login($scope.email, $scope.password).then(function(res) {
            var token = res.data.access_token;
            if (!token) {
                $scope.error = 'E-mail ou senha incorretos.';
                $scope.loading = false;
                return;
            }
            
            // Get player data to determine role
            AuthService.setAuth(token, $scope.email, 'parent');
            
            ApiService.getPlayer($scope.email).then(function(playerRes) {
                var player = playerRes.data;
                var role = (player && player.extra && player.extra.role) || 'parent';
                AuthService.setAuth(token, $scope.email, role);
                $rootScope.player = player;
                
                if (role === 'child') {
                    $location.path('/child');
                } else {
                    $location.path('/parent');
                }
            }).catch(function() {
                // Default to parent if can't get player
                $location.path('/parent');
            });
            
        }).catch(function(err) {
            $scope.error = 'E-mail ou senha incorretos.';
            $scope.loading = false;
        });
    };
    
    $scope.goSignup = function() { $location.path('/signup'); };
    $scope.goLanding = function() { $location.path('/landing'); };
});
