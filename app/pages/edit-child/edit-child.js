app.controller('EditChildController', function($scope, $http, $location, $routeParams, AuthService, ApiService) {
    var childId = decodeURIComponent($routeParams.childId || '');
    
    $scope.tab = 'profile';
    $scope.child = {};
    $scope.loading = true;
    $scope.saving = false;
    $scope.saved = false;
    $scope.error = '';
    $scope.profilePhotoUrl = null;
    $scope.bodyPhotoUrl = null;
    $scope.bodyPhotoData = null;
    
    // Sound presets
    $scope.sounds = [
        { id: 'beep', name: 'Beep', emoji: '🔔', file: 'audio/beep.mp3' },
        { id: 'car', name: 'Carro', emoji: '🏎️', file: 'audio/car.mp3' },
        { id: 'magic', name: 'Magia', emoji: '✨', file: 'audio/magic.mp3' },
        { id: 'applause', name: 'Aplausos', emoji: '👏', file: 'audio/applause.mp3' },
        { id: 'coin', name: 'Moeda', emoji: '🪙', file: 'audio/coin.mp3' },
        { id: 'levelup', name: 'Level Up', emoji: '⬆️', file: 'audio/levelup.mp3' },
        { id: 'whoosh', name: 'Whoosh', emoji: '💨', file: 'audio/whoosh.mp3' },
        { id: 'pop', name: 'Pop', emoji: '🫧', file: 'audio/pop.mp3' }
    ];
    
    function init() {
        // Load profile__c
        ApiService.getProfile(childId).then(function(res) {
            var profile = res.data || {};
            $scope.child = {
                name: profile.name || '',
                age: profile.age || null,
                description: profile.description || '',
                extracted: profile.extracted || null,
                feedback_sound: profile.feedback_sound || 'beep',
                custom_sound_url: profile.custom_sound_url || null,
                custom_sound_name: profile.custom_sound_name || null,
                stickers: profile.stickers || [],
                body_photo_url: profile.body_photo_url || null,
                character_url: profile.character_url || null
            };
            $scope.bodyPhotoUrl = profile.body_photo_url || null;
            $scope.loading = false;
        }).catch(function() {
            $scope.child = { name: childId.split('@')[0], stickers: [] };
            $scope.loading = false;
        });
        
        // Load player image for profile photo
        ApiService.getPlayer(childId).then(function(res) {
            var player = res.data || {};
            if (player.image && player.image.small && player.image.small.url) {
                $scope.profilePhotoUrl = player.image.small.url;
            }
            if (!$scope.child.name && player.name) {
                $scope.child.name = player.name;
            }
        });
    }
    
    function flashSaved() {
        $scope.saved = true;
        $scope.error = '';
        setTimeout(function() { $scope.saved = false; $scope.$applyAsync(); }, 2000);
    }
    
    // === Profile Tab ===
    
    $scope.pickPhoto = function(type) {
        document.getElementById(type === 'body' ? 'bodyPhotoInput' : 'profilePhotoInput').click();
    };
    
    $scope.onProfilePhoto = function(input) {
        if (!input.files || !input.files[0]) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            $scope.profilePhotoUrl = e.target.result;
            $scope.$applyAsync();
            // Save immediately
            resizeAndSavePlayerImage(e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    };
    
    function resizeAndSavePlayerImage(dataUrl) {
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            var maxSize = 300;
            var w = img.width, h = img.height;
            if (w > h) { h = h * maxSize / w; w = maxSize; }
            else { w = w * maxSize / h; h = maxSize; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            var resized = canvas.toDataURL('image/jpeg', 0.8);
            
            var imageObj = {
                small: { url: resized, size: 0, width: w, height: h, depth: 0 },
                medium: { url: resized, size: 0, width: w, height: h, depth: 0 },
                original: { url: resized, size: 0, width: w, height: h, depth: 0 }
            };
            // Use POST /v3/player (not /v3/database/player) to properly save image
            console.log('[EditChild] Saving profile photo for:', childId);
            $http.post(CONFIG.API + '/v3/player', {
                _id: childId,
                name: $scope.child.name || '',
                email: childId,
                image: imageObj
            }, AuthService.authHeader()).then(function(response) {
                console.log('[EditChild] Profile photo saved successfully:', response.data);
                flashSaved();
                $scope.$applyAsync();
            }).catch(function(err) {
                console.error('[EditChild] Failed to save profile photo:', err);
                $scope.error = 'Erro ao salvar foto do perfil. Tente novamente.';
                $scope.$applyAsync();
            });
        };
        img.src = dataUrl;
    }
    
    $scope.addHint = function(hint) {
        var current = $scope.child.description || '';
        if (current.length > 0 && !current.endsWith(' ') && !current.endsWith('\n')) current += ' ';
        var hintTexts = {
            '📚 escola': 'Sobre a escola: ', '🎮 diversão': 'O que gosta de fazer: ',
            '👫 amigos': 'Amigos: ', '💪 dificuldades': 'Dificuldades: ',
            '🎯 objetivos': 'Objetivos: ', '❤️ família': 'Família: ', '⭐ ídolos': 'Ídolos: '
        };
        $scope.child.description = current + (hintTexts[hint] || hint + ': ');
        setTimeout(function() {
            var ta = document.querySelector('textarea');
            if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
        }, 100);
    };
    
    $scope.saveProfile = function() {
        $scope.saving = true;
        $scope.error = '';
        
        var profileData = {
            _id: childId,
            parent: AuthService.getUser(),
            name: $scope.child.name,
            age: parseInt($scope.child.age) || null,
            description: ($scope.child.description || '').trim(),
            feedback_sound: $scope.child.feedback_sound || 'beep',
            stickers: $scope.child.stickers || [],
            body_photo_url: $scope.child.body_photo_url || null,
            character_url: $scope.child.character_url || null
        };
        
        // AI extraction if description changed and is substantial
        var descPromise;
        if (profileData.description && profileData.description.length > 20) {
            descPromise = extractProfileWithAI(profileData.description, $scope.child.name, $scope.child.age);
        } else {
            descPromise = Promise.resolve($scope.child.extracted);
        }
        
        descPromise.then(function(extracted) {
            if (extracted) {
                profileData.extracted = extracted;
                $scope.child.extracted = extracted;
            }
            return ApiService.dbSave('profile__c', profileData);
        }).then(function() {
            // Also update player name
            ApiService.dbSave('player', { _id: childId, name: $scope.child.name, email: childId });
            $scope.saving = false;
            flashSaved();
            $scope.$applyAsync();
        }).catch(function() {
            $scope.error = 'Erro ao salvar.';
            $scope.saving = false;
            $scope.$applyAsync();
        });
    };
    
    function extractProfileWithAI(description, name, age) {
        var prompt = 'Analise o relato de um pai/mãe sobre seu filho(a) chamado(a) ' + name + ', ' + (age || '?') + ' anos. ' +
            'Extraia as informações estratégicas para personalizar o aprendizado. Retorne um JSON com: ' +
            '{"grade":"série","interests":["interesses"],"friends":["amigos"],' +
            '"difficulties":["dificuldades"],"goals":["objetivos"],"personality":"personalidade",' +
            '"family_context":"contexto familiar","idols":["ídolos"],"fun_facts":["fatos"]}. ' +
            'Apenas os campos que puder extrair. SOMENTE JSON.\n\nRelato:\n' + description;
        
        return fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 500 })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
              if (!text) return null;
              text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              try { return JSON.parse(text); } catch(e) { return null; }
          }).catch(function() { return null; });
    }
    
    // === Character Tab ===
    
    $scope.onBodyPhoto = function(input) {
        if (!input.files || !input.files[0]) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            $scope.bodyPhotoUrl = e.target.result;
            $scope.bodyPhotoData = e.target.result;
            $scope.$applyAsync();
        };
        reader.readAsDataURL(input.files[0]);
    };
    
    $scope.saveBodyPhoto = function() {
        if (!$scope.bodyPhotoData) return;
        $scope.saving = true;
        $scope.generatingCharacter = false;
        
        // Resize body photo
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            var maxSize = 600;
            var w = img.width, h = img.height;
            if (w > h) { h = h * maxSize / w; w = maxSize; }
            else { w = w * maxSize / h; h = maxSize; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            var resized = canvas.toDataURL('image/jpeg', 0.85);
            
            $scope.child.body_photo_url = resized;
            $scope.bodyPhotoUrl = resized;
            
            // Save to profile then generate character
            ApiService.getProfile(childId).then(function(res) {
                var profile = res.data || { _id: childId };
                profile.body_photo_url = resized;
                return ApiService.dbSave('profile__c', profile);
            }).then(function() {
                $scope.saving = false;
                flashSaved();
                $scope.$applyAsync();
                // Start character generation
                generateCharacter(resized);
            }).catch(function() {
                $scope.error = 'Erro ao salvar foto.';
                $scope.saving = false;
                $scope.$applyAsync();
            });
        };
        img.src = $scope.bodyPhotoData;
    };
    
    $scope.generatingCharacter = false;
    $scope.pendingCharacterUrl = null;
    
    function generateCharacter(photoDataUrl) {
        $scope.generatingCharacter = true;
        $scope.pendingCharacterUrl = null;
        $scope.error = '';
        $scope.$applyAsync();
        
        var base64 = photoDataUrl.split(',')[1];
        
        // Use Funifier Public Endpoint as proxy (Freepik API blocks CORS from browser)
        var prompt = 'Turn the person from the reference photo into a simplified cartoon mascot. ' +
            'Use a cute, playful, child-friendly style consistent with educational apps like Duolingo. ' +
            'Flat colors, clean outlines, no gradients, no realistic shading. ' +
            'IMPORTANT: Show only ONE character. Full body, standing pose, white background. ' +
            'No duplicate characters, no mirror images, no multiple views.';
        
        var proxyUrl = CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/freepik_generate';
        
        fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, prompt: prompt })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var taskId = data.response && data.response.data && data.response.data.task_id;
            if (!taskId) throw new Error('Freepik task creation failed: ' + JSON.stringify(data).substring(0, 200));
            return pollFreepikTask(taskId);
        })
        .then(function(imageUrl) {
            $scope.pendingCharacterUrl = imageUrl;
            $scope.generatingCharacter = false;
            $scope.$applyAsync();
        })
        .catch(function(err) {
            console.error('Character generation error:', err);
            $scope.error = 'Erro ao gerar personagem. Tente novamente.';
            $scope.generatingCharacter = false;
            $scope.$applyAsync();
        });
    }
    
    function pollFreepikTask(taskId) {
        var proxyUrl = CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/freepik_status';
        var maxAttempts = 30;
        var attempt = 0;
        return new Promise(function(resolve, reject) {
            function check() {
                attempt++;
                if (attempt > maxAttempts) return reject(new Error('Timeout gerando personagem'));
                
                fetch(proxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_id: taskId })
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    var inner = data.response && data.response.data || data.data || {};
                    var status = inner.status;
                    if (status === 'COMPLETED') {
                        var generated = inner.generated;
                        if (generated && generated.length > 0) {
                            var img = generated[0];
                            // Can be URL string or object with url
                            var url = typeof img === 'string' ? img : (img.url || img.base64);
                            if (url) return resolve(url);
                        }
                        return reject(new Error('No image in result'));
                    } else if (status === 'FAILED' || status === 'ERROR') {
                        return reject(new Error('Freepik generation failed'));
                    }
                    // Still processing, wait and retry
                    setTimeout(check, 2000);
                })
                .catch(reject);
            }
            setTimeout(check, 3000); // Initial delay before first poll
        });
    }
    
    $scope.approveCharacter = function() {
        $scope.saving = true;
        $scope.child.character_url = $scope.pendingCharacterUrl;
        $scope.pendingCharacterUrl = null;
        
        ApiService.getProfile(childId).then(function(res) {
            var profile = res.data || { _id: childId };
            profile.character_url = $scope.child.character_url;
            return ApiService.dbSave('profile__c', profile);
        }).then(function() {
            $scope.saving = false;
            flashSaved();
            $scope.$applyAsync();
        }).catch(function() {
            $scope.error = 'Erro ao salvar personagem.';
            $scope.saving = false;
            $scope.$applyAsync();
        });
    };
    
    $scope.rejectCharacter = function() {
        // Regenerate
        if ($scope.child.body_photo_url) {
            generateCharacter($scope.child.body_photo_url);
        } else {
            $scope.pendingCharacterUrl = null;
        }
    };
    
    // === Sounds Tab ===
    
    $scope.selectSound = function(s) {
        $scope.child.feedback_sound = s.id;
    };
    
    $scope.playPreview = function(s, $event) {
        $event.stopPropagation();
        try { new Audio(s.file).play(); } catch(e) {}
    };
    
    $scope.onCustomSound = function(input) {
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        var reader = new FileReader();
        reader.onload = function(e) {
            $scope.child.feedback_sound = 'custom';
            $scope.child.custom_sound_url = e.target.result;
            $scope.child.custom_sound_name = file.name;
            $scope.$applyAsync();
        };
        reader.readAsDataURL(file);
    };
    
    $scope.saveSound = function() {
        $scope.saving = true;
        ApiService.getProfile(childId).then(function(res) {
            var profile = res.data || { _id: childId };
            profile.feedback_sound = $scope.child.feedback_sound;
            if ($scope.child.feedback_sound === 'custom') {
                profile.custom_sound_url = $scope.child.custom_sound_url;
                profile.custom_sound_name = $scope.child.custom_sound_name;
            }
            return ApiService.dbSave('profile__c', profile);
        }).then(function() {
            $scope.saving = false;
            flashSaved();
            $scope.$applyAsync();
        }).catch(function() {
            $scope.error = 'Erro ao salvar som.';
            $scope.saving = false;
            $scope.$applyAsync();
        });
    };
    
    // === Stickers Tab ===
    
    $scope.pickSticker = function() {
        document.getElementById('stickerInput').click();
    };
    
    $scope.onStickerSelected = function(input) {
        if (!input.files || !input.files[0]) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            // Resize sticker
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var maxSize = 200;
                var w = img.width, h = img.height;
                if (w > h) { h = h * maxSize / w; w = maxSize; }
                else { w = w * maxSize / h; h = maxSize; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                var resized = canvas.toDataURL('image/jpeg', 0.8);
                if (!$scope.child.stickers) $scope.child.stickers = [];
                $scope.child.stickers.push(resized);
                $scope.$applyAsync();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    };
    
    $scope.removeSticker = function(idx, $event) {
        $event.stopPropagation();
        $scope.child.stickers.splice(idx, 1);
    };
    
    $scope.saveStickers = function() {
        $scope.saving = true;
        ApiService.getProfile(childId).then(function(res) {
            var profile = res.data || { _id: childId };
            profile.stickers = $scope.child.stickers;
            return ApiService.dbSave('profile__c', profile);
        }).then(function() {
            $scope.saving = false;
            flashSaved();
            $scope.$applyAsync();
        }).catch(function() {
            $scope.error = 'Erro ao salvar figurinhas.';
            $scope.saving = false;
            $scope.$applyAsync();
        });
    };
    
    $scope.goBack = function() {
        $location.path('/parent');
    };
    
    init();
});
