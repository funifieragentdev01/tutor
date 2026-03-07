app.controller('CaptureController', function($scope, $location, $routeParams, AuthService, ApiService) {
    // Parse context from query param
    var ctx = {};
    try { ctx = JSON.parse(decodeURIComponent($routeParams.ctx || $location.search().ctx || '{}')); } catch(e) {}
    
    var childId = decodeURIComponent(ctx.childId || '');
    var parentFolderId = decodeURIComponent(ctx.folderId || '') || childId;
    var level = ctx.level || 'root';
    
    $scope.step = 'photo';
    $scope.childName = '';
    $scope.contextPath = '';
    $scope.photoPreview = null;
    $scope.photoBase64 = null;
    $scope.analyzing = false;
    $scope.saving = false;
    $scope.saveProgress = 0;
    $scope.saveStatus = '';
    $scope.error = '';
    $scope.result = null;
    
    // Load child profile
    ApiService.dbGet('profile__c', childId).then(function(res) {
        var profile = res.data || {};
        $scope.childName = profile.name || 'a criança';
        $scope.childProfile = profile;
        
        // Build context path
        var parts = [profile.name || 'Aluno'];
        if (ctx.subject) parts.push(ctx.subject);
        if (ctx.module) parts.push(ctx.module);
        $scope.contextPath = parts.join(' › ');
    });
    
    $scope.onPhotoSelected = function(files) {
        if (!files || !files[0]) return;
        var file = files[0];
        var reader = new FileReader();
        reader.onload = function(e) {
            $scope.$apply(function() {
                $scope.photoPreview = e.target.result;
                $scope.photoBase64 = e.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
            });
        };
        reader.readAsDataURL(file);
    };
    
    $scope.analyzePhoto = function() {
        if (!$scope.photoBase64) return;
        $scope.analyzing = true;
        $scope.error = '';
        
        var profile = $scope.childProfile || {};
        
        var systemPrompt = 'Voce e um professor especialista em criar conteudo educacional personalizado para criancas brasileiras. ' +
            'Voce recebe uma foto de caderno ou livro escolar e gera quizzes a partir do conteudo. ' +
            'SEMPRE responda em JSON valido, sem markdown, sem explicacoes.';
        
        var userPrompt = 'ALUNO:\n' +
            '- Nome: ' + (profile.name || 'Aluno') + '\n' +
            '- Idade: ' + (profile.age || '?') + ' anos\n' +
            '- Serie: ' + (profile.grade || '?') + '\n' +
            '- Interesses: ' + (profile.interests || 'nao informado') + '\n' +
            '- Amigos: ' + (profile.friends || 'nao informado') + '\n\n' +
            'POSICAO NA TRILHA:\n' +
            '- Nivel: ' + level + '\n' +
            '- Disciplina: ' + (ctx.subject || 'a definir pela IA') + '\n' +
            '- Modulo: ' + (ctx.module || 'a definir pela IA') + '\n\n' +
            'INSTRUCOES:\n';
        
        if (level === 'root') {
            userPrompt += 'Analise a foto e retorne subject (disciplina) + module (tema) + lessons (3-5 aulas) com questions (5-8 perguntas cada).\n';
        } else if (level === 'subject') {
            userPrompt += 'Analise a foto e retorne module (tema) + lessons (3-5 aulas) com questions (5-8 perguntas cada). A disciplina ja e "' + ctx.subject + '".\n';
        } else if (level === 'module') {
            userPrompt += 'Analise a foto e retorne apenas lessons (3-5 aulas) com questions (5-8 perguntas cada). O modulo ja e "' + ctx.module + '".\n';
        }
        
        userPrompt += '\nCADA PERGUNTA deve ter 4 opcoes com exatamente 1 correta.\n' +
            'Use o nome e interesses do aluno nas perguntas quando possivel (hiper-personalizacao).\n' +
            'Dificuldade compativel com a serie do aluno.\n\n' +
            'FORMATO JSON OBRIGATORIO:\n' +
            '{\n' +
            '  "subject": "nome da disciplina",\n' +
            '  "module": "nome do modulo",\n' +
            '  "lessons": [\n' +
            '    {\n' +
            '      "title": "titulo da aula",\n' +
            '      "questions": [\n' +
            '        {\n' +
            '          "title": "pergunta",\n' +
            '          "choices": [\n' +
            '            {"label": "opcao A", "correct": false},\n' +
            '            {"label": "opcao B", "correct": true},\n' +
            '            {"label": "opcao C", "correct": false},\n' +
            '            {"label": "opcao D", "correct": false}\n' +
            '          ]\n' +
            '        }\n' +
            '      ]\n' +
            '    }\n' +
            '  ]\n' +
            '}';
        
        // Call OpenAI Vision API
        var payload = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + $scope.photoBase64, detail: 'high' } }
                ]}
            ],
            max_tokens: 4000,
            temperature: 0.7
        };
        
        $scope.$applyAsync(function() { $scope.analyzing = true; });
        
        fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY
            },
            body: JSON.stringify(payload)
        }).then(function(r) { return r.json(); })
        .then(function(data) {
            $scope.$apply(function() {
                $scope.analyzing = false;
                if (data.error) {
                    $scope.error = 'Erro da IA: ' + (data.error.message || 'Tente novamente.');
                    return;
                }
                var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
                if (!content) {
                    $scope.error = 'A IA nao retornou conteudo. Tente novamente.';
                    return;
                }
                
                // Parse JSON (remove markdown fences if present)
                content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                try {
                    $scope.result = JSON.parse(content);
                    if (!$scope.result.lessons || $scope.result.lessons.length === 0) {
                        $scope.error = 'A IA nao conseguiu gerar aulas a partir desta foto. Tente com outra pagina.';
                        return;
                    }
                    $scope.step = 'review';
                } catch(e) {
                    $scope.error = 'Erro ao processar resposta da IA. Tente novamente.';
                    console.error('Parse error:', e, content);
                }
            });
        }).catch(function(err) {
            $scope.$apply(function() {
                $scope.analyzing = false;
                $scope.error = 'Erro de conexao com a IA. Verifique sua internet.';
            });
        });
    };
    
    $scope.saveTrail = function() {
        $scope.saving = true;
        $scope.saveProgress = 0;
        $scope.saveStatus = 'Iniciando...';
        $scope.error = '';
        
        var result = $scope.result;
        var totalSteps = 0;
        var completedSteps = 0;
        
        // Calculate total steps
        if (level === 'root' && result.subject) totalSteps++; // create subject
        if ((level === 'root' || level === 'subject') && result.module) totalSteps++; // create module
        result.lessons.forEach(function(l) {
            totalSteps++; // create lesson folder
            totalSteps++; // create quiz
            totalSteps += l.questions.length; // create questions
            totalSteps++; // create folder_content
        });
        
        function progress(status) {
            completedSteps++;
            $scope.saveProgress = Math.round((completedSteps / totalSteps) * 100);
            $scope.saveStatus = status;
            $scope.$applyAsync();
        }
        
        var subjectFolderId = parentFolderId;
        var moduleFolderId = parentFolderId;
        
        // Chain of promises
        var chain = Promise.resolve();
        
        // 1. Create subject if needed
        if (level === 'root' && result.subject) {
            chain = chain.then(function() {
                progress('Criando disciplina: ' + result.subject);
                return ApiService.createFolder({
                    type: 'subject',
                    parent: childId,
                    title: result.subject,
                    position: 0,
                    active: true,
                    extra: {}
                }).then(function(res) {
                    subjectFolderId = res.data._id;
                    moduleFolderId = subjectFolderId;
                });
            });
        }
        
        // 2. Create module if needed
        if ((level === 'root' || level === 'subject') && result.module) {
            chain = chain.then(function() {
                progress('Criando modulo: ' + result.module);
                return ApiService.createFolder({
                    type: 'module',
                    parent: subjectFolderId,
                    title: result.module,
                    position: 0,
                    active: true,
                    extra: {}
                }).then(function(res) {
                    moduleFolderId = res.data._id;
                });
            });
        }
        
        // 3. Create lessons with quizzes
        var prevLessonId = null;
        result.lessons.forEach(function(lesson, lessonIdx) {
            chain = chain.then(function() {
                progress('Criando aula: ' + lesson.title);
                
                var lessonData = {
                    type: 'lesson',
                    parent: moduleFolderId,
                    title: lesson.title,
                    position: lessonIdx,
                    active: true,
                    extra: {}
                };
                
                // Add unlock policy for lesson 2+
                if (prevLessonId) {
                    lessonData.unlock_policy = {
                        type: 'progress',
                        folder_ref: prevLessonId,
                        min_percent: 80
                    };
                }
                
                return ApiService.createFolder(lessonData).then(function(lessonRes) {
                    var lessonFolderId = lessonRes.data._id;
                    prevLessonId = lessonFolderId;
                    
                    // Create quiz
                    progress('Criando quiz: ' + lesson.title);
                    return ApiService.dbSave('quiz', {
                        title: lesson.title,
                        grade: 10,
                        extra: {},
                        feedbacks: [],
                        questionNumbering: 'arabic_numerals'
                    }).then(function(quizRes) {
                        var quizId = quizRes.data._id;
                        
                        // Create questions sequentially
                        var qChain = Promise.resolve();
                        lesson.questions.forEach(function(q, qIdx) {
                            qChain = qChain.then(function() {
                                progress('Criando pergunta ' + (qIdx + 1) + '/' + lesson.questions.length);
                                
                                var choices = q.choices.map(function(c, i) {
                                    return {
                                        answer: '' + (i + 1),
                                        label: c.label,
                                        grade: c.correct ? 1 : 0,
                                        extra: {}
                                    };
                                });
                                
                                return ApiService.dbSave('question', {
                                    quiz: quizId,
                                    type: 'MULTIPLE_CHOICE',
                                    title: q.title,
                                    question: q.title,
                                    grade: 1,
                                    choices: choices,
                                    i18n: {},
                                    select: 'one_answer',
                                    answerNumbering: 'uppercase_letters',
                                    shuffle: true,
                                    feedbacks: []
                                });
                            });
                        });
                        
                        return qChain.then(function() {
                            // Create folder_content linking quiz to lesson
                            progress('Vinculando quiz a aula');
                            return ApiService.dbSave('folder_content', {
                                type: 'quiz',
                                content: quizId,
                                parent: lessonFolderId,
                                title: lesson.title,
                                extra: {},
                                position: 0
                            });
                        });
                    });
                });
            });
        });
        
        chain.then(function() {
            $scope.$apply(function() {
                $scope.saving = false;
                $scope.step = 'done';
            });
        }).catch(function(err) {
            $scope.$apply(function() {
                $scope.saving = false;
                $scope.error = 'Erro ao salvar trilha: ' + (err.message || 'Tente novamente.');
                console.error('Save error:', err);
            });
        });
    };
    
    $scope.goBack = function() {
        window.history.back();
    };
    
    $scope.goToTrail = function() {
        $location.path('/parent/child/' + encodeURIComponent(childId) + '/folder/' + encodeURIComponent(parentFolderId)).search({});
    };
    
    $scope.resetCapture = function() {
        $scope.step = 'photo';
        $scope.photoPreview = null;
        $scope.photoBase64 = null;
        $scope.result = null;
        $scope.error = '';
    };
});
