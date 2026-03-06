# Studio Setup — Tutor

## Gamificação
- **Nome:** Tutor
- **API Key:** `69ab1a9a607db81962b92cd2`
- **BASIC Token:** `Basic NjlhYjFhOWE2MDdkYjgxOTYyYjkyY2QyOg==`

## Roles (Ricardo precisa criar no Studio)

### Role: public
- **Scope:** `read_all`
- **Uso:** Token Basic (signup, landing page)

### Role: player
- **Scope:** `read_all, write_all, delete_all, database`
- **Uso:** Token Bearer (usuários logados — pais e filhos)

## App (Ricardo precisa criar no Studio)
- **Nome:** Tutor App
- **Scope:** `read_all, write_all, delete_all, database`
- **Uso:** Gerar Basic token não-expirante para triggers e endpoints internos

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
