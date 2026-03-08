app.controller('TrailController', function($scope, $location, $routeParams, $timeout, AuthService, ApiService) {
    var childId = decodeURIComponent($routeParams.childId || '') || (AuthService.getRole() === 'child' ? AuthService.getUser() : '');
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
    
    // Duolingo trail
    $scope.showDuolingoTrail = false;
    $scope.trailItems = []; // flattened: [{type:'module',...}, {type:'lesson',...}, ...]
    $scope.trailLoading = false;
    $scope.selectedLesson = null;
    $scope.selectedLessonStyle = {};
    $scope.characterUrl = '';
    $scope.loadingQuiz = false;
    
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

    var LESSON_ICONS = ['📖', '🎤', '✏️', '🧩', '🎯', '💡', '📝', '🔬'];
    
    var MODULE_COLORS = ['#FF9600', '#CE82FF', '#00CD9C', '#1CB0F6', '#FF4B4B', '#FFC800'];
    
    function init() {
        loadFolder(folderId);
        // Load character URL for child
        if (!$scope.isParent) {
            ApiService.dbGet('profile__c', childId).then(function(res) {
                if (res.data && res.data.character_url) {
                    $scope.characterUrl = res.data.character_url;
                }
            }).catch(function(){});
        }
    }
    
    function loadFolder(id) {
        $scope.loading = true;
        $scope.items = [];
        $scope.contents = [];
        $scope.selectedLesson = null;
        
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
            updateDuolingoFlag();
        }).catch(function() {
            $scope.currentLevel = 'root';
            $scope.currentTitle = 'Trilha';
            updateCanCapture();
            updateEmptyState();
            updateDuolingoFlag();
        });
        
        // Load breadcrumb
        ApiService.getFolderBreadcrumb(id).then(function(res) {
            var crumbs = res.data || [];
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
            
            $scope.items = all.filter(function(i) { return i.folder !== false; });
            $scope.contents = all.filter(function(i) { return i.folder === false; });
            $scope.loading = false;
            
            updateDuolingoFlag();
            loadModuleColors($scope.items);
            
            // If Duolingo trail, load nested data
            if ($scope.showDuolingoTrail) {
                loadDuolingoTrail(all);
            }
        }).catch(function(err) {
            ApiService.getFolderInside(id).then(function(res) {
                var data = res.data || {};
                var all = data.items || [];
                if (!Array.isArray(all)) all = [];
                $scope.items = all.filter(function(i) { return i.folder !== false; });
                $scope.contents = all.filter(function(i) { return i.folder === false; });
                $scope.loading = false;
                updateDuolingoFlag();
                if ($scope.showDuolingoTrail) {
                    loadDuolingoTrail(all);
                }
            }).catch(function() {
                $scope.loading = false;
            });
        });
    }
    
    function loadModuleColors(items) {
        var moduleItems = items.filter(function(i) { return i.type === 'module'; });
        if (moduleItems.length === 0) return;
        var ids = moduleItems.map(function(i) { return i._id; });
        ApiService.dbQuery('folder', '_id:{$in:' + JSON.stringify(ids) + '}', null, ids.length + 1).then(function(res) {
            var docs = res.data || [];
            var map = {};
            docs.forEach(function(d) { if (d.extra && d.extra.color) map[d._id] = d.extra.color; });
            moduleItems.forEach(function(item) {
                if (map[item._id]) {
                    item._savedColor = map[item._id];
                    item._pickedColor = map[item._id];
                }
            });
            $scope.$applyAsync();
        }).catch(function() {});
    }
    
    function updateDuolingoFlag() {
        $scope.showDuolingoTrail = !$scope.isParent && $scope.currentLevel === 'subject';
    }
    
    function loadDuolingoTrail(modules) {
        $scope.trailLoading = true;
        $scope.trailItems = [];
        
        var folders = modules.filter(function(i) { return i.folder !== false; });
        if (folders.length === 0) {
            $scope.trailLoading = false;
            return;
        }
        
        // Batch fetch module folder docs to get extra.color
        var moduleIds = folders.map(function(f) { return f._id; });
        var colorMap = {}; // _id -> color
        
        var idsJson = JSON.stringify(moduleIds);
        ApiService.dbQuery('folder', '_id:{$in:' + idsJson + '}', null, moduleIds.length + 1).then(function(res) {
            var docs = res.data || [];
            docs.forEach(function(doc) {
                if (doc.extra && doc.extra.color) colorMap[doc._id] = doc.extra.color;
            });
        }).catch(function() {}).finally(function() {
            buildModuleEntries(folders, colorMap);
        });
    }
    
    function buildModuleEntries(folders, colorMap) {
        var pending = folders.length;
        var results = [];
        
        folders.forEach(function(mod, modIdx) {
            var savedColor = colorMap[mod._id] || null;
            var moduleEntry = {
                _type: 'module',
                _id: mod._id,
                title: mod.title,
                percent: mod.percent || 0,
                color: savedColor || MODULE_COLORS[modIdx % MODULE_COLORS.length],
                moduleIndex: modIdx,
                position: mod.position || modIdx,
                lessons: []
            };
            results.push(moduleEntry);
            
            ApiService.getFolderProgress(mod._id, childId).then(function(res) {
                var data = res.data || {};
                var lessons = (data.items || []).filter(function(i) { return i.folder !== false; });
                moduleEntry.lessons = lessons;
                pending--;
                if (pending === 0) buildTrail(results);
            }).catch(function() {
                pending--;
                if (pending === 0) buildTrail(results);
            });
        });
    }
    
    function buildTrail(modules) {
        modules.sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
        
        var flat = [];
        var lessonGlobalIdx = 0;
        
        modules.forEach(function(mod, modIdx) {
            flat.push({
                _type: 'module',
                _id: mod._id,
                title: mod.title,
                percent: mod.percent,
                color: mod.color,
                moduleIndex: modIdx
            });
            
            (mod.lessons || []).forEach(function(lesson, lIdx) {
                flat.push({
                    _type: 'lesson',
                    _id: lesson._id,
                    title: lesson.title,
                    percent: lesson.percent || 0,
                    is_unlocked: lesson.is_unlocked,
                    lessonIndex: lIdx,
                    globalIndex: lessonGlobalIdx,
                    moduleIndex: modIdx,
                    moduleColor: mod.color,
                    icon: getLessonIcon(lesson, lIdx)
                });
                lessonGlobalIdx++;
            });
        });
        
        $scope.trailItems = flat;
        $scope.trailLoading = false;
        $scope.$applyAsync();
        
        // Auto-scroll to first available lesson
        $timeout(function() {
            var firstAvailable = null;
            for (var i = 0; i < flat.length; i++) {
                if (flat[i]._type === 'lesson' && flat[i].is_unlocked !== false && (flat[i].percent || 0) < 100) {
                    firstAvailable = flat[i];
                    break;
                }
            }
            if (firstAvailable) {
                var el = document.getElementById('trail-item-' + firstAvailable._id);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 300);
    }
    
    function getLessonIcon(lesson, idx) {
        if (lesson.is_unlocked === false) return '🔒';
        if ((lesson.percent || 0) >= 100) return '⭐';
        // First available (unlocked, not done)
        if (lesson.is_unlocked !== false && (lesson.percent || 0) < 100) return '▶';
        return LESSON_ICONS[idx % LESSON_ICONS.length];
    }
    
    $scope.getBubbleStyle = function(item) {
        if (item._type !== 'lesson') return {};
        var xOffset = Math.sin(item.lessonIndex * 0.8) * 80;
        return {
            'margin-left': 'calc(50% - 30px + ' + xOffset + 'px)'
        };
    };
    
    $scope.getBubbleClass = function(item) {
        if (item._type !== 'lesson') return '';
        var cls = 'duo-bubble';
        if (item.is_unlocked === false) cls += ' duo-bubble-locked';
        else if ((item.percent || 0) >= 100) cls += ' duo-bubble-done';
        else cls += ' duo-bubble-active';
        return cls;
    };
    
    $scope.getCharacterStyle = function(item) {
        if (!$scope.characterUrl) return { display: 'none' };
        var side = item.moduleIndex % 2 === 0 ? 'right' : 'left';
        var style = {};
        if (side === 'right') {
            style['right'] = '10px';
            style['left'] = 'auto';
        } else {
            style['left'] = '10px';
            style['right'] = 'auto';
        }
        return style;
    };
    
    $scope.isCharacterGray = function(item) {
        return (item.percent || 0) < 100;
    };
    
    $scope.selectLesson = function(item, $event) {
        if (item._type !== 'lesson') return;
        $event.stopPropagation();
        
        if ($scope.selectedLesson && $scope.selectedLesson._id === item._id) {
            $scope.selectedLesson = null;
            return;
        }
        
        $scope.selectedLesson = item;
    };
    
    $scope.closePopup = function() {
        $scope.selectedLesson = null;
    };
    
    $scope.getLessonStatus = function(item) {
        if (!item) return 'locked';
        if (item.is_unlocked === false) return 'locked';
        if ((item.percent || 0) >= 100) return 'done';
        return 'available';
    };
    
    $scope.startLesson = function(item) {
        if (!item || item.is_unlocked === false) return;
        $scope.loadingQuiz = true;
        
        // Find quiz content inside this lesson folder
        ApiService.getFolderProgress(item._id, childId).then(function(res) {
            var data = res.data || {};
            var contents = (data.items || []).filter(function(i) { return i.folder === false; });
            var quiz = contents.find(function(c) { return c.type === 'quiz'; });
            if (quiz) {
                $scope.loadingQuiz = false;
                $location.path('/quiz/' + encodeURIComponent(quiz.content)).search({ player: childId });
            } else {
                // Fallback: try getFolderInside
                ApiService.getFolderInside(item._id).then(function(res2) {
                    var all2 = (res2.data && res2.data.items) || [];
                    var quiz2 = all2.find(function(c) { return c.type === 'quiz' && c.folder === false; });
                    if (quiz2) {
                        $location.path('/quiz/' + encodeURIComponent(quiz2.content)).search({ player: childId });
                    }
                    $scope.loadingQuiz = false;
                }).catch(function() { $scope.loadingQuiz = false; });
            }
        }).catch(function() {
            $scope.loadingQuiz = false;
        });
    };
    
    function updateCanCapture() {
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
        // Use saved color for modules
        if (item.type === 'module' && item._savedColor) return item._savedColor;
        if (item.is_unlocked === false) return '#B2BEC3';
        if (item.percent >= 100) return '#00B894';
        if (item.percent > 0) return '#FDCB6E';
        var colors = ['#6C5CE7', '#00B894', '#FD79A8', '#74B9FF', '#FF6B6B', '#00CEC9'];
        var idx = ($scope.items.indexOf(item)) % colors.length;
        return colors[idx];
    };
    
    $scope.getItemColor = function(item) {
        return item._savedColor || item._pickedColor || MODULE_COLORS[($scope.items.indexOf(item)) % MODULE_COLORS.length];
    };
    
    $scope.setModuleColor = function(item, color) {
        if (!color) return;
        item._savedColor = color;
        // Save to folder.extra.color
        ApiService.dbGet('folder', item._id).then(function(res) {
            var folder = res.data || {};
            var extra = folder.extra || {};
            extra.color = color;
            return ApiService.updateFolder(item._id, { extra: extra });
        }).then(function() {
            console.log('[Trail] Module color saved:', item._id, color);
        }).catch(function(err) {
            console.error('[Trail] Failed to save module color:', err);
        });
    };
    
    $scope.openItem = function(item) {
        if (item.is_unlocked === false) return;
        var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(childId) + '/folder/' : '/child/folder/';
        $location.path(base + encodeURIComponent(item._id));
    };
    
    $scope.openContent = function(c) {
        if (c.type === 'quiz') {
            $location.path('/quiz/' + encodeURIComponent(c.content)).search({ player: childId });
        }
    };
    
    $scope.navigateTo = function(b) {
        var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(childId) + '/folder/' : '/child/folder/';
        $location.path(base + encodeURIComponent(b._id));
    };
    
    $scope.goBack = function() {
        ApiService.dbGet('folder', folderId).then(function(res) {
            var folder = res.data;
            if (folder && folder.parent) {
                var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(childId) + '/folder/' : '/child/folder/';
                $location.path(base + encodeURIComponent(folder.parent));
            } else {
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
    
    $scope.clearProgress = function(c, $event) {
        $event.stopPropagation();
        if (!confirm('Limpar progresso de "' + c.title + '"?\n\nO filho precisará refazer esta atividade.')) return;
        
        var playerId = childId;
        ApiService.dbDelete('folder_log', 'item:"' + c._id + '",player:"' + playerId + '"').then(function() {
            c.percent = 0;
            c.done = 0;
            c.time = null;
            $scope.$applyAsync();
        }).catch(function() {
            alert('Erro ao limpar progresso.');
        });
    };
    
    $scope.deleteItem = function(item, $event) {
        $event.stopPropagation();
        var typeNames = { subject: 'disciplina', module: 'módulo', lesson: 'aula' };
        var typeName = typeNames[item.type] || 'item';
        if (!confirm('Excluir ' + typeName + ' "' + item.title + '" e todo o conteúdo interno?\n\nEsta ação não pode ser desfeita.')) return;
        
        $scope.loading = true;
        ApiService.deleteFolderWithQuizzes(item._id).then(function() {
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
    
    $scope.deleteContent = function(c, $event) {
        $event.stopPropagation();
        if (!confirm('Excluir esta atividade?\n\nEsta ação não pode ser desfeita.')) return;
        
        $scope.loading = true;
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
