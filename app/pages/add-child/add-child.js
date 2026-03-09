app.controller('AddChildController', function($scope, $location, $rootScope, AuthService, ApiService) {
    var COLORS = ['#FF9600', '#00B894', '#FD79A8', '#FDCB6E', '#74B9FF', '#FF6B6B', '#FFB84D', '#00CEC9'];
    
    $scope.step = 0;
    $scope.steps = ['Dados', 'Foto', 'Sobre'];
    $scope.child = {};
    $scope.error = '';
    $scope.saving = false;
    $scope.photoPreview = null;
    $scope.avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    var photoData = null; // base64
    var createdChildId = null;
    var parentId = AuthService.getUser();
    
    $scope.nextStep = function() {
        $scope.error = '';
        
        if ($scope.step === 0) {
            // Validate basic info
            if (!$scope.child.name || !$scope.child.name.trim()) {
                $scope.error = 'Nome é obrigatório.';
                return;
            }
            if (!$scope.child.email || !$scope.child.email.trim()) {
                $scope.error = 'E-mail é obrigatório.';
                return;
            }
            if (!$scope.child.password) {
                $scope.error = 'Senha é obrigatória.';
                return;
            }
            if (!$scope.child.age) {
                $scope.error = 'Idade é obrigatória.';
                return;
            }
            
            // Create child account
            $scope.saving = true;
            var childEmail = $scope.child.email.trim().toLowerCase();
            
            AuthService.signup({
                _id: childEmail,
                name: $scope.child.name.trim(),
                email: childEmail,
                password: $scope.child.password,
                role: 'child',
                parent_id: parentId
            }).then(function(res) {
                var data = res.data;
                if (data.error) {
                    $scope.error = data.error;
                    $scope.saving = false;
                    return;
                }
                
                createdChildId = childEmail;
                var rootFolder = data.root_folder || childEmail;
                
                // Create root folder for child (use root_folder GUID as _id)
                ApiService.createFolder({
                    _id: rootFolder,
                    type: 'root',
                    title: $scope.child.name.trim(),
                    position: 0,
                    active: true
                }).catch(function() {});
                
                // Add child to parent's children list
                ApiService.getProfile(parentId).then(function(pRes) {
                    var profile = (pRes.data && pRes.data._id) ? pRes.data : { _id: parentId };
                    if (!profile.children) profile.children = [];
                    if (profile.children.indexOf(childEmail) === -1) {
                        profile.children.push(childEmail);
                    }
                    return ApiService.dbSave('profile__c', profile);
                }).catch(function() {
                    // Create new profile__c for parent
                    return ApiService.dbSave('profile__c', { _id: parentId, children: [childEmail] });
                });
                
                $scope.saving = false;
                $scope.step = 1;
            }).catch(function(err) {
                $scope.error = 'Erro ao criar conta. Tente novamente.';
                $scope.saving = false;
            });
            
        } else if ($scope.step === 1) {
            // Save photo if selected
            if (photoData) {
                $scope.saving = true;
                savePhoto().then(function() {
                    $scope.saving = false;
                    $scope.step = 2;
                    $scope.$applyAsync();
                }).catch(function() {
                    $scope.saving = false;
                    $scope.step = 2;
                    $scope.$applyAsync();
                });
            } else {
                $scope.step = 2;
            }
        }
    };
    
    $scope.skipStep = function() {
        $scope.step++;
    };
    
    $scope.finish = function() {
        $scope.saving = true;
        $scope.error = '';
        
        // Save child profile with description
        var profileData = {
            _id: createdChildId,
            parent: parentId,
            name: $scope.child.name.trim(),
            age: parseInt($scope.child.age),
            description: ($scope.child.description || '').trim(),
            created: new Date().getTime()
        };
        
        // If description provided, extract structured data via AI
        var descPromise;
        if (profileData.description && profileData.description.length > 20) {
            descPromise = extractProfileWithAI(profileData.description, $scope.child.name, $scope.child.age);
        } else {
            descPromise = Promise.resolve(null);
        }
        
        descPromise.then(function(extracted) {
            if (extracted) {
                profileData.extracted = extracted;
            }
            return ApiService.dbSave('profile__c', profileData);
        }).then(function() {
            $scope.saving = false;
            $scope.step = 3;
            $scope.$applyAsync();
        }).catch(function() {
            // Save without AI extraction
            ApiService.dbSave('profile__c', profileData).then(function() {
                $scope.saving = false;
                $scope.step = 3;
                $scope.$applyAsync();
            }).catch(function() {
                $scope.error = 'Erro ao salvar perfil.';
                $scope.saving = false;
                $scope.$applyAsync();
            });
        });
    };
    
    function extractProfileWithAI(description, name, age) {
        var prompt = 'Analise o relato de um pai/mãe sobre seu filho(a) chamado(a) ' + name + ', ' + age + ' anos. ' +
            'Extraia as informações estratégicas para personalizar o aprendizado. Retorne um JSON com: ' +
            '{"grade":"série/ano escolar","interests":["lista de interesses"],"friends":["nomes de amigos"],' +
            '"difficulties":["dificuldades escolares"],"goals":["objetivos"],"personality":"traços de personalidade",' +
            '"family_context":"contexto familiar relevante","idols":["ídolos/referências"],"fun_facts":["fatos interessantes"]}. ' +
            'Apenas os campos que puder extrair. Retorne SOMENTE o JSON, sem explicação.\n\nRelato do pai/mãe:\n' + description;
        
        return fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 500
            })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
              if (!text) return null;
              // Clean markdown code fences
              text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              try { return JSON.parse(text); } catch(e) { return null; }
          }).catch(function() { return null; });
    }
    
    // Photo handling
    $scope.pickPhoto = function() {
        document.getElementById('photoInput').click();
    };
    
    $scope.onPhotoSelected = function(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function(e) {
                $scope.photoPreview = e.target.result;
                photoData = e.target.result;
                $scope.$applyAsync();
            };
            reader.readAsDataURL(input.files[0]);
        }
    };
    
    function savePhoto() {
        if (!photoData || !createdChildId) return Promise.resolve();
        
        console.log('[AddChild] savePhoto called for:', createdChildId);
        
        // Step 1: Upload base64 image to Funifier S3 (same pattern as fitness app)
        var base64Data = photoData; // data:image/jpeg;base64,...
        var byteString = atob(base64Data.split(',')[1]);
        var mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        var blob = new Blob([ab], { type: mimeString });
        
        var formData = new FormData();
        formData.append('file', blob, 'profile-' + createdChildId.split('@')[0] + '.jpg');
        formData.append('extra', JSON.stringify({ session: 'images' }));
        
        console.log('[AddChild] Uploading photo to S3, blob size:', blob.size);
        
        return $http.post(CONFIG.API + '/v3/upload/image', formData, {
            headers: { 'Authorization': 'Bearer ' + AuthService.getToken(), 'Content-Type': undefined },
            transformRequest: angular.identity
        }).then(function(res) {
            var url = res.data && res.data.uploads && res.data.uploads[0] && res.data.uploads[0].url;
            if (!url) {
                console.error('[AddChild] Upload returned no URL:', JSON.stringify(res.data));
                return;
            }
            console.log('[AddChild] S3 upload success:', url);
            
            // Step 2: Read current player, merge image with S3 URL, save back
            var imgEntry = { url: url, size: 0, width: 0, height: 0, depth: 0 };
            var imageObj = { small: angular.copy(imgEntry), medium: angular.copy(imgEntry), original: angular.copy(imgEntry) };
            
            // Read full player (GET /v3/player/{id}), merge image, save back (POST /v3/player)
            return ApiService.getPlayer(createdChildId).then(function(pRes) {
                var p = pRes.data || {};
                p._id = createdChildId;
                p.image = imageObj;
                console.log('[AddChild] Saving player with S3 URL, keys:', Object.keys(p).join(','));
                return $http.post(CONFIG.API + '/v3/player', p, AuthService.authHeader());
            });
        }).then(function() {
            console.log('[AddChild] Player photo saved successfully');
        }).catch(function(err) {
            console.error('[AddChild] Photo upload/save FAILED:', err);
        });
    }
    
    // Hint chips
    $scope.addHint = function(hint) {
        var current = $scope.child.description || '';
        if (current.length > 0 && !current.endsWith(' ') && !current.endsWith('\n')) {
            current += ' ';
        }
        var hintTexts = {
            'escola': 'Sobre a escola: ',
            'diversão': 'O que gosta de fazer: ',
            'amigos': 'Amigos: ',
            'dificuldades': 'Dificuldades: ',
            'objetivos': 'Objetivos: ',
            'família': 'Família: ',
            'ídolos': 'Ídolos/referências: '
        };
        $scope.child.description = current + (hintTexts[hint] || hint + ': ');
        // Focus textarea
        setTimeout(function() {
            var ta = document.querySelector('textarea');
            if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
        }, 100);
    };
    
    $scope.goToChild = function() {
        // Fetch child player to get root_folder for URL
        ApiService.getPlayer(createdChildId).then(function(res) {
            var player = res.data || {};
            var rf = (player.extra && player.extra.root_folder) || createdChildId;
            $location.path('/parent/child/' + encodeURIComponent(rf));
            $scope.$applyAsync();
        }).catch(function() {
            $location.path('/parent/child/' + encodeURIComponent(createdChildId));
        });
    };
    
    $scope.goBack = function() {
        $location.path('/parent');
    };
    
    $scope.cancel = function() {
        if ($scope.step > 0 && createdChildId) {
            if (!confirm('O perfil de ' + $scope.child.name + ' já foi criado. Deseja voltar ao painel?')) return;
        }
        $location.path('/parent');
    };
});
