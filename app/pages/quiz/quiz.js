app.controller('QuizController', function($scope, $location, $routeParams, $timeout, AuthService, ApiService) {
    var quizId = $routeParams.quizId;
    
    $scope.questions = [];
    $scope.currentIndex = 0;
    $scope.currentQuestion = null;
    $scope.selectedChoice = null;
    $scope.revealed = false;
    $scope.lastCorrect = false;
    $scope.correctLabel = '';
    $scope.finished = false;
    $scope.loading = true;
    $scope.shakeCard = false;
    $scope.showConfetti = false;
    $scope.correctCount = 0;
    $scope.scorePercent = 0;
    $scope.xpEarned = 0;
    $scope.progressPercent = 0;
    $scope.progressColor = '#6C5CE7';
    
    $scope.correctMessages = [
        'Isso aí! 🎉', 'Mandou bem! 💪', 'Certinho! ⭐', 'Arrasou! 🔥',
        'Perfeito! 🌟', 'Demais! 🚀', 'Incrível! 🏆', 'Show! 👏'
    ];
    $scope.correctMsgIndex = 0;
    
    function init() {
        // Load questions for this quiz
        ApiService.dbQuery('question', 'quiz:"' + quizId + '"', { _id: 1 }, 50).then(function(res) {
            $scope.questions = res.data || [];
            if ($scope.questions.length > 0) {
                $scope.currentQuestion = $scope.questions[0];
                updateProgress();
            }
            $scope.loading = false;
        }).catch(function() {
            $scope.loading = false;
        });
    }
    
    function updateProgress() {
        $scope.progressPercent = Math.round(($scope.currentIndex / $scope.questions.length) * 100);
    }
    
    $scope.selectChoice = function(choice) {
        if ($scope.revealed) return;
        $scope.selectedChoice = choice;
    };
    
    $scope.confirmChoice = function() {
        if (!$scope.selectedChoice || $scope.revealed) return;
        $scope.revealed = true;
        $scope.lastCorrect = $scope.selectedChoice.grade > 0;
        
        if ($scope.lastCorrect) {
            $scope.correctCount++;
            $scope.correctMsgIndex = Math.floor(Math.random() * $scope.correctMessages.length);
            // Random surprise celebration (variable ratio reinforcement)
            if (Math.random() > 0.5) {
                triggerCelebration();
            }
            playSound('correct');
        } else {
            // Find correct answer label
            var correct = $scope.currentQuestion.choices.filter(function(c) { return c.grade > 0; });
            $scope.correctLabel = correct.length > 0 ? correct[0].label : '?';
            $scope.shakeCard = true;
            $timeout(function() { $scope.shakeCard = false; }, 500);
            playSound('wrong');
        }
        
        $scope.progressColor = $scope.lastCorrect ? '#00B894' : '#FF6B6B';
    };
    
    $scope.nextQuestion = function() {
        $scope.currentIndex++;
        $scope.selectedChoice = null;
        $scope.revealed = false;
        $scope.progressColor = '#6C5CE7';
        
        if ($scope.currentIndex >= $scope.questions.length) {
            // Quiz finished
            finishQuiz();
        } else {
            $scope.currentQuestion = $scope.questions[$scope.currentIndex];
            updateProgress();
        }
    };
    
    function finishQuiz() {
        $scope.finished = true;
        $scope.scorePercent = Math.round(($scope.correctCount / $scope.questions.length) * 100);
        $scope.xpEarned = $scope.correctCount * 10;
        $scope.progressPercent = 100;
        
        if ($scope.scorePercent >= 80) {
            triggerCelebration();
            // Epic celebration for 100%
            if ($scope.scorePercent === 100) {
                $timeout(function() { triggerCelebration(); }, 500);
                $timeout(function() { triggerCelebration(); }, 1000);
            }
            
            // Log completion to Funifier folder system
            logCompletion();
        }
    }
    
    function logCompletion() {
        // Find the folder_content that references this quiz
        ApiService.dbQuery('folder_content', 'content:"' + quizId + '"', null, 1).then(function(res) {
            var fc = res.data && res.data[0];
            if (fc && fc.parent) {
                var playerId = AuthService.getUser();
                ApiService.logFolderItem(fc._id, playerId);
                // Also log the lesson folder
                ApiService.logFolderItem(fc.parent, playerId);
            }
        });
    }
    
    function triggerCelebration() {
        $scope.showConfetti = true;
        // Vibrate if supported
        if (navigator.vibrate) navigator.vibrate(100);
        $timeout(function() { $scope.showConfetti = false; }, 2000);
    }
    
    function playSound(type) {
        try {
            var freq = type === 'correct' ? 800 : 300;
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.value = 0.15;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.stop(ctx.currentTime + 0.3);
            
            if (type === 'correct') {
                // Second tone for correct (happy sound)
                var osc2 = ctx.createOscillator();
                var gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 1000;
                osc2.type = 'sine';
                gain2.gain.value = 0.15;
                osc2.start(ctx.currentTime + 0.15);
                gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
                osc2.stop(ctx.currentTime + 0.45);
            }
        } catch(e) {}
    }
    
    $scope.retryQuiz = function() {
        $scope.currentIndex = 0;
        $scope.selectedChoice = null;
        $scope.revealed = false;
        $scope.finished = false;
        $scope.correctCount = 0;
        $scope.scorePercent = 0;
        $scope.progressPercent = 0;
        $scope.progressColor = '#6C5CE7';
        $scope.currentQuestion = $scope.questions[0];
        
        // Shuffle questions for retry
        $scope.questions.sort(function() { return Math.random() - 0.5; });
        $scope.currentQuestion = $scope.questions[0];
    };
    
    $scope.exitQuiz = function() {
        window.history.back();
    };
    
    init();
});
