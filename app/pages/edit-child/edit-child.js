app.controller('EditChildController', function($scope, $http, $location, $routeParams, AuthService, ApiService) {
    var childId = ''; // resolved below
    var rootFolder = decodeURIComponent($routeParams.childId || '');
    
    $scope.tab = 'profile';
    $scope.setTab = function(t) { $scope.tab = t; };
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
            
            // Convert canvas to blob and upload to Funifier S3
            canvas.toBlob(function(blob) {
                var formData = new FormData();
                formData.append('file', blob, 'profile.jpg');
                formData.append('extra', JSON.stringify({ session: 'profiles' }));
                
                console.log('[EditChild] Uploading profile photo to S3 for:', childId);
                $http.post(CONFIG.API + '/v3/upload/image', formData, {
                    headers: { 'Authorization': 'Bearer ' + AuthService.getToken(), 'Content-Type': undefined },
                    transformRequest: angular.identity
                }).then(function(uploadRes) {
                    var s3Url = uploadRes.data.uploads[0].url;
                    console.log('[EditChild] Photo uploaded to S3:', s3Url);
                    
                    $scope.profilePhotoUrl = s3Url;
                    
                    var imageObj = {
                        small: { url: s3Url, size: 0, width: w, height: h, depth: 0 },
                        medium: { url: s3Url, size: 0, width: w, height: h, depth: 0 },
                        original: { url: s3Url, size: 0, width: w, height: h, depth: 0 }
                    };
                    
                    // Read full player (GET /v3/player), merge image, save (POST /v3/player)
                    return ApiService.getPlayer(childId).then(function(pRes) {
                        var player = pRes.data || {};
                        player._id = childId;
                        player.image = imageObj;
                        return $http.post(CONFIG.API + '/v3/player', player, AuthService.authHeader());
                    });
                }).then(function(response) {
                    console.log('[EditChild] Profile photo saved successfully:', response.data);
                    flashSaved();
                    $scope.$applyAsync();
                }).catch(function(err) {
                    console.error('[EditChild] Failed to save profile photo:', err);
                    $scope.error = 'Erro ao salvar foto do perfil. Tente novamente.';
                    $scope.$applyAsync();
                });
            }, 'image/jpeg', 0.8);
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
            // Also update player name (GET /v3/player, merge, POST /v3/player)
            ApiService.getPlayer(childId).then(function(pRes) {
                var p = pRes.data || {};
                p._id = childId;
                p.name = $scope.child.name;
                p.email = childId;
                $http.post(CONFIG.API + '/v3/player', p, AuthService.authHeader());
            });
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
        // If new photo was uploaded, save it first then generate
        if ($scope.bodyPhotoData) {
            $scope.saving = true;
            $scope.generatingCharacter = false;
            
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var maxSize = 600;
                var w = img.width, h = img.height;
                if (w > h) { h = h * maxSize / w; w = maxSize; }
                else { w = w * maxSize / h; h = maxSize; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                
                // Upload to S3 instead of saving base64
                canvas.toBlob(function(blob) {
                    if (!blob) { $scope.saving = false; $scope.$applyAsync(); return; }
                    var fd = new FormData();
                    fd.append('file', blob, 'body-' + childId.split('@')[0] + '.jpg');
                    fd.append('extra', JSON.stringify({ session: 'body-photos' }));
                    
                    $http.post(CONFIG.API + '/v3/upload/image', fd, {
                        headers: { 'Authorization': 'Bearer ' + AuthService.getToken(), 'Content-Type': undefined },
                        transformRequest: angular.identity
                    }).then(function(uploadRes) {
                        var s3Url = uploadRes.data.uploads[0].url;
                        $scope.child.body_photo_url = s3Url;
                        $scope.bodyPhotoUrl = s3Url;
                        
                        return ApiService.getProfile(childId).then(function(res) {
                            var profile = res.data || { _id: childId };
                            profile.body_photo_url = s3Url;
                            return ApiService.dbSave('profile__c', profile);
                        });
                    }).then(function() {
                        $scope.saving = false;
                        flashSaved();
                        $scope.$applyAsync();
                        // Pass S3 URL to character generation (it needs base64 internally)
                        generateCharacter($scope.child.body_photo_url);
                    }).catch(function() {
                        $scope.error = 'Erro ao salvar foto.';
                        $scope.saving = false;
                        $scope.$applyAsync();
                    });
                }, 'image/jpeg', 0.85);
            };
            img.src = $scope.bodyPhotoData;
        } else if ($scope.child.body_photo_url) {
            // No new upload — regenerate from existing saved photo
            generateCharacter($scope.child.body_photo_url);
        }
    };
    
    $scope.generatingCharacter = false;
    $scope.pendingCharacterUrl = null;
    
    function generateCharacter(photoUrl) {
        $scope.generatingCharacter = true;
        $scope.pendingCharacterUrl = null;
        $scope.error = '';
        $scope.$applyAsync();
        
        // If it's an S3 URL, download via proxy to get base64; if data URL, extract directly
        var base64Promise;
        if (photoUrl.indexOf('data:') === 0) {
            base64Promise = Promise.resolve(photoUrl.split(',')[1]);
        } else {
            base64Promise = downloadViaProxy(photoUrl).then(function(blob) {
                return new Promise(function(resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function() { resolve(reader.result.split(',')[1]); };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            });
        }
        
        base64Promise.then(function(base64) {
            return _doGenerateCharacter(base64);
        }).catch(function(err) {
            console.error('[EditChild] Failed to get base64 for character generation:', err);
            $scope.error = 'Erro ao processar foto. Tente novamente.';
            $scope.generatingCharacter = false;
            $scope.$applyAsync();
        });
    }
    
    function _doGenerateCharacter(base64) {
        
        // Use Funifier Public Endpoint as proxy (Freepik API blocks CORS from browser)
        var prompt = 'Create a cute cartoon character inspired by the reference photo. ' +
            'CRITICAL: Preserve the person\'s distinctive features — hair style, hair color, hair length (if curly keep curly, if long keep long), skin tone, clothing colors and style. ' +
            'Style: Friendly flat-design cartoon, like Duolingo characters. ' +
            'Slightly larger head proportions (cartoon-style, not extreme). ' +
            'NO outlines, NO borders. Solid flat colors, no gradients, no shadows. ' +
            'Simple but recognizable — someone who knows the person should recognize the character. ' +
            'Full body, front-facing, standing pose. White background (#FFFFFF). ' +
            'Only ONE character.';
        
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
            console.log('[EditChild] Generated image URL:', imageUrl ? imageUrl.substring(0, 80) : 'null');
            // Download original image immediately (before URL expires)
            var originalBlobPromise = downloadViaProxy(imageUrl);
            
            // Try background removal in parallel
            return originalBlobPromise.then(function(originalBlob) {
                return removeBackground(imageUrl).then(function(transparentUrl) {
                    return downloadViaProxy(transparentUrl);
                }).catch(function(err) {
                    console.warn('[EditChild] Background removal failed, using original:', err);
                    return originalBlob;
                });
            });
        })
        .then(function(blob) {
            if (!blob || blob.size < 100) {
                throw new Error('Imagem gerada está vazia ou inválida');
            }
            console.log('[EditChild] Got blob:', blob.size, 'bytes, uploading to Funifier...');
            // Upload to Funifier immediately so we get a permanent URL
            var formData = new FormData();
            formData.append('file', blob, childId.split('@')[0] + '_character_preview.png');
            formData.append('extra', '{"session":"characters"}');
            
            return $http.post(CONFIG.API + '/v3/upload/image', formData, {
                headers: { 'Authorization': 'Bearer ' + AuthService.getToken(), 'Content-Type': undefined },
                transformRequest: angular.identity
            });
        })
        .then(function(uploadRes) {
            var permanentUrl = uploadRes.data.uploads[0].url;
            console.log('[EditChild] Uploaded to Funifier:', permanentUrl);
            $scope.pendingCharacterUrl = permanentUrl;
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
    
    function removeBackground(imageUrl) {
        var proxyUrl = CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/freepik_remove_bg';
        return fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: imageUrl })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            console.log('[EditChild] Remove-bg raw response:', JSON.stringify(data).substring(0, 500));
            // Navigate nested Freepik response: {status, response: {data: {image: {high_resolution, preview}}}}
            var imgUrl = null;
            
            // Try all possible paths
            function extract(obj) {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.high_resolution) return obj.high_resolution;
                if (obj.preview) return obj.preview;
                if (obj.url) return obj.url;
                if (obj.image) return extract(obj.image);
                if (obj.data) return extract(obj.data);
                if (obj.response) return extract(obj.response);
                if (Array.isArray(obj) && obj[0]) return extract(obj[0]);
                return null;
            }
            
            imgUrl = extract(data);
            if (!imgUrl) throw new Error('No URL in remove-bg response: ' + JSON.stringify(data).substring(0, 300));
            console.log('[EditChild] Background removed, URL:', imgUrl.substring(0, 80));
            return imgUrl;
        });
    }
    
    function uploadImageToFunifier(imageUrl) {
        // Draw image to canvas to get blob (avoids CORS issues with external URLs)
        // The image is already loaded/displayed in the browser
        var blobPromise;
        if (imageUrl.indexOf('data:') === 0) {
            var parts = imageUrl.split(',');
            var mime = parts[0].match(/:(.*?);/)[1];
            var byteString = atob(parts[1]);
            var ab = new ArrayBuffer(byteString.length);
            var ia = new Uint8Array(ab);
            for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            blobPromise = Promise.resolve(new Blob([ab], { type: mime }));
        } else {
            // Load image into canvas (crossOrigin anonymous) then export as blob
            blobPromise = new Promise(function(resolve, reject) {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    try {
                        var canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        canvas.getContext('2d').drawImage(img, 0, 0);
                        canvas.toBlob(function(blob) {
                            if (blob) resolve(blob);
                            else reject(new Error('Canvas toBlob failed'));
                        }, 'image/png');
                    } catch(e) {
                        console.error('[EditChild] Canvas export failed (CORS?):', e);
                        // Fallback: use server-side proxy
                        downloadViaProxy(imageUrl).then(resolve).catch(reject);
                    }
                };
                img.onerror = function() {
                    console.warn('[EditChild] Image load failed, trying proxy');
                    downloadViaProxy(imageUrl).then(resolve).catch(reject);
                };
                img.src = imageUrl;
            });
        }
        
        return blobPromise.then(function(blob) {
            console.log('[EditChild] Uploading blob:', blob.size, 'bytes');
            var formData = new FormData();
            formData.append('file', blob, childId.split('@')[0] + '_character.png');
            formData.append('extra', '{"session":"characters"}');
            
            return $http.post(CONFIG.API + '/v3/upload/image', formData, {
                headers: { 'Authorization': 'Bearer ' + AuthService.getToken(), 'Content-Type': undefined },
                transformRequest: angular.identity
            });
        }).then(function(res) {
            console.log('[EditChild] Upload success:', res.data.uploads[0].url);
            return res.data.uploads[0].url;
        });
    }
    
    function convertToDataUrl(imageUrl) {
        if (imageUrl.indexOf('data:') === 0) return Promise.resolve(imageUrl);
        return downloadViaProxy(imageUrl).then(function(blob) {
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function() { resolve(reader.result); };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });
    }
    
    function downloadViaProxy(imageUrl) {
        var proxyUrl = CONFIG.API + '/v3/pub/' + CONFIG.API_KEY + '/freepik_download';
        return fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl })
        }).then(function(r) { return r.json(); })
        .then(function(data) {
            var b64 = data.base64 || (data.response && data.response.base64);
            if (!b64) throw new Error('Proxy returned no base64: ' + JSON.stringify(data).substring(0, 200));
            var contentType = data.contentType || 'image/png';
            var byteStr = atob(b64);
            var ab = new ArrayBuffer(byteStr.length);
            var ia = new Uint8Array(ab);
            for (var j = 0; j < byteStr.length; j++) ia[j] = byteStr.charCodeAt(j);
            return new Blob([ab], { type: contentType });
        });
    }
    
    $scope.approveCharacter = function() {
        $scope.saving = true;
        $scope.error = '';
        
        // Image is already uploaded to Funifier (permanent URL)
        var permanentUrl = $scope.pendingCharacterUrl;
        $scope.child.character_url = permanentUrl;
        $scope.pendingCharacterUrl = null;
        
        ApiService.getProfile(childId).then(function(res) {
            var profile = res.data || { _id: childId };
            profile.character_url = permanentUrl;
            return ApiService.dbSave('profile__c', profile);
        }).then(function() {
            $scope.saving = false;
            flashSaved();
            $scope.$applyAsync();
        }).catch(function(err) {
            console.error('Failed to save character:', err);
            $scope.error = 'Erro ao salvar personagem. Tente novamente.';
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
            // Resize sticker then upload to S3
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var maxSize = 200;
                var w = img.width, h = img.height;
                if (w > h) { h = h * maxSize / w; w = maxSize; }
                else { w = w * maxSize / h; h = maxSize; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(function(blob) {
                    if (!blob) return;
                    // Upload to S3
                    var fd = new FormData();
                    fd.append('file', blob, 'sticker-' + Date.now() + '.jpg');
                    fd.append('extra', JSON.stringify({ session: 'stickers' }));
                    $http.post(CONFIG.API + '/v3/upload/image', fd, {
                        headers: { 'Authorization': 'Bearer ' + AuthService.getToken(), 'Content-Type': undefined },
                        transformRequest: angular.identity
                    }).then(function(res) {
                        var url = res.data && res.data.uploads && res.data.uploads[0] && res.data.uploads[0].url;
                        if (!url) return;
                        if (!$scope.child.stickers) $scope.child.stickers = [];
                        $scope.child.stickers.push(url);
                        $scope.$applyAsync();
                    }).catch(function(err) {
                        console.error('[EditChild] Sticker upload failed:', err);
                    });
                }, 'image/jpeg', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    };
    
    $scope.removeSticker = function(idx, $event) {
        $event.stopPropagation();
        $scope.child.stickers.splice(idx, 1);
        // Auto-save after removal
        ApiService.getProfile(childId).then(function(res) {
            var profile = res.data || { _id: childId };
            profile.stickers = $scope.child.stickers;
            return ApiService.dbSave('profile__c', profile);
        }).then(function() {
            flashSaved();
            $scope.$applyAsync();
        }).catch(function(err) {
            console.error('[EditChild] Failed to save after sticker removal:', err);
        });
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
    
    // Resolve root_folder → player
    ApiService.resolveChild(rootFolder).then(function(player) {
        childId = player._id;
        init();
    }).catch(function() {
        // Fallback: treat rootFolder as player _id (legacy)
        childId = rootFolder;
        init();
    });
});
