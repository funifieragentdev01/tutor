app.controller('LoginController', function($scope, $location, $rootScope, $timeout, AuthService, ApiService) {
    $scope.email = '';
    $scope.password = '';
    $scope.error = '';
    $scope.loading = false;
    // Check if coming from landing "Jogar Agora" button
    var typeParam = $location.search().type;
    $scope.userType = (typeParam === 'aluno') ? 'child' : null;
    $scope.magicMode = false;

    $scope.toggleMagic = function() {
        $scope.magicMode = !$scope.magicMode;
        if ($scope.magicMode) {
            // Confetti burst
            if (window.confetti) {
                confetti({
                    particleCount: 40,
                    angle: 90,
                    spread: 70,
                    origin: { y: 0.6 },
                    shapes: ['square'],
                    scalar: 2.5,
                    colors: ['#ff9800', '#ffc107']
                });
            }
            // Magic sound
            try {
                var audio = new Audio('audio/magic-sound.mp3');
                audio.play();
            } catch(e) {}
        }
    };
    
    $scope.selectUserType = function(type) {
        $scope.userType = type;
        $scope.error = '';
    };

    // Orange confetti using canvas-confetti library
    function launchConfetti() {
        if (window.confetti) {
            // Burst 1
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#FF9600', '#FFB84D', '#E08600', '#FFC266', '#FF8200'] });
            // Burst 2 (delayed)
            setTimeout(function() {
                confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 }, colors: ['#FF9600', '#FFB84D', '#E08600', '#FFC266', '#FF8200'] });
            }, 300);
        }
    }
    
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
            
            var selectedType = $scope.userType || 'parent';
            AuthService.setAuth(token, $scope.email, selectedType);
            
            ApiService.getPlayer($scope.email).then(function(playerRes) {
                var player = playerRes.data;
                var role = (player && player.extra && player.extra.role) || selectedType;
                AuthService.setAuth(token, $scope.email, role);
                $rootScope.player = player;
                
                if (role === 'child') {
                    launchConfetti();
                    $timeout(function() { $location.path('/child'); }, 1800);
                } else {
                    $location.path('/parent');
                }
            }).catch(function() {
                AuthService.setAuth(token, $scope.email, selectedType);
                if (selectedType === 'child') {
                    launchConfetti();
                    $timeout(function() { $location.path('/child'); }, 1800);
                } else {
                    $location.path('/parent');
                }
            });
            
        }).catch(function(err) {
            $scope.error = 'E-mail ou senha incorretos.';
            $scope.loading = false;
        });
    };
    
    $scope.goSignup = function() { $location.path('/signup'); };
    $scope.goLanding = function() { $location.path('/landing'); };
});
