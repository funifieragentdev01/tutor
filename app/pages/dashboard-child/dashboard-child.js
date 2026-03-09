app.controller('ChildDashboardController', function($scope, $location, AuthService, ApiService) {
    var COLORS = ['#FF9600', '#00B894', '#FD79A8', '#FDCB6E', '#74B9FF', '#FF6B6B', '#FFB84D', '#00CEC9'];
    var SUBJECT_ICONS = {
        'matemática': '📐', 'português': '📖', 'inglês': '🇬🇧',
        'história': '🏛️', 'geografia': '🌍', 'ciências': '🔬',
        'arte': '🎨', 'música': '🎵', 'biologia': '🧬',
        'física': '⚡', 'química': '🧪', 'filosofia': '💭'
    };
    
    var childId = AuthService.getUser();
    
    $scope.childName = '';
    $scope.avatarUrl = null;
    $scope.avatarColor = COLORS[0];
    $scope.subjects = [];
    $scope.loading = true;
    
    function init() {
        // Get child player data + root_folder
        ApiService.getPlayer(childId).then(function(res) {
            var player = res.data || {};
            $scope.childName = player.name || childId.split('@')[0];
            if (player.image && player.image.small && player.image.small.url) {
                $scope.avatarUrl = player.image.small.url;
            }
            
            var rootFolder = (player.extra && player.extra.root_folder) || childId;
            loadSubjects(rootFolder);
        }).catch(function() {
            // Fallback: try with childId
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
            // Fallback to inside
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
    
    $scope.getColor = function(idx) {
        return COLORS[idx % COLORS.length];
    };
    
    $scope.getIcon = function(subj) {
        var key = (subj.title || '').toLowerCase();
        return SUBJECT_ICONS[key] || '📘';
    };
    
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
