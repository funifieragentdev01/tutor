app.controller('LoginController', function($scope, $location, $rootScope, $timeout, AuthService, ApiService) {
    $scope.email = '';
    $scope.password = '';
    $scope.error = '';
    $scope.loading = false;
    $scope.showConfetti = false;
    // Check if coming from landing "Jogar Agora" button
    var typeParam = $location.search().type;
    $scope.userType = (typeParam === 'aluno') ? 'child' : null;
    
    $scope.selectUserType = function(type) {
        $scope.userType = type;
        $scope.error = '';
    };

    // Orange confetti effect
    function launchConfetti() {
        $scope.showConfetti = true;
        $scope.$applyAsync();
        var canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        var pieces = [];
        var colors = ['#FF9600', '#FFB84D', '#E08600', '#FFC266', '#FF8200'];
        for (var i = 0; i < 80; i++) {
            pieces.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                size: 6 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedY: 2 + Math.random() * 4,
                speedX: (Math.random() - 0.5) * 3,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 8,
                opacity: 1
            });
        }
        var frame = 0;
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            var alive = false;
            pieces.forEach(function(p) {
                if (p.opacity <= 0) return;
                alive = true;
                p.y += p.speedY;
                p.x += p.speedX;
                p.rotation += p.rotSpeed;
                if (frame > 40) p.opacity -= 0.015;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });
            frame++;
            if (alive && frame < 120) {
                requestAnimationFrame(draw);
            } else {
                $scope.showConfetti = false;
                $scope.$applyAsync();
            }
        }
        requestAnimationFrame(draw);
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
                    // Confetti for child login, then navigate
                    launchConfetti();
                    $timeout(function() {
                        $location.path('/child');
                    }, 1500);
                } else {
                    $location.path('/parent');
                }
            }).catch(function() {
                AuthService.setAuth(token, $scope.email, selectedType);
                if (selectedType === 'child') {
                    launchConfetti();
                    $timeout(function() {
                        $location.path('/child');
                    }, 1500);
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
