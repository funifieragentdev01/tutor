# Tutor App — Product Roadmap
> Última atualização: 2026-03-10 | Versão atual: v0.25.2

## Visão do Produto
App de educação gamificada **personalizado por família**. Cada criança tem seu próprio personagem, trilha e recompensas. Simples pra criança, intuitivo pro pai. Acessível a todas as famílias — com ou sem recursos financeiros.

**Referência principal**: Duolingo (engajamento, design, gamificação)
**Diferencial**: Conteúdo personalizado pelo pai + personagem IA da própria criança

---

## Legenda de Prioridade
- 🔴 **P0 — Crítico**: Sem isso o app não funciona direito / bloqueia outras features
- 🟡 **P1 — Alto**: Core da experiência gamificada, alto impacto
- 🟢 **P2 — Médio**: Melhora significativa, pode esperar
- 🔵 **P3 — Futuro**: Nice-to-have, visão de longo prazo

## Legenda de Esforço
- ⚡ Pequeno (< 1 dia)
- 🔨 Médio (1-3 dias)
- 🏗️ Grande (3-7 dias)
- 🏔️ Épico (1-2 semanas)

---

## FASE 1 — Fundação da Gamificação
> Objetivo: Criar a base de pontos, moedas e recompensas que sustenta todo o resto.

### 1.1 🔴 Sistema de Pontos (XP + Coins)
**Esforço**: 🔨 Médio
- Criar 2 técnicas de pontos no Funifier: `xp` e `coins`
- XP: +1 por exercício correto (lição de 15 exercícios = 15 XP)
- Coins: ganhas apenas via baús (quantidade fixa: 5 Coins)
- Exibir XP total e Coins no header do dashboard da criança
- **Dependência**: Nenhuma
- **API**: POST /v3/point, GET /v3/point/balance

### 1.2 🔴 Baú de Moedas na Trilha
**Esforço**: 🔨 Médio
- Baú aparece na trilha após a 2ª lição de cada módulo
- Desbloqueado quando lição 2 estiver concluída (100%)
- Abre uma única vez → +5 Coins
- Visual: ícone de baú no estilo dos bubbles da trilha (locked/unlocked/opened)
- Animação de abertura (moedas saindo)
- **Dependência**: 1.1 (pontos devem existir)
- **Storage**: `chest__c` collection — { player, module_id, opened: bool, opened_at }

### 1.3 🟡 Loja de Recompensas (Virtual Goods)
**Esforço**: 🏗️ Grande
- Catálogo criado automaticamente no signup do filho (ID = extra.root_folder)
- Pai cadastra recompensas: título, foto, quantidade disponível, preço em Coins
- Criança vê loja e troca Coins por recompensas
- Pai aprova/confirma a troca (notificação)
- **API**: /v3/virtualgoods, /v3/catalog
- **Telas**:
  - Pai: Botão "Recompensas" no card do filho → CRUD de virtual goods
  - Criança: Aba "Loja" na bottom nav → grid de itens + botão "Trocar"
- **Dependência**: 1.1
- **Nota**: Famílias sem recursos financeiros podem criar recompensas não-financeiras (ex: "Escolher o filme do sábado", "30min extra de tela", "Passeio no parque")

### 1.4 🟡 Registro de XP por Exercício
**Esforço**: ⚡ Pequeno
- Atualmente o quiz registra completion via folder_log
- Adicionar: a cada resposta correta, POST action que gera +1 XP
- No resultado do quiz, mostrar XP ganho (já existe visual, falta backend)
- **Dependência**: 1.1

---

## FASE 2 — Experiência da Criança
> Objetivo: Transformar a interface de "app genérico" em "produto premium estilo Duolingo".

### 2.1 🟡 Redesign Dashboard Criança (`/child`)
**Esforço**: 🔨 Médio
- Header: Avatar (60px) + "Olá, Beatriz!" inline + stats (🔥 streak, ⚡ XP, 🪙 Coins)
- Hero: Personagem (variação estudando) com frase motivacional
- Cards de disciplina: coloridos, com barra de progresso visual, ícones FA flat
- Remover botão sair do header (usar bottom nav > Perfil > Sair)
- Lembretes/notificações inline (prova amanhã, revisão pendente)
- **Dependência**: 1.1 (para mostrar XP/Coins)

