// Chat Controller — AI Teacher Chat + Voice Call
app.controller('ChatController', function($scope, $location, $routeParams, $sce, AuthService, ApiService) {
    var childId = $routeParams.childId || AuthService.getUser();
    var isParent = AuthService.getRole() === 'parent';
    
    $scope.messages = [];
    $scope.userInput = '';
    $scope.typing = false;
    $scope.loading = true;
    
    // Voice mode
    $scope.mode = 'text'; // 'text' or 'voice'
    $scope.callStatus = 'idle'; // idle, connecting, connected
    $scope.callStatusText = '';
    $scope.isMuted = false;
    $scope.callDuration = '00:00';
    $scope.transcriptLines = [];
    $scope.currentTeacherText = '';
    
    var pc = null;
    var dc = null;
    var audioEl = null;
    var localStream = null;
    var sessionData = null;
    var callTimer = null;
    var callStartTime = null;
    
    var childProfile = null;
    var childPlayer = null;
    var folders = [];
    var systemPrompt = '';
    
    // Go back
    $scope.goBack = function() {
        if ($scope.mode === 'voice') {
            $scope.endCall();
            return;
        }
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
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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
    
    function scrollTranscript() {
        setTimeout(function() {
            var el = document.getElementById('callTranscript');
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
            try { childPlayer = await ApiService.getPlayer(childId); } catch(e) {}
            try { childProfile = await ApiService.getProfile(childId); } catch(e) {}
            try {
                var q = JSON.stringify({ player: childId, parent: { $exists: false } });
                folders = await ApiService.dbQuery('folder__c', q);
            } catch(e) {}
            
            buildSystemPrompt();
            
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
        
        ApiService.dbSave('chat_message__c', userMsg).catch(function() {});
        
        var apiMessages = [{ role: 'system', content: systemPrompt }];
        var recent = $scope.messages.slice(-10);
        recent.forEach(function(m) {
            apiMessages.push({ role: m.role, content: m.content });
        });
        
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
    
    // ==================== VOICE MODE ====================
    
    function buildVoiceInstructions(data) {
        var name = data.player_name || 'aluno';
        var age = '';
        var description = '';
        var interests = '';
        var subjects = '';
        var quizInfo = '';
        
        if (data.profile) {
            age = data.profile.age || data.profile.age__c || '';
            description = data.profile.description || '';
            interests = data.profile.interests || data.profile.interests__c || '';
        }
        
        if (data.folders && data.folders.length > 0) {
            subjects = data.folders.map(function(f) { return f.name || f.title || ''; }).filter(Boolean).join(', ');
        }
        
        if (data.quiz_results && data.quiz_results.length > 0) {
            quizInfo = data.quiz_results.map(function(q) {
                return (q.subject || q.folder_name || 'Quiz') + ': ' + (q.score != null ? q.score + ' pontos' : 'feito');
            }).join('; ');
        }
        
        var instr = 'Voce eh o Professor Tutor, professor particular virtual para criancas. ' +
            'IDIOMA: SEMPRE fale em PORTUGUES BRASILEIRO. ' +
            'Tom: paciente, encorajador, divertido, use linguagem adequada para a idade da crianca. ' +
            'Voce ja conhece este aluno. NAO pergunte quem ele eh. Comece cumprimentando pelo nome.\n\n' +
            'ALUNO: ' + name + (age ? ' (' + age + ' anos)' : '') + '\n';
        
        if (description) instr += 'DESCRICAO DO ALUNO (escrita pelos pais): ' + description + '\n';
        if (interests) instr += 'INTERESSES: ' + interests + '\n';
        if (subjects) instr += 'MATERIAS QUE ESTUDA: ' + subjects + '\n';
        if (quizInfo) instr += 'DESEMPENHO RECENTE EM QUIZ: ' + quizInfo + '\n';
        
        instr += '\nREGRAS:\n' +
            '- Adapte explicacoes para a idade\n' +
            '- Respostas curtas (2-3 frases)\n' +
            '- Elogie o esforco\n' +
            '- Seja divertido e use analogias\n' +
            '- A crianca pode pedir para criar novos conteudos — neste caso, encoraje e diga que em breve sera possivel\n' +
            '- Se a crianca parecer desanimada, motive e sugira uma abordagem diferente';
        
        return instr;
    }
    
    $scope.startCall = async function() {
        $scope.mode = 'voice';
        $scope.callStatus = 'connecting';
        $scope.callStatusText = 'Conectando...';
        $scope.transcriptLines = [];
        $scope.currentTeacherText = '';
        $scope.$applyAsync();
        
        try {
            // 1. Get session data from tutor_session endpoint
            var res = await fetch(CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/tutor_session', {
                method: 'POST',
                headers: {
                    'Authorization': CONFIG.BASIC_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ player_id: childId })
            });
            sessionData = await res.json();
            
            if (!sessionData || !sessionData.api_key) {
                throw new Error('Failed to get session data');
            }
            
            // 2. Build instructions
            var instructions = buildVoiceInstructions(sessionData);
            
            // 3. Get ephemeral key with instructions baked in
            var ephRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + sessionData.api_key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: sessionData.model || 'gpt-4o-realtime-mini-2025-01-21',
                    voice: sessionData.voice || 'coral',
                    instructions: instructions,
                    input_audio_transcription: { model: 'whisper-1' }
                })
            });
            var ephData = await ephRes.json();
            
            if (!ephData.client_secret) {
                console.error('Ephemeral key error:', ephData);
                throw new Error('Failed to get ephemeral key');
            }
            
            var ephemeralKey = ephData.client_secret.value;
            
            // 4. Set up WebRTC
            pc = new RTCPeerConnection();
            
            // Audio output
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            pc.ontrack = function(e) {
                audioEl.srcObject = e.streams[0];
            };
            
            // Audio input
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStream.getTracks().forEach(function(track) {
                pc.addTrack(track, localStream);
            });
            
            // Data channel
            dc = pc.createDataChannel('oai-events');
            dc.onmessage = function(e) {
                handleRealtimeEvent(JSON.parse(e.data));
            };
            dc.onopen = function() {
                console.log('Data channel open');
            };
            
            // Connection state
            pc.oniceconnectionstatechange = function() {
                if (pc.iceConnectionState === 'connected') {
                    $scope.callStatus = 'connected';
                    $scope.callStatusText = 'Conectado';
                    callStartTime = Date.now();
                    callTimer = setInterval(updateCallDuration, 1000);
                    $scope.$applyAsync();
                } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                    $scope.endCall();
                }
            };
            
            // Create offer and connect
            var offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            var sdpRes = await fetch('https://api.openai.com/v1/realtime?model=' + (sessionData.model || 'gpt-4o-realtime-mini-2025-01-21'), {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + ephemeralKey,
                    'Content-Type': 'application/sdp'
                },
                body: offer.sdp
            });
            
            var answerSdp = await sdpRes.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
            
        } catch(err) {
            console.error('Voice call error:', err);
            $scope.callStatus = 'idle';
            $scope.callStatusText = '';
            $scope.mode = 'text';
            $scope.$applyAsync();
            alert('Não foi possível iniciar a chamada. Verifique o microfone.');
        }
    };
    
    function handleRealtimeEvent(evt) {
        if (!evt || !evt.type) return;
        
        if (evt.type === 'response.audio_transcript.delta') {
            $scope.currentTeacherText += (evt.delta || '');
            $scope.$applyAsync();
            scrollTranscript();
        }
        
        if (evt.type === 'response.audio_transcript.done') {
            if ($scope.currentTeacherText) {
                $scope.transcriptLines.push({ role: 'teacher', text: $scope.currentTeacherText });
                $scope.currentTeacherText = '';
                $scope.$applyAsync();
                scrollTranscript();
            }
        }
        
        if (evt.type === 'conversation.item.input_audio_transcription.completed') {
            var childText = evt.transcript || '';
            if (childText.trim()) {
                $scope.transcriptLines.push({ role: 'child', text: childText.trim() });
                $scope.$applyAsync();
                scrollTranscript();
            }
        }
    }
    
    function updateCallDuration() {
        if (!callStartTime) return;
        var elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        var min = Math.floor(elapsed / 60);
        var sec = elapsed % 60;
        $scope.callDuration = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
        $scope.$applyAsync();
    }
    
    $scope.toggleMute = function() {
        $scope.isMuted = !$scope.isMuted;
        if (localStream) {
            localStream.getAudioTracks().forEach(function(track) {
                track.enabled = !$scope.isMuted;
            });
        }
    };
    
    $scope.endCall = function() {
        if (callTimer) { clearInterval(callTimer); callTimer = null; }
        if (localStream) { localStream.getTracks().forEach(function(t) { t.stop(); }); localStream = null; }
        if (dc) { try { dc.close(); } catch(e) {} dc = null; }
        if (pc) { try { pc.close(); } catch(e) {} pc = null; }
        if (audioEl) { audioEl.srcObject = null; audioEl = null; }
        
        $scope.callStatus = 'idle';
        $scope.callStatusText = '';
        $scope.mode = 'text';
        $scope.isMuted = false;
        $scope.currentTeacherText = '';
        callStartTime = null;
        $scope.$applyAsync();
    };
    
    // Cleanup on scope destroy
    $scope.$on('$destroy', function() {
        if ($scope.mode === 'voice') $scope.endCall();
    });
    
    // Init
    loadContext();
});
