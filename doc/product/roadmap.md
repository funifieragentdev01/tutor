# Tutor App — Roadmap de Produto

## Fase 1: Branding & Identidade
- [ ] Definir nome do produto (com domínio .com ou .app disponível)
- [ ] Criar logomarca
- [ ] Definir paleta de cores (considerar público infantil)
- [ ] Definir tipografia
- [ ] Criar assets de marca (favicon, app icon, splash screen)
- [ ] Configurar domínio e Netlify custom domain

## Fase 2: Segurança
- [ ] Mover OpenAI API key para server-side (proxy endpoints no Funifier)
  - [ ] `ai_chat` — proxy para OpenAI Chat Completions
  - [ ] `ai_vision` — proxy para OpenAI Vision API
  - [ ] `coach_ephemeral` — gera ephemeral key server-side
  - [ ] `tutor_session` — retorna dados do player (sem API key)
- [ ] Remover OPENAI_API_KEY do config.js frontend

## Fase 3: Fix Ligação por Áudio (Professor IA)
- [ ] Ajustar VAD threshold para 0.85 (menos sensível a ruído)
- [ ] Ajustar silence duration para 1000ms
- [ ] Tools no `client_secrets` request (não via session.update)
- [ ] Incluir tool `end_call` para o professor encerrar naturalmente
- [ ] Testar com cenário de ruído ambiente (criança em casa)

## Fase 4: Funcionalidades Pendentes
- [ ] Registro de notas/grades pelos pais após provas
- [ ] Cascade delete de aluno (LGPD compliance)
  - [ ] Deletar folders, folder_content, folder_log
  - [ ] Deletar profile__c (personagem + variações)
  - [ ] Deletar ações/pontos do jogador
- [ ] Sticker album — variações desbloqueáveis do personagem
- [ ] Melhorias no quiz (novos tipos de exercício)

## Fase 5: UX & Polish
- [ ] Aplicar novo branding em todas as telas
- [ ] Onboarding guiado para o pai (primeiro acesso)
- [ ] Dashboard do pai com visão de progresso do filho
- [ ] Notificações push (lembrete de estudo, novas lições)

## Histórico de Versões
- v0.25.0 — Quiz results Duolingo-style, character variations no trail
- v0.24.x — Trail S-curve com variações, lesson bubbles 83px
- v0.23.x — Character variations (Freepik image-to-image + GPT scenes)
- v0.22.x — Exams page fix, sticker delete fix
- v0.17.7 — root_folder refactor (short GUID)