### 2.2 🟡 Conteúdos Variados de Exercícios
**Esforço**: 🏔️ Épico
- **Múltipla escolha** ✅ (já implementado)
- **Verdadeiro ou Falso**: variação simplificada da múltipla escolha (2 opções)
- **Resposta escrita**: campo de texto + validação por IA (GPT compara com resposta esperada)
- **Resposta por voz**: Web Speech API (reconhecimento) + IA valida transcrição
- **Combinação (Match)**: arrastar itens da coluna A para coluna B
- **Completar frase**: selecionar palavras para preencher lacunas
- **Palavras cruzadas**: grid interativo (mais complexo, P2)
- **Questões com imagem**: já suportado pelo Funifier (campo image na question)
- Cada tipo precisa de: UI própria, lógica de validação, geração via IA no capture
- **Prioridade interna**:
  1. V/F (⚡ fácil, é múltipla escolha com 2 opções)
  2. Resposta escrita + voz (🔨 médio, alto impacto)
  3. Completar frase (🔨 médio)
  4. Match/combinação (🏗️ grande)
  5. Palavras cruzadas (🏗️ grande, P3)

### 2.3 🟡 Uso Inteligente de Figurinhas/Memes
**Esforço**: 🔨 Médio
- Durante quiz, ao atingir marcos (60%, 80%, 100%): mostrar figurinha contextualizada
- IA (GPT-4o-mini) recebe: figurinha (descrição ou URL), contexto da questão, % de acerto
- Gera frase contextualizada que conecta o meme com a matéria
- Exibir como modal overlay com a figurinha + texto
- Random: nem sempre mostra (variable ratio reinforcement — como já fazemos com celebration)
- **Dependência**: Figurinhas já cadastradas no profile__c.stickers

### 2.4 🟡 Design Premium (Micro-interações)
**Esforço**: 🔨 Médio
- Animações de transição entre telas (slide in/out)
- Confetti/particles na conclusão de lição
- Bounce animation nos bubbles da trilha
- Personagem reage (pisca, acena) — CSS animation com sprite ou variações
- Som de level up, som de baú abrindo
- Haptic feedback (vibração) em mobile
- **Dependência**: Nenhuma (pode ser feito incrementalmente)

### 2.5 🟢 Streak (Sequência de Dias)
**Esforço**: 🔨 Médio
- Contar dias consecutivos em que a criança completou pelo menos 1 lição
- Exibir 🔥 no header do dashboard
- Notificação "Não perca seu streak!" se não estudou hoje
- **Storage**: action log no Funifier (1 action/dia)
- **Dependência**: 1.1

---

## FASE 3 — Experiência do Pai
> Objetivo: Dar ferramentas para o pai gerenciar e acompanhar o progresso.

### 3.1 🟡 Onboarding do Pai
**Esforço**: 🔨 Médio
- Telas de introdução no primeiro acesso (swipe carousel):
  1. "Tire foto do caderno → IA cria exercícios"
  2. "Acompanhe o progresso do seu filho"
  3. "Crie recompensas para motivar"
  4. "Personalize com o personagem do seu filho"
- Flag `onboarding_done` no player.extra
- **Dependência**: Nenhuma

### 3.2 🟡 Notificações Inteligentes
**Esforço**: 🏗️ Grande
- Push notifications via Web Push API (VAPID keys)
- Triggers baseados em:
  - Prova amanhã → "Beatriz, amanhã tem prova de Química! Que tal revisar?"
  - Sem estudar há 2+ dias → "Beatriz, sentimos sua falta!"
  - Streak em risco → "Não perca seu streak de 5 dias!"
  - Resultado de prova registrado → "Parabéns pela nota 9 em Química!"
- Lembretes no dashboard da criança (inline cards)
- **Dependência**: 2.5 (streak), calendário de provas (já existe)

### 3.3 🟡 Limpeza de Trilhas
**Esforço**: 🔨 Médio
- Pai pode excluir: módulos, lições, exercícios individuais
- Ao excluir módulo: confirmar "Apagar módulo e todas as lições?"
- Excluir progresso do filho em uma lição (para refazer)
- Sugestão automática: "Beatriz já completou 100% de 'Separação de Misturas'. Deseja arquivar?"
- Módulos arquivados vão para uma seção "Concluídos" (não some, mas sai do foco)
- **Dependência**: Nenhuma
- **⚠️ Cuidado**: `/v3/folder/{id}` DELETE é CASCADE

