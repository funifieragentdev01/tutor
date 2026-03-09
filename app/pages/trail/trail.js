app.controller('TrailController', function($scope, $location, $routeParams, $timeout, AuthService, ApiService) {
    var childId = ''; // resolved below
    var rootFolder = ''; // root_folder GUID
    var folderId = decodeURIComponent($routeParams.folderId || ''); // may be empty until resolved
    
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
        'matemática': 'fa-calculator', 'math': 'fa-calculator', 'mathematics': 'fa-calculator',
        'português': 'fa-book-open', 'portugues': 'fa-book-open', 'language': 'fa-book-open',
        'inglês': 'fa-earth-americas', 'ingles': 'fa-earth-americas', 'english': 'fa-earth-americas',
        'história': 'fa-landmark', 'historia': 'fa-landmark', 'history': 'fa-landmark',
        'geografia': 'fa-globe', 'geography': 'fa-globe',
        'ciências': 'fa-flask', 'ciencias': 'fa-flask', 'science': 'fa-flask',
        'arte': 'fa-palette', 'art': 'fa-palette', 'artes': 'fa-palette',
        'educação física': 'fa-futbol', 'educacao fisica': 'fa-futbol',
        'música': 'fa-music', 'musica': 'fa-music', 'music': 'fa-music',
        'biologia': 'fa-dna', 'biology': 'fa-dna',
        'física': 'fa-atom', 'fisica': 'fa-atom', 'physics': 'fa-atom',
        'química': 'fa-vial', 'quimica': 'fa-vial', 'chemistry': 'fa-vial',
        'filosofia': 'fa-brain', 'philosophy': 'fa-brain',
        'sociologia': 'fa-users', 'sociology': 'fa-users',
        'redação': 'fa-pen-fancy', 'redacao': 'fa-pen-fancy',
        'literatura': 'fa-feather', 'literature': 'fa-feather',
        'espanhol': 'fa-earth-europe', 'spanish': 'fa-earth-europe',
        'informática': 'fa-laptop-code', 'informatica': 'fa-laptop-code', 'computing': 'fa-laptop-code',
        'religião': 'fa-hands-praying', 'religiao': 'fa-hands-praying'
    };
    var DEFAULT_SUBJECT_ICON = 'fa-book';

    var LESSON_ICONS = ['fa-book-open', 'fa-microphone', 'fa-pencil', 'fa-puzzle-piece', 'fa-bullseye', 'fa-lightbulb', 'fa-pen', 'fa-flask'];
    
    var MODULE_COLORS = ['#FF9600', '#CE82FF', '#00CD9C', '#1CB0F6', '#FF4B4B', '#FFC800'];
    
    var POSE_PROMPTS = [
        'studying with a book, sitting cross-legged',
        'celebrating with arms raised, jumping with joy',
        'thinking with hand on chin, looking curious',
        'writing in a notebook, focused',
        'giving a thumbs up, confident smile',
        'waving hello, friendly greeting',
        'running with a backpack, energetic',
        'reading a book while standing, concentrated'
    ];
    
    $scope.poseUrls = {}; // moduleId -> url
    $scope.variationUrls = []; // character variation URLs from profile__c
    var poseGenerationQueue = [];
    var poseGenerating = false;
    
    function init() {
        loadFolder(folderId);
        // Load character URL + variations for child
        if (!$scope.isParent) {
            ApiService.dbGet('profile__c', childId).then(function(res) {
                if (res.data && res.data.character_url) {
                    $scope.characterUrl = res.data.character_url;
                }
                if (res.data && res.data.variations && res.data.variations.length > 0) {
                    $scope.variationUrls = res.data.variations.map(function(v) { return v.url; });
                }
            }).catch(function(){});
        }
    }
    
    function initController(resolvedChildId, resolvedRootFolder) {
        childId = resolvedChildId;
        rootFolder = resolvedRootFolder || resolvedChildId;
        if (!folderId) folderId = rootFolder; // default to root folder
        init();
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
                // If viewing a module, store its color for lessons to inherit
                if (folder.type === 'module' && folder.extra && folder.extra.color) {
                    $scope.parentModuleColor = folder.extra.color;
                } else {
                    $scope.parentModuleColor = null;
                }
            } else if (id === rootFolder || id === childId) {
                $scope.currentLevel = 'root';
                $scope.parentModuleColor = null;
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
        $scope.showSubjectGrid = !$scope.isParent && $scope.currentLevel === 'root';
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
            // Trigger pose generation for modules missing poses
            if (!$scope.isParent) {
                ApiService.dbQuery('folder', '_id:{$in:' + idsJson + '}', null, moduleIds.length + 1).then(function(res2) {
                    checkAndGeneratePoses(res2.data || []);
                }).catch(function() {});
            }
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
        
        $scope.trailItems = insertVariationsIntoTrail(flat);
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
        if (lesson.is_unlocked === false) return 'fa-lock';
        if ((lesson.percent || 0) >= 100) return 'fa-star';
        if (lesson.is_unlocked !== false && (lesson.percent || 0) < 100) return 'fa-play';
        return LESSON_ICONS[idx % LESSON_ICONS.length];
    }
    
    $scope.getBubbleStyle = function(item) {
        if (item._type !== 'lesson') return {};
        var xOffset = Math.sin(item.lessonIndex * 0.8) * 80;
        return {
            'margin-left': 'calc(50% - 30px + ' + xOffset + 'px)'
        };
    };
    
    // Build variation trail items — inserted between lessons at S-curve peaks
    function insertVariationsIntoTrail(flat) {
        if (!$scope.variationUrls || $scope.variationUrls.length === 0) return flat;
        
        var result = [];
        var varIdx = 0;
        var lessonCount = 0;
        
        for (var i = 0; i < flat.length; i++) {
            result.push(flat[i]);
            
            if (flat[i]._type === 'lesson') {
                lessonCount++;
                // Insert a variation every 3 lessons, starting after lesson 2
                if (lessonCount >= 2 && (lessonCount - 2) % 3 === 0 && varIdx < $scope.variationUrls.length) {
                    // Calculate position: opposite side of current lesson
                    var curOffset = Math.sin(flat[i].lessonIndex * 0.8) * 80;
                    result.push({
                        _type: 'variation',
                        url: $scope.variationUrls[varIdx],
                        _id: 'var_' + varIdx,
                        // Mirror: if lesson is right, variation goes left
                        variationOffset: -curOffset * 0.8
                    });
                    varIdx++;
                    if (varIdx >= $scope.variationUrls.length) varIdx = 0;
                }
            }
        }
        return result;
    }
    
    $scope.getVariationBubbleStyle = function(item) {
        if (item._type !== 'variation') return {};
        return {
            'margin-left': 'calc(50% - 30px + ' + (item.variationOffset || 0) + 'px)'
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
    
    $scope.getBubbleDynamicStyle = function(item) {
        if (item.is_unlocked === false) return {};
        var color = item.moduleColor || '#58CC02';
        var darker = darkenColor(color, 0.3);
        return { 'background': color, 'border-bottom-color': darker };
    };
    
    function darkenColor(hex, amount) {
        hex = hex.replace('#', '');
        var r = Math.max(0, parseInt(hex.substring(0, 2), 16) * (1 - amount));
        var g = Math.max(0, parseInt(hex.substring(2, 4), 16) * (1 - amount));
        var b = Math.max(0, parseInt(hex.substring(4, 6), 16) * (1 - amount));
        return '#' + Math.round(r).toString(16).padStart(2, '0') + Math.round(g).toString(16).padStart(2, '0') + Math.round(b).toString(16).padStart(2, '0');
    }
    
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
            // Check saved icon in extra first
            if (item.extra && item.extra.icon) return item.extra.icon;
            var key = (item.title || '').toLowerCase().trim();
            return SUBJECT_ICONS[key] || DEFAULT_SUBJECT_ICON;
        }
        if (item.type === 'module') return 'fa-folder';
        if (item.type === 'lesson') {
            if (item.is_unlocked === false) return 'fa-lock';
            if (item.percent >= 100) return 'fa-star';
            if (item.percent > 0) return 'fa-pen';
            return 'fa-file';
        }
        return 'fa-folder';
    };
    
    $scope.isFaIcon = function(icon) {
        return icon && icon.indexOf('fa-') === 0;
    };
    
    $scope.parentModuleColor = null; // color of the current module (when viewing lessons)
    
    $scope.getIconColor = function(item) {
        // Use saved color for modules
        if (item.type === 'module' && item._savedColor) return item._savedColor;
        // Lessons inherit parent module color
        if (item.type === 'lesson' && $scope.parentModuleColor) return $scope.parentModuleColor;
        if (item.is_unlocked === false) return '#B2BEC3';
        if (item.percent >= 100) return '#00B894';
        if (item.percent > 0) return '#FDCB6E';
        var colors = ['#FF9600', '#00B894', '#FD79A8', '#74B9FF', '#FF6B6B', '#00CEC9'];
        var idx = ($scope.items.indexOf(item)) % colors.length;
        return colors[idx];
    };
    
    $scope.getItemColor = function(item) {
        return item._savedColor || item._pickedColor || MODULE_COLORS[($scope.items.indexOf(item)) % MODULE_COLORS.length];
    };
    
    $scope.setModuleColor = function(item, color) {
        if (!color) return;
        item._savedColor = color;
        item._pickedColor = color;
        // Save to folder.extra.color — send full folder to avoid wiping fields
        ApiService.dbGet('folder', item._id).then(function(res) {
            var folder = res.data || {};
            if (!folder.extra) folder.extra = {};
            folder.extra.color = color;
            // Remove strict-mode date wrappers that would cause issues on save
            delete folder.updated;
            delete folder.created;
            return ApiService.updateFolder(item._id, folder);
        }).then(function() {
            console.log('[Trail] Module color saved:', item._id, color);
        }).catch(function(err) {
            console.error('[Trail] Failed to save module color:', err);
        });
    };
    
    $scope.openItem = function(item) {
        if (item.is_unlocked === false) return;
        var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(rootFolder) + '/folder/' : '/child/folder/';
        $location.path(base + encodeURIComponent(item._id));
    };
    
    $scope.openContent = function(c) {
        if (c.type === 'quiz') {
            $location.path('/quiz/' + encodeURIComponent(c.content)).search({ player: childId });
        }
    };
    
    $scope.navigateTo = function(b) {
        var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(rootFolder) + '/folder/' : '/child/folder/';
        $location.path(base + encodeURIComponent(b._id));
    };
    
    $scope.goBack = function() {
        ApiService.dbGet('folder', folderId).then(function(res) {
            var folder = res.data;
            if (folder && folder.parent) {
                var base = $scope.isParent ? '/parent/child/' + encodeURIComponent(rootFolder) + '/folder/' : '/child/folder/';
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
            parent: rootFolder,
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
            rootFolder: rootFolder,
            folderId: folderId,
            level: $scope.currentLevel,
            subject: $scope.currentLevel === 'subject' ? $scope.currentTitle : null,
            module: $scope.currentLevel === 'module' ? $scope.currentTitle : null
        }));
        $location.path('/capture').search({ ctx: ctx });
    };
    
    // === Pose Generation (Change 5) ===
    
    function checkAndGeneratePoses(modules) {
        if (!$scope.characterUrl) return;
        
        var missing = [];
        modules.forEach(function(mod, idx) {
            if (mod.extra && mod.extra.character_pose_url) {
                $scope.poseUrls[mod._id] = mod.extra.character_pose_url;
            } else {
                missing.push({ _id: mod._id, poseIndex: idx % POSE_PROMPTS.length });
            }
        });
        $scope.$applyAsync();
        
        if (missing.length === 0) return;
        
        // Queue them up
        poseGenerationQueue = poseGenerationQueue.concat(missing);
        if (!poseGenerating) processNextPose();
    }
    
    function processNextPose() {
        if (poseGenerationQueue.length === 0) { poseGenerating = false; return; }
        poseGenerating = true;
        
        var item = poseGenerationQueue.shift();
        var pose = POSE_PROMPTS[item.poseIndex];
        var prompt = 'Create a flat-design cartoon character in this pose: ' + pose + '. ' +
            'Match the character style from the reference image exactly. ' +
            'PROPORTIONS: Very large oversized head (about 40% of total height), small compact body, short stubby legs. Chibi/kawaii proportions. ' +
            'Style: Duolingo mascot, NO outlines, NO borders, solid flat colors, no gradients. ' +
            'Simple geometric shapes, minimal details, big round eyes, white background. ' +
            'Only ONE character, full body.';
        
        // Need to fetch the character image as base64 for the reference
        fetch($scope.characterUrl)
            .then(function(r) { return r.blob(); })
            .then(function(blob) {
                return new Promise(function(resolve) {
                    var reader = new FileReader();
                    reader.onloadend = function() { resolve(reader.result.split(',')[1]); };
                    reader.readAsDataURL(blob);
                });
            })
            .then(function(base64) {
                var proxyUrl = CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/freepik_generate';
                return fetch(proxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, prompt: prompt })
                });
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var taskId = data.response && data.response.data && data.response.data.task_id;
                if (!taskId) throw new Error('No task_id');
                return pollFreepikTask(taskId);
            })
            .then(function(imageUrl) {
                // Remove background
                var removeBgUrl = CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/freepik_remove_bg';
                return fetch(removeBgUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_url: imageUrl })
                }).then(function(r) { return r.json(); }).then(function(data) {
                    var inner = data.response || {};
                    var url = null;
                    if (inner.data && inner.data.image && inner.data.image.url) url = inner.data.image.url;
                    else if (inner.data && Array.isArray(inner.data) && inner.data[0] && inner.data[0].url) url = inner.data[0].url;
                    else if (inner.image && inner.image.url) url = inner.image.url;
                    return url || imageUrl;
                }).catch(function() { return imageUrl; });
            })
            .then(function(finalUrl) {
                // Upload permanently
                return fetch(finalUrl).then(function(r) { return r.blob(); }).then(function(blob) {
                    var formData = new FormData();
                    formData.append('file', blob, 'pose.png');
                    formData.append('extra', '{"session":"characters"}');
                    return fetch(CONFIG.API + '/v3/upload/image', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + AuthService.getToken() },
                        body: formData
                    });
                }).then(function(r) { return r.json(); }).then(function(res) {
                    return res.uploads[0].url;
                });
            })
            .then(function(permanentUrl) {
                // Save to folder extra
                $scope.poseUrls[item._id] = permanentUrl;
                $scope.$applyAsync();
                
                ApiService.dbGet('folder', item._id).then(function(res) {
                    var folder = res.data || {};
                    var extra = folder.extra || {};
                    extra.character_pose_url = permanentUrl;
                    return ApiService.updateFolder(item._id, { extra: extra });
                }).catch(function(err) { console.error('Failed to save pose URL:', err); });
                
                // Wait 60s before next
                setTimeout(processNextPose, 60000);
            })
            .catch(function(err) {
                console.warn('Pose generation failed for', item._id, err);
                setTimeout(processNextPose, 60000);
            });
    }
    
    function pollFreepikTask(taskId) {
        var proxyUrl = CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/freepik_status';
        var maxAttempts = 30;
        var attempt = 0;
        return new Promise(function(resolve, reject) {
            function check() {
                attempt++;
                if (attempt > maxAttempts) return reject(new Error('Timeout'));
                fetch(proxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_id: taskId })
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    var inner = data.response && data.response.data || data.data || {};
                    if (inner.status === 'COMPLETED') {
                        var generated = inner.generated;
                        if (generated && generated.length > 0) {
                            var img = generated[0];
                            var url = typeof img === 'string' ? img : (img.url || img.base64);
                            if (url) return resolve(url);
                        }
                        return reject(new Error('No image'));
                    } else if (inner.status === 'FAILED' || inner.status === 'ERROR') {
                        return reject(new Error('Failed'));
                    }
                    setTimeout(check, 2000);
                }).catch(reject);
            }
            setTimeout(check, 3000);
        });
    }
    
    // Resolve root_folder → player
    var paramChildId = decodeURIComponent($routeParams.childId || '');
    if (AuthService.getRole() === 'child') {
        // For child users, resolve their own root_folder
        var childUser = AuthService.getUser();
        ApiService.getPlayer(childUser).then(function(res) {
            var rf = (res.data && res.data.extra && res.data.extra.root_folder) || childUser;
            initController(childUser, rf);
        }).catch(function() {
            initController(childUser, null);
        });
    } else {
        ApiService.resolveChild(paramChildId).then(function(player) {
            initController(player._id, paramChildId);
        }).catch(function() {
            // Fallback: try paramChildId as player _id (legacy)
            initController(paramChildId, paramChildId);
        });
    }
});
