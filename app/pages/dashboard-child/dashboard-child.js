app.controller('ChildDashboardController', function($scope, $location, AuthService, ApiService) {
    var COLORS = ['#FF9600', '#00B894', '#FD79A8', '#FDCB6E', '#74B9FF', '#FF6B6B', '#FFB84D', '#00CEC9'];
    
    var childId = AuthService.getUser();
    
    $scope.childName = '';
    $scope.firstName = '';
    $scope.avatarUrl = null;
    $scope.avatarColor = COLORS[0];
    $scope.subjects = [];
    $scope.loading = true;
    $scope.playerXP = 0;
    $scope.dailyStreak = 0;
    
    // Magical icon mapping
    $scope.magicIcons = [
        {name: 'book', ext: 'png'}, {name: 'portal', ext: 'png'},
        {name: 'crystal', ext: 'jpg'}, {name: 'potion', ext: 'jpg'},
        {name: 'cauldron', ext: 'jpg'}, {name: 'wand', ext: 'jpg'},
        {name: 'hourglass', ext: 'jpg'}, {name: 'scroll', ext: 'jpg'}
    ];
    
    // Mascot phrases
    var PHRASES = [
        'Continue assim, {name}! Você está indo muito bem!',
        'A magia do conhecimento é infinita!',
        'Cada lição te deixa mais poderoso!',
        'Você é um verdadeiro aprendiz!',
        'O saber é a maior magia!'
    ];
    $scope.mascotPhrase = '';
    
    function pickPhrase(name) {
        var p = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        return p.replace('{name}', name);
    }
    
    function init() {
        ApiService.getPlayer(childId).then(function(res) {
            var player = res.data || {};
            $scope.childName = player.name || childId.split('@')[0];
            $scope.firstName = $scope.childName.split(' ')[0];
            if (player.image && player.image.small && player.image.small.url) {
                $scope.avatarUrl = player.image.small.url;
            }
            $scope.mascotPhrase = pickPhrase($scope.firstName);
            
            // Try to get XP from player points
            if (player.points) {
                for (var i = 0; i < player.points.length; i++) {
                    if (player.points[i].category === 'experience' || player.points[i].total) {
                        $scope.playerXP = player.points[i].total || 0;
                        break;
                    }
                }
            }
            
            var rootFolder = (player.extra && player.extra.root_folder) || childId;
            loadSubjects(rootFolder);
        }).catch(function() {
            $scope.firstName = childId.split('@')[0];
            $scope.mascotPhrase = pickPhrase($scope.firstName);
            loadSubjects(childId);
        });
    }
    
    function loadSubjects(rootFolder) {
        ApiService.getFolderProgress(rootFolder, childId).then(function(res) {
            var data = res.data || {};
            var items = data.items || [];
            $scope.subjects = items.filter(function(i) { return i.folder !== false; });
            $scope.loading = false;
            $scope.$applyAsync();
        }).catch(function() {
            ApiService.getFolderInside(rootFolder).then(function(res) {
                var data = res.data || {};
                $scope.subjects = (data.items || []).filter(function(i) { return i.folder !== false; });
                $scope.loading = false;
                $scope.$applyAsync();
            }).catch(function() {
                $scope.loading = false;
                $scope.$applyAsync();
            });
        });
    }
    
    $scope.openSubject = function(subj) {
        if (subj.is_unlocked === false) return;
        $location.path('/child/folder/' + encodeURIComponent(subj._id));
    };
    
    $scope.logout = function() {
        AuthService.logout();
        $location.path('/landing');
    };
    
    init();
});
