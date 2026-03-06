# Studio Setup — Tutor

## Gamificação
- **Nome:** Tutor
- **API Key:** `69ab1a9a607db81962b92cd2`
- **BASIC Token:** `Basic NjlhYjFhOWE2MDdkYjgxOTYyYjkyY2QyOg==`

## Roles (✅ Criadas)

### Role: public
- **Scope:** `read_all`
- **Uso:** Token Basic (signup, landing page)

### Role: player
- **Scope:** `read_all, write_all, delete_all, database`
- **Uso:** Token Bearer (usuários logados — pais e filhos)

## App (✅ Criada)
- **Nome:** Tutor App
- **App Secret:** `69ab3566607db81962b9686e`
- **Scope:** `read_all, write_all, delete_all, database`
- **Basic Token:** `Basic NjlhYjFhOWE2MDdkYjgxOTYyYjkyY2QyOjY5YWIzNTY2NjA3ZGI4MTk2MmI5Njg2ZQ==`

## Trigger: Signup Handler (✅ Criada)
- **Entity:** `signup__c`
- **Event:** `before_update`
- **Script:** `doc/scripts/trigger_signup.groovy`
- **Comportamento:** Valida campos, verifica duplicidade, cria Player com BCrypt hash, define extra.role e extra.plan

## Configurações de Segurança (✅)
- **requirePassword:** `true`
- **createPlayerIfDontExist:** `false`
- **Auth:** `POST /v3/auth/token` com `grant_type: "password"`, `apiKey`, `username`, `password`

## Signup Handler (Trigger)
- **Entidade:** `signup__c`
- **Evento:** `before_update`
- **Função:** Validação, BCrypt password, criação do player
- **Reutilizar:** Mesmo padrão do Orvya Fitness

## Coleções Customizadas
Serão criadas automaticamente via API (POST /v3/database):
- `signup__c` — signup temporário
- `profile__c` — perfil estendido (gostos, amigos, histórias)
- `child__c` — relação pai→filho
- `capture__c` — fotos de caderno/livro processadas
- `quiz_result__c` — resultados de quiz
- `reward__c` — recompensas reais
- `exam__c` — provas cadastradas
- `character__c` — personagens cartoon
