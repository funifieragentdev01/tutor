// ApiService — Funifier API wrapper
app.factory('ApiService', function($http, AuthService) {
    var API = CONFIG.API;
    
    // Helper: convert BSON date to JS Date
    function readDate(d) {
        if (!d) return null;
        if (d.$date) return new Date(d.$date);
        if (typeof d === 'string') return new Date(d);
        if (typeof d === 'number') return new Date(d);
        return d;
    }
    
    // Helper: create BSON date
    function bsonDate(d) {
        return { $date: (d || new Date()).toISOString() };
    }
    
    return {
        readDate: readDate,
        bsonDate: bsonDate,
        
        // Resolve child by root_folder GUID
        resolveChild: function(rootFolder) {
            var q = encodeURIComponent(JSON.stringify({"extra.root_folder": rootFolder}));
            return $http({
                method: 'POST',
                url: API + '/v3/database/player/aggregate?q=' + q + '&strict=true',
                headers: {
                    'Authorization': 'Bearer ' + AuthService.getToken(),
                    'Range': 'items=0-1'
                },
                data: []
            }).then(function(res) {
                var players = res.data || [];
                if (players.length > 0) return players[0];
                throw new Error('Child not found');
            });
        },
        
        // Get player profile
        getPlayer: function(userId) {
            return $http.get(
                API + '/v3/player/' + encodeURIComponent(userId),
                AuthService.authHeader()
            );
        },
        
        // Get/save profile__c (extended profile data)
        getProfile: function(userId) {
            return $http.get(
                API + "/v3/database/profile__c?strict=true&q=_id:'" + userId + "'",
                AuthService.authHeader()
            ).then(function(res) {
                // q= returns array, normalize to single object in .data
                var arr = res.data;
                if (Array.isArray(arr) && arr.length > 0) {
                    res.data = arr[0];
                } else if (Array.isArray(arr)) {
                    res.data = null;
                }
                return res;
            });
        },
        saveProfile: function(data) {
            return $http.put(
                API + '/v3/database/profile__c',
                data,
                AuthService.authHeader()
            );
        },
        
        // Folder operations (learning trails)
        // Breadcrumb: returns array of folders from root to given folder (correct order)
        getFolderBreadcrumb: function(folderId) {
            return $http.post(
                API + '/v3/folder/breadcrumb',
                { folder: folderId },
                AuthService.authHeader()
            );
        },
        
        getFolderInside: function(folderId) {
            return $http.post(
                API + '/v3/folder/inside',
                { folder: folderId },
                AuthService.authHeader()
            );
        },
        getFolderProgress: function(folderId, playerId) {
            return $http.post(
                API + '/v3/folder/progress',
                { folder: folderId, player: playerId },
                AuthService.authHeader()
            );
        },
        createFolder: function(data) {
            return $http.post(
                API + '/v3/folder',
                data,
                AuthService.authHeader()
            );
        },
        updateFolder: function(id, data) {
            data._id = id;
            return $http.put(
                API + '/v3/folder',
                data,
                AuthService.authHeader()
            );
        },
        logFolderItem: function(itemId, playerId, percent) {
            var data = { item: itemId, player: playerId, status: 'done', finished: new Date().toISOString() };
            if (percent !== undefined) data.percent = percent;
            return $http.post(
                API + '/v3/folder/log',
                data,
                AuthService.authHeader()
            );
        },
        
        // Database generic
        dbGet: function(collection, id) {
            return $http.get(
                API + "/v3/database/" + collection + "?strict=true&q=_id:'" + id + "'",
                AuthService.authHeader()
            ).then(function(res) {
                // q= returns array, normalize to single object
                var arr = res.data;
                if (Array.isArray(arr) && arr.length > 0) {
                    res.data = arr[0];
                } else if (Array.isArray(arr)) {
                    res.data = null;
                }
                return res;
            });
        },
        dbSave: function(collection, data) {
            return $http.put(
                API + '/v3/database/' + collection,
                data,
                AuthService.authHeader()
            );
        },
        dbQuery: function(collection, query, sort, limit) {
            var q = encodeURIComponent(query || '');
            var sortStage = sort ? [{ $sort: sort }] : [];
            var lim = limit || 20;
            // Range header format: items=skip-limit (NOT start-end)
            return $http({
                method: 'POST',
                url: API + '/v3/database/' + collection + '/aggregate?q=' + q + '&strict=true',
                headers: {
                    'Authorization': 'Bearer ' + AuthService.getToken(),
                    'Range': 'items=0-' + lim
                },
                data: sortStage
            });
        },
        dbDelete: function(collection, query) {
            return $http({
                method: 'DELETE',
                url: API + '/v3/database/' + collection + '?q=' + encodeURIComponent(query),
                headers: { 'Authorization': 'Bearer ' + AuthService.getToken() }
            });
        },
        
        // Upload image to Funifier S3 (returns URL)
        uploadImage: function(blob, filename) {
            var fd = new FormData();
            fd.append('file', blob, filename || 'image.jpg');
            fd.append('extra', JSON.stringify({ session: 'images' }));
            return $http.post(API + '/v3/upload/image', fd, {
                headers: {
                    'Authorization': 'Bearer ' + AuthService.getToken(),
                    'Content-Type': undefined
                },
                transformRequest: angular.identity
            }).then(function(res) {
                var uploads = res.data && res.data.uploads;
                return (uploads && uploads.length > 0) ? uploads[0].url : null;
            });
        },
        
        // Update player via PUT /v3/player/:id
        updatePlayer: function(playerId, data) {
            return $http.put(
                API + '/v3/player/' + encodeURIComponent(playerId),
                data,
                AuthService.authHeader()
            );
        },
        
        // Delete player via /v3/player/:id (fires player triggers with full player object)
        deletePlayer: function(playerId) {
            return $http({
                method: 'DELETE',
                url: API + '/v3/player/' + encodeURIComponent(playerId),
                headers: { 'Authorization': 'Bearer ' + AuthService.getToken() }
            });
        },
        
        // Delete folder (cascade: subfolders, folder_content, folder_log)
        // Note: quiz/question NOT deleted by cascade when content_type input=repository
        deleteFolder: function(folderId) {
            return $http({
                method: 'DELETE',
                url: API + '/v3/folder/' + encodeURIComponent(folderId),
                headers: { 'Authorization': 'Bearer ' + AuthService.getToken() }
            });
        },
        
        // Delete folder content
        deleteFolderContent: function(contentId) {
            return $http({
                method: 'DELETE',
                url: API + '/v3/folder/content/' + encodeURIComponent(contentId),
                headers: { 'Authorization': 'Bearer ' + AuthService.getToken() }
            });
        },
        
        // Delete quiz (cascade: questions, quiz_log, question_log)
        deleteQuiz: function(quizId) {
            return $http({
                method: 'DELETE',
                url: API + '/v3/quiz/' + encodeURIComponent(quizId),
                headers: { 'Authorization': 'Bearer ' + AuthService.getToken() }
            });
        },
        
        // Delete folder and clean up all quizzes inside (recursive)
        deleteFolderWithQuizzes: function(folderId) {
            var self = this;
            // 1. Find all folder_content under this folder tree
            return self.findQuizzesInFolder(folderId).then(function(quizIds) {
                // 2. Delete each quiz (cascade deletes questions)
                var promises = quizIds.map(function(qid) {
                    return self.deleteQuiz(qid).catch(function() {}); // ignore errors
                });
                return Promise.all(promises);
            }).then(function() {
                // 3. Delete folder (cascade deletes subfolders, folder_content, logs)
                return self.deleteFolder(folderId);
            });
        },
        
        // Recursively find all quiz IDs inside a folder tree
        findQuizzesInFolder: function(folderId) {
            var self = this;
            var quizIds = [];
            
            // Get contents of this folder
            return self.dbQuery('folder_content', 'parent:"' + folderId + '"', null, 100).then(function(res) {
                var contents = res.data || [];
                contents.forEach(function(c) {
                    if (c.type === 'quiz' && c.content) {
                        quizIds.push(c.content);
                    }
                });
                
                // Get child folders
                return self.dbQuery('folder', 'parent:"' + folderId + '"', null, 100);
            }).then(function(res) {
                var childFolders = res.data || [];
                // Recurse into each child folder
                var childPromises = childFolders.map(function(f) {
                    return self.findQuizzesInFolder(f._id);
                });
                return Promise.all(childPromises);
            }).then(function(childResults) {
                childResults.forEach(function(ids) {
                    quizIds = quizIds.concat(ids);
                });
                return quizIds;
            });
        }
    };
});
