app.controller('SignupController', function($scope, $location, AuthService) {
    $scope.name = '';
    $scope.email = '';
    $scope.password = '';
    $scope.confirmPassword = '';
    $scope.error = '';
    $scope.success = '';
    $scope.loading = false;
    
    $scope.signup = function() {
        $scope.error = '';
        $scope.success = '';
        
        if (!$scope.name || !$scope.email || !$scope.password) {
            $scope.error = 'Preencha todos os campos.';
            return;
        }
        if ($scope.password.length < 6) {
            $scope.error = 'A senha deve ter pelo menos 6 caracteres.';
            return;
        }
        if ($scope.password !== $scope.confirmPassword) {
            $scope.error = 'As senhas não conferem.';
            return;
        }
        
        $scope.loading = true;
        
        AuthService.signup({
            _id: $scope.email,
            name: $scope.name,
            email: $scope.email,
            password: $scope.password,
            role: 'parent'
        }).then(function(res) {
            // Auto-login after signup
            AuthService.login($scope.email, $scope.password).then(function(loginRes) {
                var token = loginRes.data.access_token;
                if (token) {
                    AuthService.setAuth(token, $scope.email, 'parent');
                    $location.path('/parent');
                } else {
                    $scope.success = 'Conta criada! Faça login.';
                    $scope.loading = false;
                }
            }).catch(function() {
                $scope.success = 'Conta criada! Faça login.';
                $scope.loading = false;
            });
        }).catch(function(err) {
            var msg = err.data && err.data.errorMessage ? err.data.errorMessage : 'Erro ao criar conta.';
            $scope.error = msg;
            $scope.loading = false;
        });
    };
    
    $scope.goLogin = function() { $location.path('/login'); };
    $scope.goLanding = function() { $location.path('/landing'); };
});
