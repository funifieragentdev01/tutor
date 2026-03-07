app.controller('ParentDashboardController', function($scope, $location, $rootScope, AuthService, ApiService) {
    var CHILDREN_KEY = 'tutor_children';
    var COLORS = ['#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E', '#74B9FF', '#FF6B6B', '#A29BFE', '#00CEC9'];
    
    $scope.parentName = '';
    $scope.children = [];
    $scope.showAddChild = false;
    $scope.newChild = {};
    $scope.addingChild = false;
    $scope.childError = '';
    $scope.loading = true;
    
    // Load parent profile and children
    function init() {
        var userId = AuthService.getUser();
        
        // Get parent name
        ApiService.getPlayer(userId).then(function(res) {
            $scope.parentName = (res.data && res.data.name) || userId.split('@')[0];
        });
        
        // Load children from parent's extra.children array
        ApiService.getProfile(userId).then(function(res) {
            var profile = res.data || {};
            var childIds = (profile.children || []);
            if (childIds.length === 0) {
                $scope.loading = false;
                return;
            }
            
            // Load each child's player data
            var loaded = 0;
            childIds.forEach(function(childId) {
                ApiService.getPlayer(childId).then(function(childRes) {
                    var child = childRes.data;
                    if (child && child._id) {
                        child.color = COLORS[$scope.children.length % COLORS.length];
                        // Count subjects from folder
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
        }).catch(function() {
            $scope.loading = false;
        });
    }
    
    function loadChildSubjectCount(child) {
        // Root folder _id = child._id
        ApiService.getFolderInside(child._id).then(function(res) {
            var items = res.data || [];
            child.subjectCount = items.filter(function(i) { return i.type === 'subject'; }).length;
        }).catch(function() {
            child.subjectCount = 0;
        });
    }
    
    $scope.openChild = function(child) {
        $location.path('/parent/child/' + encodeURIComponent(child._id));
    };
    
    $scope.addChild = function() {
        if (!$scope.newChild.name || !$scope.newChild.age || !$scope.newChild.grade) {
            $scope.childError = 'Nome, idade e série são obrigatórios.';
            return;
        }
        
        $scope.addingChild = true;
        $scope.childError = '';
        
        var parentId = AuthService.getUser();
        var childId = parentId.replace('@', '+child' + Date.now() + '@');
        var childPassword = 'child' + Math.random().toString(36).substring(2, 10);
        
        // 1. Create child player via signup__c
        AuthService.signup({
            _id: childId,
            name: $scope.newChild.name,
            email: childId,
            password: childPassword,
            role: 'child'
        }).then(function(res) {
            var data = res.data;
            if (data.error) {
                $scope.childError = data.error;
                $scope.addingChild = false;
                return;
            }
            
            // 2. Save child profile with extra data
            var childProfile = {
                _id: childId,
                parent: parentId,
                name: $scope.newChild.name,
                age: parseInt($scope.newChild.age),
                grade: $scope.newChild.grade,
                interests: $scope.newChild.interests || '',
                friends: $scope.newChild.friends || '',
                created: new Date().getTime()
            };
            
            ApiService.dbSave('profile__c', childProfile).then(function() {
                // 3. Create root folder for child
                ApiService.createFolder({
                    _id: childId,
                    type: 'root',
                    title: $scope.newChild.name,
                    position: 0,
                    active: true,
                    extra: { parent: parentId }
                }).then(function() {
                    // 4. Add child to parent's children list
                    addChildToParent(parentId, childId, childProfile);
                }).catch(function(err) {
                    // Root folder might already exist, still add to parent
                    addChildToParent(parentId, childId, childProfile);
                });
            }).catch(function() {
                $scope.childError = 'Erro ao salvar perfil da criança.';
                $scope.addingChild = false;
            });
        }).catch(function(err) {
            $scope.childError = 'Erro ao criar conta da criança.';
            $scope.addingChild = false;
        });
    };
    
    function addChildToParent(parentId, childId, childProfile) {
        ApiService.getProfile(parentId).then(function(res) {
            var profile = res.data || { _id: parentId };
            if (!profile.children) profile.children = [];
            if (profile.children.indexOf(childId) === -1) {
                profile.children.push(childId);
            }
            return ApiService.dbSave('profile__c', profile);
        }).then(function() {
            // Add to local list
            $scope.children.push({
                _id: childId,
                name: childProfile.name,
                extra: { role: 'child' },
                color: COLORS[$scope.children.length % COLORS.length],
                subjectCount: 0
            });
            $scope.newChild = {};
            $scope.showAddChild = false;
            $scope.addingChild = false;
        }).catch(function() {
            $scope.childError = 'Criança criada mas erro ao vincular. Recarregue a página.';
            $scope.addingChild = false;
        });
    }
    
    $scope.logout = function() {
        AuthService.logout();
        $location.path('/landing');
    };
    
    init();
});
