// Exams Controller — Exam Calendar for Parents
app.controller('ExamsController', function($scope, $location, $routeParams, AuthService, ApiService) {
    var childId = $routeParams.childId;
    var parentId = AuthService.getUser();
    
    $scope.childName = '';
    $scope.exams = [];
    $scope.subjects = [];
    $scope.loading = true;
    $scope.showForm = false;
    $scope.form = { subject: '', topic: '', date: null, notes: '' };
    
    $scope.goBack = function() {
        $location.path('/parent/child/' + childId);
    };
    
    $scope.toggleForm = function() {
        $scope.showForm = !$scope.showForm;
    };
    
    $scope.formatDate = function(d) {
        if (!d) return '';
        var date = d.$date ? new Date(d.$date) : new Date(d);
        return date.toLocaleDateString('pt-BR');
    };
    
    function enrichExam(exam) {
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        var d = exam.date && exam.date.$date ? new Date(exam.date.$date) : new Date(exam.date);
        d.setHours(0, 0, 0, 0);
        var diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
        exam._daysUntil = diff;
        exam._isPast = diff < 0;
        if (diff < 0) exam._urgencyColor = '#B2BEC3';
        else if (diff < 3) exam._urgencyColor = '#FF6B6B';
        else if (diff < 7) exam._urgencyColor = '#FDCB6E';
        else exam._urgencyColor = '#00B894';
        return exam;
    }
    
    async function loadData() {
        try {
            // Load child name
            try {
                var pRes = await ApiService.getPlayer(childId);
                var player = pRes.data || pRes;
                $scope.childName = (player.extra && player.extra.name__c) || player.name || '';
            } catch(e) {}
            
            // Load subjects (folders)
            try {
                var fq = JSON.stringify({ player: childId, parent: { $exists: false } });
                var fRes = await ApiService.dbQuery('folder', fq, null, 50);
                $scope.subjects = fRes.data || [];
            } catch(e) {}
            
            // Load exams
            try {
                var eq = JSON.stringify({ player: childId });
                var pipeline = [
                    { $match: { player: childId } },
                    { $sort: { date: 1 } }
                ];
                var eRes = await ApiService.dbQuery('exam__c', eq, { date: 1 }, 100);
                var list = eRes.data || [];
                $scope.exams = list.map(enrichExam);
            } catch(e) {}
            
            $scope.loading = false;
            $scope.$applyAsync();
        } catch(e) {
            $scope.loading = false;
            $scope.$applyAsync();
        }
    }
    
    $scope.saveExam = async function() {
        if (!$scope.form.subject || !$scope.form.date) return;
        
        var examDate = new Date($scope.form.date);
        var doc = {
            _id: 'exam_' + Date.now(),
            player: childId,
            parent: parentId,
            subject: $scope.form.subject,
            topic: $scope.form.topic || '',
            date: { $date: examDate.toISOString() },
            notes: $scope.form.notes || ''
        };
        
        try {
            await ApiService.dbSave('exam__c', doc);
            $scope.exams.push(enrichExam(doc));
            $scope.exams.sort(function(a, b) { return a._daysUntil - b._daysUntil; });
            $scope.form = { subject: '', topic: '', date: null, notes: '' };
            $scope.showForm = false;
            $scope.$applyAsync();
        } catch(e) {
            alert('Erro ao salvar prova');
        }
    };
    
    $scope.deleteExam = async function(exam) {
        if (!confirm('Excluir prova de ' + exam.subject + '?')) return;
        try {
            await ApiService.dbDelete('exam__c', JSON.stringify({ _id: exam._id }));
            var idx = $scope.exams.indexOf(exam);
            if (idx >= 0) $scope.exams.splice(idx, 1);
            $scope.$applyAsync();
        } catch(e) {
            alert('Erro ao excluir');
        }
    };
    
    loadData();
});
