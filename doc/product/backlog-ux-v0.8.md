# Backlog UX — Tutor v0.8+

Sprint de melhorias UX baseado na análise completa das telas (2026-03-07).
Inspiração: Duolingo — fluidez, gamificação, clareza.

## Itens

### 1. 🔊 Som customizado no quiz (bug funcional)
- **Prioridade**: P0
- **Status**: TODO
- **Descrição**: Quiz usa `beep.mp3` fixo. Ignorar som customizado configurado pelo pai em edit-child (Sons tab). Conectar `profile__c.feedback_sound` ao quiz.
- **Arquivos**: `quiz.js`, `quiz.html`

### 2. 💡 Explicação ao errar no quiz
- **Prioridade**: P0
- **Status**: TODO
- **Descrição**: Usar campo `feedbacks` nativo do Funifier Question (event: correct/wrong, message). Gerar feedback na criação das perguntas via IA. Mostrar explicação quando erra.
- **Arquivos**: `quiz.js`, `quiz.html`, `capture.js` (prompt de geração)

### 3. 📱 Bottom navigation
- **Prioridade**: P0
- **Status**: TODO
- **Descrição**: Barra fixa no rodapé. Pai: Home + Configurações. Criança: Home + Perfil. Estilo Duolingo (ícones + label, destaque na aba ativa).
- **Arquivos**: `index.html`, `style.css`, `app.js` (routing)

### 4. 📊 Dashboard do pai — stats dos filhos
- **Prioridade**: P1
- **Status**: TODO
- **Descrição**: Mostrar no card de cada filho: streak do dia, quizzes completados hoje, último acesso, progresso geral. Dados via `folder_log` e `question_log`.
- **Arquivos**: `dashboard-parent.js`, `dashboard-parent.html`

### 5. 🎨 Cores/ícones por disciplina
- **Prioridade**: P1
- **Status**: TODO
- **Descrição**: Mapear disciplinas comuns a cores/emojis específicos (Matemática=azul/📐, Português=verde/📖, etc.). Fallback para cor por índice.
- **Arquivos**: `dashboard-child.js`, `trail.js`, `style.css`

### 6. 🎓 Onboarding/tour para pais novos
- **Prioridade**: P1
- **Status**: TODO
- **Descrição**: Mini-tour ao primeiro login: "1. Cadastre seu filho → 2. Tire foto do caderno → 3. Ele começa a jogar". Overlay com 3 passos, dismiss.
- **Arquivos**: `dashboard-parent.js`, `dashboard-parent.html`, `style.css`

### 7. 📷 Atalho de captura no card do filho
- **Prioridade**: P2
- **Status**: TODO
- **Descrição**: Botão 📷 direto no card do filho no dashboard do pai, ao lado de ✏️ e 🗑. Leva direto à captura no contexto do filho.
- **Arquivos**: `dashboard-parent.html`, `dashboard-parent.js`

### 8. 💬 Dica pós-criação do filho
- **Prioridade**: P2
- **Status**: TODO
- **Descrição**: Após wizard de criação, mostrar dica: "Personalize sons e figurinhas em Editar Perfil!". Toast ou banner na tela de conclusão.
- **Arquivos**: `add-child.html`, `add-child.js`

### 9. 📸 Landing page — screenshot/mockup do app
- **Prioridade**: P2
- **Status**: TODO
- **Descrição**: Adicionar mockup do app na landing page (hero ou seção dedicada). Screenshot do quiz ou da trilha em um celular mockup.
- **Arquivos**: `landing.html`, `style.css`

### 10. 🔐 Login diferenciado pai vs filho
- **Prioridade**: P2
- **Status**: TODO
- **Descrição**: Dois botões visuais no login: "Sou Pai/Mãe" e "Sou Aluno(a)". Mesma tela de login, mas com ícones/cores que orientam a criança.
- **Arquivos**: `login.html`, `login.js`, `style.css`

### 11. 🎭 Migrar geração de personagem para Freepik API
- **Prioridade**: P1
- **Status**: BLOCKED (API trial expirou — aguardando Ricardo adicionar créditos)
- **Descrição**: Substituir DALL-E 3 por Freepik Google Nano Banana Pro. Estilo flat/Duolingo. Manter GPT-4o-mini Vision para descrição. Adicionar geração de vídeo animado via Seedance.
- **Arquivos**: `edit-child.js`, `config.js`

## Bugs pendentes (v0.8.0)
1. Progress só mostra no root folder, não nos subfolders
2. App version não visível no footer da área logada
3. Profile photo não salva
4. Foto do filho não aparece no dashboard do pai
5. Character generation criando múltiplos personagens

---

Ordem de execução: Bugs (1-5) → P0 (items 1-3) → P1 (items 4-6, 11) → P2 (items 7-10)
