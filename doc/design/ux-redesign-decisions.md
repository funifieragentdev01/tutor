# Studini UX Redesign — Decisões de Design (2026-03-15)

## Visão Geral
Redesign das telas internas do aluno para criar uma experiência "mágica e encantadora", 
alinhada com o visual da landing page e login. Tema: Harry Potter / escola de magia.

## Fases de Implementação

### Fase 1 — Atmosfera Mágica (CSS) ✅ v0.29.2
- Partículas estelares twinkling no fundo (CSS puro, dual-layer)
- Gradiente escuro no topo das páginas
- Glow effects em cards, bolhas, botões
- Animações de fade-in e scale-in
- Scrollbar customizada
- Não afeta landing/login

### Fase 2 — Dashboard Mágico
**Conceito aprovado:** dashboard-freepik-approved.jpg
- Header com avatar do personagem + saudação "Bem-vindo, Aprendiz [Nome]!"
- XP total + Daily Streak (ícone de fogo + dias)
- Cards de disciplina estilizados como livros/portais mágicos
  - Opção aprovada: 6-8 ícones temáticos pré-definidos (livro, poção, cristal, portal, pergaminho...)
  - Pai escolhe o ícone ao criar disciplina
- Barra de progresso estilo "poção" (frasco preenchendo)
- Coruja mascote no canto com balão de fala motivacional (frases randômicas)
- Background com círculos rúnicos como overlay sutil

### Fase 3 — Trilha Mágica (S-Curve)
**Conceito aprovado:** trail-freepik-approved.jpg
- Manter estrutura S-curve do Duolingo (zigue-zague: esquerda, centro, direita)
- Vista aérea (top-down) — NÃO perspectiva 3D (inviável para scroll)
- **Caminho dourado vs escuro**: pedras brilham dourado no trecho desbloqueado, 
  ficam escuras/cinza no trecho bloqueado (feedback visual de progresso)
- Bolhas: dourada com runa (completa), laranja (disponível), cristal cinza com cadeado (bloqueada)
- Vegetação lateral (arbustos, troncos) — 2-3 variações alternando lados
- Background de floresta mágica escura (tileable verticalmente)
- Personagem do aluno posicionado ao lado da bolha ativa
- Coruja mascote voando ao lado de uma bolha

**Assets necessários (Freepik):**
1. Background floresta escura tileable
2. 2-3 variações de vegetação lateral (PNG transparente)
3. Textura pedras douradas para caminho desbloqueado
4. Textura pedras escuras para caminho bloqueado

### Fase 4 — Quiz Mágico
**Conceito base:** quiz-freepik-concept.jpg
- **Pergunta em pergaminho**: card estilizado como pergaminho mágico (CSS + imagem de fundo)
- **Coruja ao lado**: mascote posicionada ao lado do pergaminho
- **Varinha mágica como barra de progresso**: imagem da varinha com barra de progresso por cima, 
  ponta brilha conforme avança
- **Respostas NÃO são cartas**: formato de cartas lado a lado inviável para frases longas
  - Manter botões verticais full-width (empilhados)
  - Estilizar com textura de pergaminho escuro ou borda dourada
  - Letra (A, B, C, D) em selo circular estilo lacre de cera
  - Seleção: borda brilha laranja
  - Correta: glow verde com partículas
  - Errada: glow vermelho sutil

### Fase 5 — Chat Professor Studini
- Avatar da coruja mascote (substituir emoji genérico)
- Background temático (quadro-negro ou pergaminho)
- Chips de sugestão estilizados como cards mágicos

### Fase 6 — Polish
- Sons (acerto, level up, abertura)
- Confetti expandido para milestones
- Splash screen com mascote

## Decisões Estratégicas

### Temas de Mundo Personalizáveis (v2)
**Decisão:** Na v2 do app, permitir que a criança escolha/altere a temática visual do mundo.
Isso muda background, vegetação, cores e elementos em TODAS as telas (dashboard, trilha, quiz, chat).

**Exemplos de temas:**
- 🧙 Mundo Mágico (padrão — floresta Harry Potter, preto/laranja/dourado)
- 🌊 Mundo Oceano (fundo marinho, bolhas são pérolas, vegetação = corais)
- 🚀 Mundo Espacial (galáxia, bolhas são planetas, vegetação = asteroides)
- 🌸 Mundo Encantado (jardim de fadas, bolhas são flores, vegetação = cogumelos)
- 🏰 Mundo Medieval (castelo, bolhas são escudos, vegetação = torres)

**Viabilidade técnica:** Alta. Cada tema = conjunto de assets (background, vegetação, cores CSS).
Parametrizável via configuração no perfil do aluno.

**Valor de gamificação:** Octalysis Core Drive #3 (Empowerment of Creativity & Feedback) — 
a criança sente que o mundo é SEU, personalizado.

### Ícones de Disciplina
**Decisão:** Usar 6-8 ícones temáticos pré-definidos (não gerar via IA).
- Mais rápido, sem custo de crédito por disciplina
- Controle de qualidade visual
- Pai escolhe ao criar a disciplina

### Perspectiva da Trilha
**Decisão:** Vista aérea (top-down), NÃO perspectiva 3D.
- Perspectiva 3D quebra com scroll (pedras maiores embaixo = confusão)
- Background com perspectiva não é tileable
- Vista aérea permite scroll natural e background repetível

## Referências de Design
- `doc/brand/owl-reference.jpg` — Referência principal da coruja (close-up, olhos laranja)
- `doc/brand/mascot-full.jpg` — Mascote completo (coruja com chapéu, livro, estrelas)
- `doc/design/dashboard-concept-*.jpg` — Conceitos gerados (text-to-image)
- `doc/design/trail-concept-*.jpg` — Conceitos gerados (text-to-image)
- `doc/design/quiz-concept-*.jpg` — Conceitos gerados (text-to-image)

## Prompts Freepik Utilizados
Os prompts estão documentados nas conversas do dia 2026-03-15.
Ricardo usou a imagem de referência da coruja junto com cada prompt.
