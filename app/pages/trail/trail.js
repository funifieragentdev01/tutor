app.controller('TrailController', function($scope, $location, $routeParams, AuthService, ApiService) {
    var childId = decodeURIComponent($routeParams.childId || '');
    var folderId = decodeURIComponent($routeParams.folderId || '') || childId; // default to root
    
    $scope.isParent = AuthService.getRole() === 'parent';
    $scope.currentTitle = '';
    $scope.currentLevel = ''; // root, subject, module, lesson
    $scope.items = [];
    $scope.contents = [];
    $scope.breadcrumb = [];
    $scope.loading = true;
    $scope.canCapture = false;
    $scope.showAddSubject = false;
    $scope.newSubjectName = '';
    $scope.creatingSubject = false;
    
    // Empty state messages
    $scope.emptyIcon = '📚';
    $scope.emptyTitle = 'Nada por aqui ainda';
    $scope.emptyText = 'Tire uma foto do caderno para criar conteúdo.';
    
    var SUBJECT_ICONS = {
        'matemática': '📐', 'português': '📖', 'inglês': '🇬🇧', 'english': '🇬🇧',
        'história': '🏛️', 'geografia': '🌍', 'ciências': '🔬', 'science': '🔬',
        'arte': '🎨', 'educação física': '⚽', 'música': '🎵', 'biologia': '🧬',
        'física': '⚡', 'química': '🧪', 'filosofia': '💭', 'sociologia': '👥'
    };
    
    function init() {
        loadFolder(folderId);
    }
    
    function loadFolder(id) {
        $scope.loading = true;
        $scope.items = [];
        $scope.contents = [];
        
        // Get folder info
        ApiService.dbGet('folder', id).then(function(res) {
            var folder = res.data;
            if (folder && folder.title) {
                $scope.currentTitle = folder.title;
                $scope.currentLevel = folder.type || 'root';
            } else if (id === childId) {
                $scope.currentLevel = 'root';
                // Get child name from profile
                ApiService.dbGet('profile__c', childId).then(function(pRes) {
                    $scope.currentTitle = (pRes.data && pRes.data.name) || 'Trilha';
                });
            }
            
            updateCanCapture();
            updateBreadcrumb(folder);
            updateEmptyState();
        }).catch(function() {
            $scope.currentLevel = 'root';
            $scope.currentTitle = 'Trilha';
            updateCanCapture();
            updateEmptyState();
        });
        
        // Get children folders
        ApiService.getFolderInside(id).then(function(res) {
            var data = res.data || {};
            var all = data.items || data || [];
            if (!Array.isArray(all)) all = [];
            // Separate folders from content
            $scope.items = all.filter(function(i) { return i.type !== 'content'; });
            $scope.loading = false;
        }).catch(function() {
            $scope.loading = false;
        });
        
        // Get folder contents (for lessons)
        ApiService.dbQuery('folder_content', 'parent:"' + id + '"', { position: 1 }, 50).then(function(res) {
            $scope.contents = res.data || [];
        }).catch(function() {});
    }
    
    function updateCanCapture() {
        // Can capture at root (creates subject+module+lessons), subject (creates module+lessons), or module (creates lessons)
        $scope.canCapture = ['root', 'subject', 'module'].indexOf($scope.currentLevel) !== -1;
    }
    
    function updateEmptyState() {
        switch ($scope.currentLevel) {
            case 'root':
                $scope.emptyIcon = '📚';
                $scope.emptyTitle = 'Nenhuma disciplina ainda';
                $scope.emptyText = 'Tire uma foto do caderno ou crie uma disciplina manualmente.';
                break;
            case 'subject':
                $scope.emptyIcon = '📂';
                $scope.emptyTitle = 'Nenhum módulo ainda';
                $scope.emptyText = 'Tire uma foto do caderno para a IA criar módulos e atividades.';
                break;
            case 'module':
                $scope.emptyIcon = '📝';
                $scope.emptyTitle = 'Nenhuma aula ainda';
                $scope.emptyText = 'Tire uma foto do caderno para a IA criar aulas com quizzes.';
                break;
            case 'lesson':
                $scope.emptyIcon = '✏️';
                $scope.emptyTitle = 'Nenhuma atividade ainda';
                $scope.emptyText = 'As atividades serão criadas pela IA.';
                break;
        }
    }
    
    function updateBreadcrumb(folder) {
        $scope.breadcrumb = [];
        if (!folder || !folder.parent) return;
        
        // Build breadcrumb by traversing parents (simplified — just show current path)
        function addParent(id) {
            if (!id || id === childId) {
                $scope.breadcrumb.unshift({ _id: childId, title: $scope.currentTitle || 'Root', type: 'root' });
                return;
            }
            ApiService.dbGet('folder', id).then(function(res) {
                var f = res.data;
                if (f && f.title) {
                    $scope.breadcrumb.unshift({ _id: f._id, title: f.title, type: f.type });
                    if (f.parent) addParent(f.parent);
                    else $scope.breadcrumb.unshift({ _id: childId, title: 'Root', type: 'root' });
                }
            });
        }
        
        if (folder.parent) addParent(folder.parent);
    }
    
    $scope.getIcon = function(item) {
        if (item.type === 'subject') {
            var key = (item.title || '').toLowerCase();
            return SUBJECT_ICONS[key] || '📘';
        }
        if (item.type === 'module') return '📂';
        if (item.type === 'lesson') {
            if (item.is_unlocked === false) return '🔒';
            if (item.percent >= 100) return '⭐';
            if (item.percent > 0) return '📝';
            return '📄';
        }
        return '📁';
    };
    
    $scope.getIconColor = function(item) {
        if (item.is_unlocked === false) return '#B2BEC3';
        if (item.percent >= 100) return '#00B894';
        if (item.percent > 0) return '#FDCB6E';
        var colors = ['#6C5CE7', '#00B894', '#FD79A8', '#74B9FF', '#FF6B6B', '#00CEC9'];
        var idx = ($scope.items.indexOf(item)) % colors.length;
        return colors[idx];
    };
    
    $scope.openItem = function(item) {
        if (item.is_unlocked === false) return; // locked
        var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(childId) + '/folder/' : '/child/folder/';
        $location.path(base + encodeURIComponent(item._id));
    };
    
    $scope.openContent = function(c) {
        if (c.type === 'quiz') {
            $location.path('/quiz/' + encodeURIComponent(c.content));
        }
    };
    
    $scope.navigateTo = function(b) {
        var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(childId) + '/folder/' : '/child/folder/';
        $location.path(base + encodeURIComponent(b._id));
    };
    
    $scope.goBack = function() {
        // Navigate to parent folder
        ApiService.dbGet('folder', folderId).then(function(res) {
            var folder = res.data;
            if (folder && folder.parent) {
                var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(childId) + '/folder/' : '/child/folder/';
                $location.path(base + encodeURIComponent(folder.parent));
            } else {
                // Back to parent dashboard or child dashboard
                $location.path($scope.isParent ? '/parent' : '/child');
            }
        }).catch(function() {
            $location.path($scope.isParent ? '/parent' : '/child');
        });
    };
    
    $scope.openAddSubject = function() {
        $scope.showAddSubject = true;
    };
    
    $scope.cancelAddSubject = function() {
        $scope.showAddSubject = false;
    };
    
    $scope.createSubject = function() {
        if (!$scope.newSubjectName) return;
        $scope.creatingSubject = true;
        
        ApiService.createFolder({
            type: 'subject',
            parent: childId,
            title: $scope.newSubjectName.trim(),
            position: $scope.items.length,
            active: true,
            extra: {}
        }).then(function(res) {
            var created = res.data;
            $scope.items.push(created);
            $scope.showAddSubject = false;
            $scope.newSubjectName = '';
            $scope.creatingSubject = false;
        }).catch(function() {
            $scope.creatingSubject = false;
        });
    };
    
    $scope.openCapture = function() {
        // Navigate to capture page with context
        var ctx = encodeURIComponent(JSON.stringify({
            childId: childId,
            folderId: folderId,
            level: $scope.currentLevel,
            subject: $scope.currentLevel === 'subject' ? $scope.currentTitle : null,
            module: $scope.currentLevel === 'module' ? $scope.currentTitle : null
        }));
        $location.path('/capture').search({ ctx: ctx });
    };
    
    init();
});
