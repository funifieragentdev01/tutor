app.controller('QuizController', function($scope, $location, $routeParams, $timeout, AuthService, ApiService) {
    var quizId = $routeParams.quizId;
    // Player: use query param (child ID when parent views child's trail) or logged-in user
    var playerId = $location.search().player || AuthService.getUser();
    var isParent = playerId !== AuthService.getUser();
    $scope.isParentTest = isParent;
    
    $scope.questions = [];
    $scope.currentIndex = 0;
    $scope.currentQuestion = null;
    $scope.selectedChoice = null;
    $scope.revealed = false;
    $scope.lastCorrect = false;
    $scope.correctLabel = '';
    $scope.wrongFeedback = '';
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
    
    // Sound settings
    $scope.feedbackSound = 'beep'; // default
    $scope.customSoundUrl = null;
    
    function init() {
        // Load child's feedback sound from profile
        ApiService.dbGet('profile__c', playerId).then(function(res) {
            var profile = res.data || {};
            $scope.feedbackSound = profile.feedback_sound || 'beep';
            $scope.customSoundUrl = profile.custom_sound_url || null;
            console.log('[Quiz] Loaded feedback sound:', $scope.feedbackSound, $scope.customSoundUrl);
        }).catch(function() {
            console.log('[Quiz] Could not load profile, using default sound');
        });
        
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
            
            // Get wrong answer feedback
            $scope.wrongFeedback = '';
            if ($scope.currentQuestion.feedbacks) {
                var wrongFeedback = $scope.currentQuestion.feedbacks.find(function(f) { 
                    return f.event === 'wrong'; 
                });
                if (wrongFeedback) {
                    $scope.wrongFeedback = wrongFeedback.message;
                }
            }
            
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
        $scope.wrongFeedback = '';
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
        
        // Only log completion when the player is the logged-in user (child playing)
        // Parent testing does NOT register progress for the child
        if (!isParent) {
            logCompletion();
        }
        
        if ($scope.scorePercent >= 80) {
            triggerCelebration();
            if ($scope.scorePercent === 100) {
                $timeout(function() { triggerCelebration(); }, 500);
                $timeout(function() { triggerCelebration(); }, 1000);
            }
        }
    }
    
    function logCompletion() {
        console.log('[Quiz] logCompletion: quizId=' + quizId + ', player=' + playerId + ', score=' + $scope.scorePercent);
        
        // Find the folder_content that references this quiz
        ApiService.dbQuery('folder_content', 'content:"' + quizId + '"', null, 1).then(function(res) {
            console.log('[Quiz] folder_content found:', JSON.stringify(res.data));
            var fc = res.data && res.data[0];
            if (fc) {
                // Log content (folder_content) completion
                ApiService.logFolderItem(fc._id, playerId, $scope.scorePercent).then(function(logRes) {
                    console.log('[Quiz] folder_log content OK:', JSON.stringify(logRes.data));
                }).catch(function(err) {
                    console.error('[Quiz] folder_log content FAIL:', err);
                });
            } else {
                console.warn('[Quiz] No folder_content found for quiz ' + quizId);
            }
        }).catch(function(err) {
            console.error('[Quiz] dbQuery folder_content FAIL:', err);
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
            if (type === 'correct') {
                var soundFile;
                var soundMap = {
                    'beep': 'audio/beep.mp3',
                    'car': 'audio/car.mp3',
                    'magic': 'audio/magic.mp3',
                    'applause': 'audio/applause.mp3',
                    'coin': 'audio/coin.mp3',
                    'levelup': 'audio/levelup.mp3',
                    'whoosh': 'audio/whoosh.mp3',
                    'pop': 'audio/pop.mp3'
                };
                
                if ($scope.feedbackSound === 'custom' && $scope.customSoundUrl) {
                    soundFile = $scope.customSoundUrl;
                } else {
                    soundFile = soundMap[$scope.feedbackSound] || 'audio/beep.mp3';
                }
                
                console.log('[Quiz] Playing sound:', soundFile);
                var audio = new Audio(soundFile);
                audio.play();
            }
        } catch(e) {
            console.error('[Quiz] Error playing sound:', e);
        }
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
