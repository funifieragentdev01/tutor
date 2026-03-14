app.controller('ContactController', function($scope, $location, $http) {
    $scope.form = {};
    $scope.sending = false;
    $scope.sent = false;

    $scope.goBack = function() { $location.path('/landing'); };

    $scope.send = function() {
        if (!$scope.form.name || !$scope.form.email || !$scope.form.message) {
            alert('Preencha nome, email e mensagem.');
            return;
        }
        $scope.sending = true;
        var data = {
            name: $scope.form.name,
            email: $scope.form.email,
            subject: $scope.form.subject || 'outro',
            message: $scope.form.message,
            read: false,
            created: { $date: new Date().toISOString() }
        };
        $http.put(CONFIG.API + '/v3/database/contact__c', data, {
            headers: { 'Authorization': CONFIG.BASIC_TOKEN, 'Content-Type': 'application/json' }
        }).then(function() {
            $scope.sent = true;
            $scope.sending = false;
        }).catch(function() {
            alert('Erro ao enviar. Tente novamente.');
            $scope.sending = false;
        });
    };
});
