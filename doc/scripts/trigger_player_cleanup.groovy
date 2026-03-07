// Trigger: after_delete on player
// Cleans up all data linked to a deleted child player:
// profile__c, signup__c, root folder (cascade deletes subfolders/content/quiz/questions/logs)
// Also removes child from parent's profile__c.children array

void trigger(event, entity, player, database) {
    def jongo = manager.getJongoConnection()
    def playerId = entity.get("_id")
    if (playerId == null) return

    def pid = playerId.toString().trim()

    // 1. Get player extra to find parent_id
    def extra = entity.get("extra")
    def parentId = null
    try {
        parentId = extra.get("parent_id")
    } catch (Exception e) {
        // extra may not be a Map
    }

    // 2. Delete root folder (cascade: subfolders, folder_content, quiz, questions, logs)
    // FolderManager.deleteFolder does recursive cascade
    def fm = manager.getFolderManager()
    try {
        fm.deleteFolder(pid)
    } catch (Exception e) {
        // folder may not exist, ignore
    }

    // 3. Delete profile__c
    jongo.getCollection("profile__c").remove("{_id: #}", pid)

    // 4. Delete signup__c
    jongo.getCollection("signup__c").remove("{_id: #}", pid)

    // 5. Remove child from parent's children array
    if (parentId != null && parentId.toString().trim().length() > 0) {
        def parentPid = parentId.toString().trim()
        jongo.getCollection("profile__c").update("{_id: #}", parentPid).with("{" + String.valueOf((char)0x24) + "pull: {children: #}}", pid)
    }
}