### 3.4 🟢 Registro de Notas
**Esforço**: ⚡ Pequeno
- Pai registra nota da prova real (já parcialmente implementado em exams)
- Exibir histórico de notas por disciplina
- **Dependência**: Exams (já existe)

### 3.5 🟢 Relatório de Desempenho
**Esforço**: 🔨 Médio
- Dashboard do pai mostra: gráfico de progresso semanal, XP acumulado, taxa de acerto
- Comparativo por disciplina
- **Dependência**: 1.1, 1.4

---

## FASE 4 — Escala e Polimento
> Objetivo: Preparar para usuários reais além da família teste.

### 4.1 🟢 PWA Completo
**Esforço**: 🔨 Médio
- Service worker para offline básico
- Install prompt (Add to Home Screen)
- Splash screen com logo
- **Dependência**: Nenhuma

### 4.2 🟢 Múltiplos Idiomas
**Esforço**: 🏗️ Grande
- i18n framework
- Português (default), English, Español
- **Dependência**: Nenhuma

### 4.3 🔵 Modo Multiplayer
**Esforço**: 🏔️ Épico
- Desafios entre amigos/irmãos
- Ranking entre crianças (opt-in pelo pai)
- **Dependência**: 1.1

### 4.4 🔵 IA Tutora por Voz
**Esforço**: 🏔️ Épico
- Chat de voz com personagem (OpenAI Realtime API — já temos padrão documentado)
- Personagem explica a matéria quando criança erra
- **Dependência**: 2.2 (voz)

---

## Sugestões Adicionais (do Jarvis)

### S1 🟢 Modo "Estudo Rápido" (5 min)
- Botão no dashboard: "Estudar 5 minutos"
- Seleciona automaticamente exercícios de revisão das matérias com menor % 
- Perfeito para manter streak sem comprometer muito tempo

### S2 🟢 Conquistas/Badges
- "Primeiro 100%", "Streak de 7 dias", "50 exercícios corretos"
- Usar técnica de badge do Funifier
- Exibir no perfil da criança

### S3 🟢 Modo Revisão Inteligente
- Repetição espaçada (spaced repetition) — questões que errou voltam depois
- Algoritmo simples: errou → volta em 1 dia, acertou → volta em 3 dias
- Alto impacto no aprendizado real

### S4 🔵 Compartilhamento Social
- Pai compartilha conquista do filho no WhatsApp/Instagram
- Card bonito com personagem + conquista + stats

---

## Ordem de Execução Sugerida

### Sprint 1 — Fundação (1 semana)
1. ~~Bugs pendentes~~ (maioria resolvida)
2. **1.1** Sistema de Pontos (XP + Coins)
3. **1.4** Registro de XP por exercício
4. **2.1** Redesign Dashboard Criança

### Sprint 2 — Gamificação Core (1 semana)
5. **1.2** Baú de Moedas na Trilha
6. **1.3** Loja de Recompensas
7. **2.4** Design Premium (micro-interações incrementais)

### Sprint 3 — Conteúdo + Pai (1 semana)
8. **2.2** Conteúdos Variados (V/F + resposta escrita primeiro)
9. **3.1** Onboarding do Pai
10. **3.3** Limpeza de Trilhas

### Sprint 4 — Engajamento (1 semana)
11. **2.3** Figurinhas contextualizadas
12. **2.5** Streak
13. **3.2** Notificações Inteligentes
14. **3.4** Registro de Notas

### Sprint 5+ — Escala
15. **S1-S4** Sugestões adicionais
16. **4.1-4.4** Escala e polimento

---

## Decisões Técnicas Pendentes
- [ ] Estrutura do `virtualgoods` / `catalog` no Funifier para loja de recompensas
- [ ] Web Push: VAPID keys, service worker, permissão do navegador
- [ ] Spaced repetition: armazenar em collection customizada ou usar action log?
- [ ] Tipos de questão: como o capture/IA deve gerar diferentes tipos?
- [ ] Figurinhas: IA precisa "ver" a imagem ou basta uma descrição textual cadastrada pelo pai?

---

## Bugs Conhecidos (Backlog)
- [ ] `bia@funifier.com` — conta com campos faltando (password hash, extra)
- [ ] Emojis restantes em: landing.html, trail.html, quiz.html, dashboard-child.html
- [ ] `saveBodyPhoto()` em edit-child.js — verificar se base64 ainda pode vazar
- [ ] Disciplina "Inglês" criada com parent errado (dado sujo do bug anterior) — limpar no banco
