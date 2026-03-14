app.controller('LoginController', function($scope, $location, $rootScope, AuthService, ApiService) {
    $scope.email = '';
    $scope.password = '';
    $scope.error = '';
    $scope.loading = false;
    // Check if coming from landing "Jogar Agora" button
    var typeParam = $location.search().type;
    $scope.userType = (typeParam === 'aluno') ? 'child' : null; // null, 'parent', or 'child'
    
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
            var selectedType = $scope.userType || 'parent';
            AuthService.setAuth(token, $scope.email, selectedType);
            
            ApiService.getPlayer($scope.email).then(function(playerRes) {
                var player = playerRes.data;
                var role = (player && player.extra && player.extra.role) || selectedType;
                AuthService.setAuth(token, $scope.email, role);
                $rootScope.player = player;
                
                if (role === 'child') {
                    $location.path('/child');
                } else {
                    $location.path('/parent');
                }
            }).catch(function() {
                // Fallback: use the selected userType from login screen
                AuthService.setAuth(token, $scope.email, selectedType);
                $location.path(selectedType === 'child' ? '/child' : '/parent');
            });
            
        }).catch(function(err) {
            $scope.error = 'E-mail ou senha incorretos.';
            $scope.loading = false;
        });
    };
    
    $scope.goSignup = function() { $location.path('/signup'); };
    $scope.goLanding = function() { $location.path('/landing'); };
});
