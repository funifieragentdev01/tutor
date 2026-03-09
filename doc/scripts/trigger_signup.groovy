// Trigger: before_update on signup__c
// Validates signup data, creates player with BCrypt password via PM

void trigger(event, entity, player, database) {
    def pm = manager.getPlayerManager()
    def email = entity.get("email")
    def name = entity.get("name")
    def password = entity.get("password")
    def role = entity.get("role")

    if (email == null || email.toString().trim().length() == 0) {
        entity.put("error", "Email obrigatorio")
        entity.remove("password")
        return
    }
    if (password == null || password.toString().trim().length() == 0) {
        entity.put("error", "Senha obrigatoria")
        entity.remove("password")
        return
    }
    if (name == null || name.toString().trim().length() == 0) {
        entity.put("error", "Nome obrigatorio")
        entity.remove("password")
        return
    }

    def existing = pm.findById(email.toString().trim())
    if (existing != null) {
        entity.put("error", "Email ja cadastrado")
        entity.remove("password")
        return
    }

    def newPlayer = new Player()
    newPlayer.id = email.toString().trim()
    newPlayer.name = name.toString().trim()
    newPlayer.email = email.toString().trim()
    newPlayer.password = com.funifier.engine.util.BCrypt.hashpw(password.toString(), com.funifier.engine.util.BCrypt.gensalt())

    def extra = new java.util.HashMap()
    extra.put("role", role != null ? role.toString() : "parent")
    extra.put("plan", ["type": "basic", "status": "trial", "created": new Date().getTime()])
    extra.put("created", new Date().getTime())
    def parentId = entity.get("parent_id")
    if (parentId != null && parentId.toString().trim().length() > 0) {
        extra.put("parent_id", parentId.toString().trim())
    }
    extra.put("root_folder", newShortGuid())
    newPlayer.extra = extra

    pm.insert(newPlayer)

    entity.remove("password")
    entity.put("success", true)
    entity.put("player_id", email.toString().trim())
    entity.put("root_folder", newPlayer.extra.get("root_folder"))
}
