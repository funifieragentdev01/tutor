app.controller('LandingController', function($scope, $location, $http, $sce) {
    $scope.mobileMenu = false;
    $scope.faqs = [];
    $scope.faqOpen = {};
    $scope.showTermsModal = false;
    $scope.termsTab = 'terms';
    $scope.termsHtml = '';
    $scope.privacyHtml = '';

    var API = CONFIG.API;
    var BASIC_TOKEN = CONFIG.BASIC_TOKEN;

    $scope.goSignup = function() {
        $location.path('/signup');
    };
    $scope.goLogin = function() {
        $location.path('/login');
    };
    $scope.goChildLogin = function() {
        $location.path('/login').search({ type: 'aluno' });
    };
    $scope.scrollTo = function(id) {
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    // Load FAQ
    $http.get(API + '/v3/database/faq__c?sort=order:1&q=active:true', {
        headers: { 'Authorization': BASIC_TOKEN }
    }).then(function(res) {
        if (Array.isArray(res.data)) {
            $scope.faqs = res.data;
        }
    }).catch(function() {});

    $scope.toggleFaq = function(id) {
        $scope.faqOpen[id] = !$scope.faqOpen[id];
    };

    // Terms / Privacy modal
    $scope.openTerms = function($event) {
        if ($event) $event.preventDefault();
        $scope.termsTab = 'terms';
        $scope.showTermsModal = true;
        loadTermsContent();
    };
    $scope.openPrivacy = function($event) {
        if ($event) $event.preventDefault();
        $scope.termsTab = 'privacy';
        $scope.showTermsModal = true;
        loadTermsContent();
    };
    $scope.closeTermsModal = function() {
        $scope.showTermsModal = false;
    };

    function loadTermsContent() {
        if ($scope.termsHtml && $scope.privacyHtml) return;
        $http.get(API + '/v3/database/legal__c?q=active:true', {
            headers: { 'Authorization': BASIC_TOKEN }
        }).then(function(res) {
            if (Array.isArray(res.data)) {
                res.data.forEach(function(doc) {
                    if (doc.type === 'terms') $scope.termsHtml = $sce.trustAsHtml(doc.content || '');
                    if (doc.type === 'privacy') $scope.privacyHtml = $sce.trustAsHtml(doc.content || '');
                });
            }
        }).catch(function() {});
    }
});
