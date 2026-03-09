app.controller('ParentDashboardController', function($scope, $location, $rootScope, AuthService, ApiService) {
    var CHILDREN_KEY = 'tutor_children';
    var COLORS = ['#FF9600', '#00B894', '#FD79A8', '#FDCB6E', '#74B9FF', '#FF6B6B', '#FFB84D', '#00CEC9'];
    
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
                    loadChildAvatar(child);
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
    
    function loadChildAvatar(child) {
        // Check if player.image has a real URL (not data: URI)
        var hasRealImage = child.image && child.image.small && child.image.small.url && child.image.small.url.indexOf('data:') !== 0;
        
        // Always check profile__c for character_url as fallback
        ApiService.dbGet('profile__c', child._id).then(function(res) {
            var profile = res.data || {};
            if (profile.age) child.age = profile.age;
            if (!hasRealImage && profile.character_url) {
                child.image = { small: { url: profile.character_url }, medium: { url: profile.character_url }, original: { url: profile.character_url } };
            } else if (!hasRealImage && !profile.character_url) {
                child.image = null;
            }
            $scope.$applyAsync();
        }).catch(function() {});
    }
    
    function loadChildSubjectCount(child) {
        // Root folder _id = root_folder GUID (or child._id for legacy)
        var rootId = childRootFolder(child);
        ApiService.getFolderInside(rootId).then(function(res) {
            var data = res.data || {};
            var items = data.items || [];
            child.subjectCount = items.filter(function(i) { return i.type === 'subject'; }).length;
        }).catch(function() {
            child.subjectCount = 0;
        });
    }
    
    function childRootFolder(child) {
        return (child.extra && child.extra.root_folder) || child._id;
    }
    
    $scope.openChild = function(child) {
        $location.path('/parent/child/' + encodeURIComponent(childRootFolder(child)));
    };
    
    $scope.openExams = function(child, $event) {
        $event.stopPropagation();
        $location.path('/parent/child/' + encodeURIComponent(childRootFolder(child)) + '/exams');
    };
    
    $scope.captureChild = function(child, $event) {
        $event.stopPropagation();
        var rf = childRootFolder(child);
        var ctx = encodeURIComponent(JSON.stringify({
            childId: child._id,
            rootFolder: rf,
            folderId: rf, // root folder _id = root_folder GUID
            level: 'root',
            subject: null,
            module: null
        }));
        $location.path('/capture').search({ ctx: ctx });
    };
    
    $scope.editChild = function(child, $event) {
        $event.stopPropagation();
        $location.path('/parent/edit-child/' + encodeURIComponent(childRootFolder(child)));
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
