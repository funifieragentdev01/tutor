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
        
        // Get player profile
        getPlayer: function(userId) {
            return $http.get(
                API + '/v3/database/player/' + encodeURIComponent(userId) + '?strict=true',
                AuthService.authHeader()
            );
        },
        
        // Get/save profile__c (extended profile data)
        getProfile: function(userId) {
            return $http.get(
                API + '/v3/database/profile__c/' + encodeURIComponent(userId) + '?strict=true',
                AuthService.authHeader()
            );
        },
        saveProfile: function(data) {
            return $http.put(
                API + '/v3/database/profile__c',
                data,
                AuthService.authHeader()
            );
        },
        
        // Folder operations (learning trails)
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
        logFolderItem: function(itemId, playerId) {
            return $http.post(
                API + '/v3/folder/log',
                { item: itemId, player: playerId, status: 'done', finished: bsonDate() },
                AuthService.authHeader()
            );
        },
        
        // Database generic
        dbGet: function(collection, id) {
            return $http.get(
                API + '/v3/database/' + collection + '/' + encodeURIComponent(id) + '?strict=true',
                AuthService.authHeader()
            );
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
            var rangeEnd = (limit || 20) - 1;
            return $http({
                method: 'POST',
                url: API + '/v3/database/' + collection + '/aggregate?q=' + q + '&strict=true',
                headers: {
                    'Authorization': 'Bearer ' + AuthService.getToken(),
                    'Range': 'items=0-' + rangeEnd
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
        }
    };
});
