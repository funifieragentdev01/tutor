# Plano de Produto — Tutor

## Fase 1: Fundação (Semana 1)
### 1.1 Infraestrutura
- [x] Repo GitHub: funifieragentdev01/tutor
- [x] Netlify: tutor-funifier.netlify.app
- [ ] Gamificação "tutor" no Funifier Studio
- [ ] Roles + App (público, player, parent)
- [ ] Coleções customizadas (__c)

### 1.2 Identidade Visual
- [ ] Nome definitivo do produto (Teacher? Tutor? Outro?)
- [ ] Logo + Paleta + Tipografia
- [ ] Personagens (Beatriz e amiguinhos — capivara etc.)
- [ ] Estilo de cartoon para geração de avatares

### 1.3 Arquitetura de Dados
- [ ] Modelo de dados: parent, child, profile__c, trail__c, quiz__c, capture__c, reward__c
- [ ] Relação pai-filho (parent_id no player)
- [ ] Signup flow: pai cria conta → pai cria filho
- [ ] Autenticação separada pai/filho (mesma tela, experiências diferentes)

## Fase 2: MVP Core (Semanas 2-3)
### 2.1 Landing Page
- [ ] Hero com história da Beatriz (resumida)
- [ ] Proposta de valor (3 pilares)
- [ ] Pricing (Básico R$79, Família R$129)
- [ ] CTA signup

### 2.2 Auth & Onboarding
- [ ] Signup pai (email/senha + Google Login)
- [ ] Login (pai e filho, mesma tela)
- [ ] Onboarding conversacional do filho (chat com IA)
- [ ] Geração do avatar cartoon (foto → IA → aprovação)

### 2.3 Captura de Conteúdo
- [ ] Foto do caderno/livro (câmera + upload)
- [ ] OCR/Vision API para extrair conteúdo
- [ ] Input de data da prova
- [ ] Geração automática da trilha

### 2.4 Trilha de Aprendizado
- [ ] Mapa visual estilo Duolingo (mas dinâmico)
- [ ] Nós por tópico (status: pendente, em andamento, concluído)
- [ ] Conteúdo gerado por IA a partir da captura

### 2.5 Quiz Gamificado (CORE DO MVP)
- [ ] Perguntas hiper-personalizadas (perfil da criança injetado no prompt)
- [ ] Feedback de acerto: som + confete + "+1 ponto" + verde
- [ ] Feedback de erro: vermelho + explicação (sem punição)
- [ ] Marco surpresa (razão variável, >50%)
- [ ] Celebração épica 100% (animação personalizada)
- [ ] Tela de resultado (% acerto, pontos, evolução)

### 2.6 Flashcards
- [ ] Frente/verso interativo
- [ ] Gerados automaticamente do conteúdo capturado
- [ ] Modo revisão rápida

## Fase 3: Chat com Professor (Semana 4)
### 3.1 Chat texto
- [ ] Interface WhatsApp-like
- [ ] IA com contexto completo da criança
- [ ] Histórico de conversas por matéria

### 3.2 Chat áudio (ligação)
- [ ] OpenAI Realtime API (mesmo stack do Coach no fitness)
- [ ] IA fala português, conhece a criança
- [ ] Voz amigável e paciente

### 3.3 Chat vídeo (Premium)
- [ ] Avatar do professor (Three.js)
- [ ] Lip sync + expressões

## Fase 4: Gamificação & Engagement (Semana 5)
### 4.1 Área do Pai
- [ ] Dashboard com cards dos filhos
- [ ] Progresso por matéria
- [ ] Calendário de provas
- [ ] Recompensas reais (CRUD)

### 4.2 Área da Criança
- [ ] Home emocional (avatar, mensagem, foco do dia)
- [ ] Calendário de provas
- [ ] Revisão Express (véspera de prova)
- [ ] Conquistas/Badges
- [ ] Meus personagens

### 4.3 Sistema de Pontos & XP
- [ ] Pontos por quiz acertado
- [ ] XP por conteúdo concluído
- [ ] Streak de dias consecutivos
- [ ] Levels

## Fase 5: Pagamento & GTM (Semana 6)
### 5.1 Pagamento
- [ ] Asaas (reutilizar endpoints do fitness adaptados)
- [ ] Plano Básico R$79 + Família R$129
- [ ] Trial 7 dias

### 5.2 Go-to-Market
- [ ] CRM pipeline (no mesmo CRM do fitness)
- [ ] Instagram @teacher ou similar
- [ ] Landing page otimizada
- [ ] Email de lançamento
- [ ] Caso Beatriz como pitch

## Stack Técnica
- **Frontend**: AngularJS 1.8.2 (CDN) — mesma stack do fitness
- **Backend**: Funifier API (gamificação "tutor")
- **AI**: OpenAI GPT-4o (text), Vision API (OCR), Realtime API (voz)
- **Pagamento**: Asaas
- **Hosting**: Netlify (tutor-funifier.netlify.app)
- **Auth**: Funifier + Google Login

## Reutilização do Fitness
| Componente | Reutilizar? | Adaptação |
|-----------|-------------|-----------|
| AuthService | ✅ | Adicionar role parent vs child |
| DataSyncService | ✅ | Novas coleções |
| PlanService | ✅ | Novos planos/preços |
| FeedbackService | ✅ | Base perfeita para quiz |
| Coach (Realtime API) | ✅ | Adaptar para professor |
| Payment endpoints | ✅ | Novos planos |
| Signup flow | ✅ | Pai cria filho |
| Google Login | ✅ | Idêntico |
| CRM trigger | ✅ | Mesmo CRM, nova pipeline |
| Brand process | ✅ | Nova identidade |

## Coleções Customizadas
- `profile__c` — perfil estendido (gostos, amigos, histórias, memes)
- `child__c` — relação pai→filho
- `capture__c` — fotos de caderno/livro processadas
- `trail__c` — trilhas de aprendizado
- `topic__c` — tópicos individuais na trilha
- `quiz_result__c` — resultados de quiz
- `reward__c` — recompensas reais definidas pelo pai
- `exam__c` — provas cadastradas
- `character__c` — personagens gerados (cartoons)
