app.controller('ParentDashboardController', function($scope, $location, $rootScope, AuthService, ApiService) {
    var CHILDREN_KEY = 'tutor_children';
    var COLORS = ['#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E', '#74B9FF', '#FF6B6B', '#A29BFE', '#00CEC9'];
    
    $scope.parentName = '';
    $scope.children = [];
    $scope.loading = true;
    
    // Load parent profile and children
    function init() {
        var userId = AuthService.getUser();
        
        // Get parent name
        ApiService.getPlayer(userId).then(function(res) {
            $scope.parentName = (res.data && res.data.name) || userId.split('@')[0];
        });
        
        // Load children from parent's profile__c.children array
        ApiService.getProfile(userId).then(function(res) {
            var profile = res.data || {};
            loadChildren(profile.children || []);
        }).catch(function() {
            // profile__c doesn't exist yet — no children
            loadChildren([]);
        });
    }
    
    function loadChildren(childIds) {
        if (childIds.length === 0) {
            $scope.loading = false;
            return;
        }
        
        var loaded = 0;
        childIds.forEach(function(childId) {
            ApiService.getPlayer(childId).then(function(childRes) {
                var child = childRes.data;
                if (child && child._id) {
                    child.color = COLORS[$scope.children.length % COLORS.length];
                    loadChildSubjectCount(child);
                    $scope.children.push(child);
                }
                loaded++;
                if (loaded >= childIds.length) $scope.loading = false;
            }).catch(function() {
                loaded++;
                if (loaded >= childIds.length) $scope.loading = false;
            });
        });
    }
    
    function loadChildSubjectCount(child) {
        // Root folder _id = child._id
        ApiService.getFolderInside(child._id).then(function(res) {
            var data = res.data || {};
            var items = data.items || [];
            child.subjectCount = items.filter(function(i) { return i.type === 'subject'; }).length;
        }).catch(function() {
            child.subjectCount = 0;
        });
    }
    
    $scope.openChild = function(child) {
        $location.path('/parent/child/' + encodeURIComponent(child._id));
    };
    
    $scope.openAddChild = function() {
        $location.path('/parent/add-child');
    };
    
    $scope.deleteChild = function(child, $event) {
        $event.stopPropagation();
        if (!confirm('Excluir "' + child.name + '" e todos os dados?\n\nEsta ação não pode ser desfeita.')) return;
        
        $scope.loading = true;
        // Delete player via API — trigger handles cleanup (folder, profile, signup, parent ref)
        ApiService.deletePlayer(child._id).then(function() {
            var idx = $scope.children.indexOf(child);
            if (idx !== -1) $scope.children.splice(idx, 1);
            $scope.loading = false;
        }).catch(function() {
            alert('Erro ao excluir. Tente novamente.');
            $scope.loading = false;
        });
    };
    
    $scope.logout = function() {
        AuthService.logout();
        $location.path('/landing');
    };
    
    init();
});
