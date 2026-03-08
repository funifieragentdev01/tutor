// Chat Controller — AI Teacher Chat + Voice Call
app.controller('ChatController', function($scope, $location, $routeParams, $sce, AuthService, ApiService) {
    var childId = $routeParams.childId || AuthService.getUser();
    var isParent = AuthService.getRole() === 'parent';
    
    $scope.messages = [];
    $scope.chat = { input: '' };
    $scope.typing = false;
    $scope.loading = true;
    
    // Mode: 'select', 'text', 'voice'
    $scope.mode = 'select';
    $scope.callStatus = 'idle';
    $scope.callStatusText = '';
    $scope.isMuted = false;
    $scope.callDuration = '00:00';
    
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
    var folderProgress = [];
    var exams = [];
    var systemPrompt = '';
    
    // Mode selection
    $scope.selectMode = function(mode) {
        $scope.mode = mode;
        if (mode === 'voice') {
            $scope.startCall();
        }
    };
    
    // Go back
    $scope.goBack = function() {
        if ($scope.mode === 'voice') {
            $scope.endCall();
            return;
        }
        if ($scope.mode === 'text') {
            $scope.mode = 'select';
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
    
    // Build subjects text for prompts
    function buildSubjectsText() {
        if (!folderProgress || folderProgress.length === 0) {
            if (folders.length > 0) {
                return 'MATERIAS CADASTRADAS:\n' + folders.map(function(f) {
                    return '- ' + (f.name || f.title || 'Matéria');
                }).join('\n');
            }
            return '';
        }
        
        var lines = ['MATERIAS CADASTRADAS:'];
        folderProgress.forEach(function(fp) {
            var pct = fp.percent != null ? fp.percent : 0;
            lines.push('- ' + (fp.name || 'Matéria') + ' (' + Math.round(pct) + '% completo)');
            if (fp.children && fp.children.length > 0) {
                fp.children.forEach(function(child) {
                    var cpct = child.percent != null ? child.percent : 0;
                    var status = cpct >= 100 ? '100% completo' : cpct > 0 ? Math.round(cpct) + '% completo' : '0% - próximo a estudar';
                    lines.push('  - Módulo: ' + (child.name || 'Módulo') + ' (' + status + ')');
                });
            }
        });
        return lines.join('\n');
    }
    
    // Build exams text for prompts
    function buildExamsText() {
        if (!exams || exams.length === 0) return '';
        var now = new Date();
        var upcoming = exams.filter(function(e) {
            var d = e.date && e.date.$date ? new Date(e.date.$date) : new Date(e.date);
            return d >= now;
        }).sort(function(a, b) {
            var da = a.date && a.date.$date ? new Date(a.date.$date) : new Date(a.date);
            var db = b.date && b.date.$date ? new Date(b.date.$date) : new Date(b.date);
            return da - db;
        });
        if (upcoming.length === 0) return '';
        
        var lines = ['PROVAS AGENDADAS:'];
        upcoming.forEach(function(e) {
            var d = e.date && e.date.$date ? new Date(e.date.$date) : new Date(e.date);
            var days = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
            var dateStr = d.toLocaleDateString('pt-BR');
            var line = '- ' + (e.subject || 'Matéria') + ': ' + (e.topic || '') + ' — ' + dateStr + ' (em ' + days + ' dias)';
            if (e.notes) line += ' — ' + e.notes;
            lines.push(line);
        });
        lines.push('\nPRIORIZE matérias com provas próximas!');
        return lines.join('\n');
    }
    
    // Build system prompt from child data
    function buildSystemPrompt() {
        var name = 'aluno(a)';
        var age = '';
        var description = '';
        
        if (childPlayer && childPlayer.extra) {
            name = childPlayer.extra.name__c || childPlayer.name || name;
        } else if (childPlayer) {
            name = childPlayer.name || name;
        }
        
        if (childProfile) {
            if (childProfile.age) age = childProfile.age;
            if (childProfile.description) description = childProfile.description;
        }
        
        var subjectsText = buildSubjectsText();
        var examsText = buildExamsText();
        
        systemPrompt = 'Você é o Professor Tutor, um professor particular virtual para crianças. ' +
            'Seu nome é Professor Tutor. Fale sempre em Português do Brasil.\n\n' +
            'ALUNO: ' + name + (age ? ' (' + age + ' anos)' : '') + '\n' +
            (description ? 'DESCRIÇÃO DO ALUNO (escrita pelos pais): ' + description + '\n' : '') +
            (subjectsText ? '\n' + subjectsText + '\n' : '') +
            (examsText ? '\n' + examsText + '\n' : '') +
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
                var playerRes = await ApiService.getPlayer(childId);
                childPlayer = playerRes.data || playerRes;
            } catch(e) {}
            
            // Load profile
            try {
                var profileRes = await ApiService.getProfile(childId);
                childProfile = profileRes.data || profileRes;
            } catch(e) {}
            
            // Load root folders (subjects) from folder collection
            try {
                var fq = JSON.stringify({ player: childId, parent: { $exists: false } });
                var fRes = await ApiService.dbQuery('folder', fq, null, 50);
                folders = fRes.data || [];
            } catch(e) {}
            
            // Load progress for each root folder
            folderProgress = [];
            for (var i = 0; i < folders.length; i++) {
                try {
                    var pRes = await ApiService.getFolderProgress(folders[i]._id, childId);
                    var pData = pRes.data || pRes;
                    if (pData) {
                        pData.name = folders[i].name || folders[i].title;
                        folderProgress.push(pData);
                    }
                } catch(e) {
                    folderProgress.push({ name: folders[i].name || folders[i].title, percent: 0, children: [] });
                }
            }
            
            // Load exams
            try {
                var eq = JSON.stringify({ player: childId });
                var eRes = await ApiService.dbQuery('exam__c', eq, { date: 1 }, 50);
                exams = eRes.data || [];
            } catch(e) {}
            
            buildSystemPrompt();
            
            // Load chat history
            try {
                var hq = JSON.stringify({ player: childId });
                var hRes = await ApiService.dbQuery('chat_message__c', hq, { timestamp: -1 }, 20);
                var history = hRes.data || [];
                if (history.length) {
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
        var content = text || ($scope.chat.input || '').trim();
        if (!content || $scope.typing) return;
        
        $scope.chat.input = '';
        
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
        var subjectsText = '';
        var examsText = '';
        var quizInfo = '';
        
        if (data.profile) {
            age = data.profile.age || '';
            description = data.profile.description || '';
        }
        
        // Build subjects from folder data
        if (data.folders && data.folders.length > 0) {
            var sLines = ['MATERIAS CADASTRADAS:'];
            data.folders.forEach(function(f) {
                var pct = f.percent != null ? f.percent : 0;
                sLines.push('- ' + (f.name || f.title || 'Matéria') + ' (' + Math.round(pct) + '% completo)');
                if (f.children && f.children.length > 0) {
                    f.children.forEach(function(c) {
                        var cpct = c.percent != null ? c.percent : 0;
                        var status = cpct >= 100 ? '100% completo' : cpct > 0 ? Math.round(cpct) + '% completo' : '0% - próximo a estudar';
                        sLines.push('  - Módulo: ' + (c.name || 'Módulo') + ' (' + status + ')');
                    });
                }
            });
            subjectsText = sLines.join('\n');
        }
        
        // Build exams
        if (data.exams && data.exams.length > 0) {
            var now = new Date();
            var upcoming = data.exams.filter(function(e) {
                var d = e.date && e.date.$date ? new Date(e.date.$date) : new Date(e.date);
                return d >= now;
            });
            if (upcoming.length > 0) {
                var eLines = ['PROVAS AGENDADAS:'];
                upcoming.forEach(function(e) {
                    var d = e.date && e.date.$date ? new Date(e.date.$date) : new Date(e.date);
                    var days = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                    var dateStr = d.toLocaleDateString('pt-BR');
                    var line = '- ' + (e.subject || '') + ': ' + (e.topic || '') + ' — ' + dateStr + ' (em ' + days + ' dias)';
                    if (e.notes) line += ' — ' + e.notes;
                    eLines.push(line);
                });
                eLines.push('\nPRIORIZE materias com provas proximas!');
                examsText = eLines.join('\n');
            }
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
        if (subjectsText) instr += '\n' + subjectsText + '\n';
        if (examsText) instr += '\n' + examsText + '\n';
        if (quizInfo) instr += '\nDESEMPENHO RECENTE EM QUIZ: ' + quizInfo + '\n';
        
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
        $scope.callStatus = 'connecting';
        $scope.callStatusText = 'Conectando...';
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
            
            // 3. Get ephemeral key
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
            
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            pc.ontrack = function(e) {
                audioEl.srcObject = e.streams[0];
            };
            
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStream.getTracks().forEach(function(track) {
                pc.addTrack(track, localStream);
            });
            
            dc = pc.createDataChannel('oai-events');
            dc.onmessage = function(e) {
                handleRealtimeEvent(JSON.parse(e.data));
            };
            dc.onopen = function() {
                console.log('Data channel open');
            };
            
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
            $scope.mode = 'select';
            $scope.$applyAsync();
            alert('Não foi possível iniciar a chamada. Verifique o microfone.');
        }
    };
    
    function handleRealtimeEvent(evt) {
        if (!evt || !evt.type) return;
        // Log events but don't display transcript
        console.log('Realtime event:', evt.type);
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
        $scope.mode = 'select';
        $scope.isMuted = false;
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
