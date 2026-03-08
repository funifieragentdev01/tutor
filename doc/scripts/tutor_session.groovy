public Object handle(Object payload) {
    def result = [:]
    def body = (Map) payload
    def playerId = body.get("player_id")
    if (!playerId) { result.put("error", "player_id required"); return result }

    def player = manager.getPlayerManager().findById(playerId.toString())
    if (!player) { result.put("error", "player not found"); return result }

    // OpenAI config
    def openaiKey = "OPENAI_KEY_PLACEHOLDER"
    result.put("api_key", openaiKey)
    result.put("model", "gpt-realtime-mini")
    result.put("voice", "coral")

    // Player info
    result.put("player_name", player.name ?: "Aluno")

    def jongo = manager.getJongoConnection()

    // Get profile from profile__c
    try {
        def profile = jongo.getCollection("profile__c")
            .findOne("{_id: #}", playerId.toString())
            .as(java.util.Map.class)
        if (profile != null) {
            result.put("profile", profile)
        }
    } catch (Exception e) {
        result.put("profile_error", e.getMessage())
    }

    // Get folders (subjects, modules, lessons)
    try {
        def folders = []
        def it = jongo.getCollection("folder")
            .find("{}")
            .as(java.util.Map.class)
        int count = 0
        while (it.hasNext() && count < 100) {
            folders.add(it.next())
            count++
        }
        result.put("folders", folders)
    } catch (Exception e) {
        result.put("folders_error", e.getMessage())
    }

    // Get folder logs for this player
    try {
        def logs = []
        def it = jongo.getCollection("folder_log")
            .find("{player: #}", playerId.toString())
            .as(java.util.Map.class)
        int count = 0
        while (it.hasNext() && count < 100) {
            logs.add(it.next())
            count++
        }
        result.put("folder_logs", logs)
    } catch (Exception e) {
        result.put("folder_logs_error", e.getMessage())
    }

    // Get recent quiz results
    try {
        def results = []
        def it = jongo.getCollection("quiz_log")
            .find("{player: #}", playerId.toString())
            .sort("{_created: -1}")
            .limit(10)
            .as(java.util.Map.class)
        int count = 0
        while (it.hasNext() && count < 10) {
            results.add(it.next())
            count++
        }
        result.put("quiz_results", results)
    } catch (Exception e) {
        result.put("quiz_results_error", e.getMessage())
    }

    // Get exams
    try {
        def exams = []
        def it = jongo.getCollection("exam__c")
            .find("{player: #}", playerId.toString())
            .as(java.util.Map.class)
        int count = 0
        while (it.hasNext() && count < 50) {
            exams.add(it.next())
            count++
        }
        result.put("exams", exams)
    } catch (Exception e) {
        result.put("exams_error", e.getMessage())
    }

    return result
}
