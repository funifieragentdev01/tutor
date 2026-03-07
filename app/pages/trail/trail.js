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
                ApiService.dbGet('profile__c', childId).then(function(pRes) {
                    $scope.currentTitle = (pRes.data && pRes.data.name) || 'Trilha';
                });
            }
            
            updateCanCapture();
            updateEmptyState();
        }).catch(function() {
            $scope.currentLevel = 'root';
            $scope.currentTitle = 'Trilha';
            updateCanCapture();
            updateEmptyState();
        });
        
        // Load breadcrumb from API (correct order: root → ... → current)
        ApiService.getFolderBreadcrumb(id).then(function(res) {
            var crumbs = res.data || [];
            // Remove the last item (current folder) and root folder from breadcrumb display
            $scope.breadcrumb = crumbs.filter(function(c) {
                return c._id !== id && c._id !== childId;
            });
        }).catch(function() {
            $scope.breadcrumb = [];
        });
        
        // Get children with player progress
        var playerId = childId;
        ApiService.getFolderProgress(id, playerId).then(function(res) {
            var data = res.data || {};
            var all = data.items || [];
            if (!Array.isArray(all)) all = [];
            
            // Separate folders from content
            $scope.items = all.filter(function(i) { return i.folder !== false; });
            $scope.contents = all.filter(function(i) { return i.folder === false; });
            $scope.loading = false;
        }).catch(function() {
            // Fallback to inside (no progress)
            ApiService.getFolderInside(id).then(function(res) {
                var data = res.data || {};
                var all = data.items || [];
                if (!Array.isArray(all)) all = [];
                $scope.items = all.filter(function(i) { return i.folder !== false; });
                $scope.contents = all.filter(function(i) { return i.folder === false; });
                $scope.loading = false;
            }).catch(function() {
                $scope.loading = false;
            });
        });
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
    
    // breadcrumb is now loaded from /v3/folder/breadcrumb API
    
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
    
    // Delete a folder item (subject, module, lesson) with confirmation
    $scope.deleteItem = function(item, $event) {
        $event.stopPropagation();
        var typeNames = { subject: 'disciplina', module: 'módulo', lesson: 'aula' };
        var typeName = typeNames[item.type] || 'item';
        if (!confirm('Excluir ' + typeName + ' "' + item.title + '" e todo o conteúdo interno?\n\nEsta ação não pode ser desfeita.')) return;
        
        $scope.loading = true;
        ApiService.deleteFolderWithQuizzes(item._id).then(function() {
            // Remove from local list
            var idx = $scope.items.indexOf(item);
            if (idx !== -1) $scope.items.splice(idx, 1);
            $scope.loading = false;
            $scope.$applyAsync();
        }).catch(function() {
            alert('Erro ao excluir. Tente novamente.');
            $scope.loading = false;
            $scope.$applyAsync();
        });
    };
    
    // Delete a content item (quiz)
    $scope.deleteContent = function(c, $event) {
        $event.stopPropagation();
        if (!confirm('Excluir esta atividade?\n\nEsta ação não pode ser desfeita.')) return;
        
        $scope.loading = true;
        // Delete quiz first (cascade: questions), then folder_content
        var p = c.content && c.type === 'quiz' ? ApiService.deleteQuiz(c.content).catch(function(){}) : Promise.resolve();
        p.then(function() {
            return ApiService.deleteFolderContent(c._id);
        }).then(function() {
            var idx = $scope.contents.indexOf(c);
            if (idx !== -1) $scope.contents.splice(idx, 1);
            $scope.loading = false;
            $scope.$applyAsync();
        }).catch(function() {
            alert('Erro ao excluir. Tente novamente.');
            $scope.loading = false;
            $scope.$applyAsync();
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
