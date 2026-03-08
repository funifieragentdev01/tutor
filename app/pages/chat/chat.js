// Chat Controller — AI Teacher Chat
app.controller('ChatController', function($scope, $location, $routeParams, $sce, AuthService, ApiService) {
    var childId = $routeParams.childId || AuthService.getUser();
    var isParent = AuthService.getRole() === 'parent';
    
    $scope.messages = [];
    $scope.userInput = '';
    $scope.typing = false;
    $scope.loading = true;
    
    var childProfile = null;
    var childPlayer = null;
    var folders = [];
    var systemPrompt = '';
    
    // Go back
    $scope.goBack = function() {
        if (isParent) {
            $location.path('/parent/child/' + childId);
        } else {
            $location.path('/child');
        }
    };
    
    // Format message with line breaks
    $scope.formatMessage = function(text) {
        if (!text) return '';
        var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Bold
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Line breaks
        escaped = escaped.replace(/\n/g, '<br>');
        return $sce.trustAsHtml(escaped);
    };
    
    // Format timestamp
    $scope.formatTime = function(ts) {
        if (!ts) return '';
        var d = ts.$date ? new Date(ts.$date) : new Date(ts);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    
    // Scroll to bottom
    function scrollToBottom() {
        setTimeout(function() {
            var el = document.getElementById('chatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);
    }
    
    // Build system prompt from child data
    function buildSystemPrompt() {
        var name = 'aluno(a)';
        var age = '';
        var interests = '';
        var subjects = '';
        
        if (childPlayer && childPlayer.extra) {
            name = childPlayer.extra.name__c || childPlayer.name || name;
        } else if (childPlayer) {
            name = childPlayer.name || name;
        }
        
        if (childProfile) {
            if (childProfile.age__c) age = childProfile.age__c;
            if (childProfile.interests__c) interests = childProfile.interests__c;
        }
        
        if (folders.length > 0) {
            subjects = folders.map(function(f) { return f.name || f.title; }).filter(Boolean).join(', ');
        }
        
        systemPrompt = 'Você é o Professor Tutor, um professor particular virtual para crianças. ' +
            'Seu nome é Professor Tutor. Fale sempre em Português do Brasil.\n\n' +
            'ALUNO: ' + name + (age ? ' (' + age + ' anos)' : '') + '\n' +
            (interests ? 'INTERESSES: ' + interests + '\n' : '') +
            (subjects ? 'MATÉRIAS: ' + subjects + '\n' : '') +
            '\nREGRAS:\n' +
            '- Seja paciente, encorajador e divertido\n' +
            '- Use emojis ocasionalmente para tornar a conversa mais leve\n' +
            '- Adapte suas explicações à idade da criança\n' +
            '- Faça perguntas de acompanhamento para verificar o entendimento\n' +
            '- Sugira praticar com quiz quando apropriado\n' +
            '- Respostas curtas e objetivas (máximo 3-4 parágrafos)\n' +
            '- Elogie o esforço do aluno\n' +
            '- Se não souber algo, seja honesto';
    }
    
    // Load context data
    async function loadContext() {
        try {
            // Load player
            try {
                childPlayer = await ApiService.getPlayer(childId);
            } catch(e) {}
            
            // Load profile
            try {
                childProfile = await ApiService.getProfile(childId);
            } catch(e) {}
            
            // Load folders (subjects)
            try {
                var q = JSON.stringify({ player: childId, parent: { $exists: false } });
                folders = await ApiService.dbQuery('folder__c', q);
            } catch(e) {}
            
            buildSystemPrompt();
            
            // Load chat history
            try {
                var pipeline = [
                    { $match: { player: childId } },
                    { $sort: { timestamp: -1 } },
                    { $limit: 20 }
                ];
                var history = await ApiService.dbAggregate('chat_message__c', pipeline);
                if (history && history.length) {
                    $scope.messages = history.reverse();
                }
            } catch(e) {}
            
            $scope.loading = false;
            $scope.$applyAsync();
            scrollToBottom();
        } catch(e) {
            $scope.loading = false;
            $scope.$applyAsync();
        }
    }
    
    // Send message
    $scope.sendMessage = function(text) {
        var content = text || ($scope.userInput || '').trim();
        if (!content || $scope.typing) return;
        
        $scope.userInput = '';
        
        // Add user message
        var userMsg = {
            _id: 'msg_' + Date.now() + '_u',
            player: childId,
            role: 'user',
            content: content,
            timestamp: { $date: new Date().toISOString() }
        };
        $scope.messages.push(userMsg);
        $scope.typing = true;
        scrollToBottom();
        
        // Save user message
        ApiService.dbSave('chat_message__c', userMsg).catch(function() {});
        
        // Build messages for OpenAI
        var apiMessages = [{ role: 'system', content: systemPrompt }];
        var recent = $scope.messages.slice(-10);
        recent.forEach(function(m) {
            apiMessages.push({ role: m.role, content: m.content });
        });
        
        // Call OpenAI
        fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: apiMessages,
                max_tokens: 500,
                temperature: 0.7
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var reply = data.choices && data.choices[0] && data.choices[0].message.content;
            if (!reply) reply = 'Desculpe, tive um probleminha. Pode tentar de novo? 😅';
            
            var assistantMsg = {
                _id: 'msg_' + Date.now() + '_a',
                player: childId,
                role: 'assistant',
                content: reply,
                timestamp: { $date: new Date().toISOString() }
            };
            $scope.messages.push(assistantMsg);
            $scope.typing = false;
            $scope.$applyAsync();
            scrollToBottom();
            
            // Save assistant message
            ApiService.dbSave('chat_message__c', assistantMsg).catch(function() {});
        })
        .catch(function() {
            $scope.typing = false;
            var errorMsg = {
                _id: 'msg_' + Date.now() + '_e',
                player: childId,
                role: 'assistant',
                content: 'Opa, algo deu errado. Tenta de novo? 🔄',
                timestamp: { $date: new Date().toISOString() }
            };
            $scope.messages.push(errorMsg);
            $scope.$applyAsync();
            scrollToBottom();
        });
    };
    
    // Enter key
    $scope.onKeyPress = function(e) {
        if (e.which === 13) $scope.sendMessage();
    };
    
    // Init
    loadContext();
});
