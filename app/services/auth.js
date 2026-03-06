// AuthService — handles login, signup, token management
app.factory('AuthService', function($http, $q) {
    var TOKEN_KEY = 'tutor_token';
    var USER_KEY = 'tutor_user';
    var ROLE_KEY = 'tutor_role';
    
    return {
        getToken: function() {
            return localStorage.getItem(TOKEN_KEY);
        },
        getUser: function() {
            return localStorage.getItem(USER_KEY);
        },
        getRole: function() {
            return localStorage.getItem(ROLE_KEY) || 'parent';
        },
        isLoggedIn: function() {
            return !!localStorage.getItem(TOKEN_KEY);
        },
        setAuth: function(token, user, role) {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, user);
            localStorage.setItem(ROLE_KEY, role || 'parent');
        },
        login: function(email, password) {
            return $http.post(CONFIG.API + '/v3/auth/token', {
                grant_type: 'password',
                apiKey: CONFIG.API_KEY,
                username: email,
                password: password
            });
        },
        logout: function() {
            this.clearUserData();
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(ROLE_KEY);
        },
        clearUserData: function() {
            // Clear all tutor_ prefixed keys
            var keys = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf('tutor_') === 0) {
                    keys.push(key);
                }
            }
            keys.forEach(function(k) { localStorage.removeItem(k); });
        },
        authHeader: function() {
            return { headers: { 'Authorization': 'Bearer ' + this.getToken() } };
        },
        basicHeader: function() {
            return { headers: { 'Authorization': CONFIG.BASIC_TOKEN } };
        },
        signup: function(data) {
            return $http.put(
                CONFIG.API + '/v3/database/signup__c',
                data,
                { headers: { 'Authorization': CONFIG.BASIC_TOKEN } }
            );
        }
    };
});
