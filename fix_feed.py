import re
import sys

file_path = "f:/Fiverr/Projects done Fiverr/GreenSports/src/screens/Features/TeamFeedScreen.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add originalItem mapping
content = re.sub(r'(id: `match-\$\{match\.id\}`,)', r'\1\n        originalItem: match,', content)
content = re.sub(r'(id: `allpost-match-\$\{.*?\}`,)', r'\1\n            originalItem: match,', content)
content = re.sub(r'(id: `all-match-\$\{match\.id\}`,)', r'\1\n        originalItem: match,', content)

content = re.sub(r'(id: `event-\$\{event\.id\}`,)', r'\1\n        originalItem: event,', content)
content = re.sub(r'(id: `allpost-event-\$\{.*?\}`,)', r'\1\n            originalItem: event,', content)
content = re.sub(r'(id: `all-event-\$\{event\.id\}`,)', r'\1\n        originalItem: event,', content)

content = re.sub(r'(id: `update-\$\{update\.id\}`,)', r'\1\n        originalItem: update,', content)
content = re.sub(r'(id: `allpost-update-\$\{.*?\}`,)', r'\1\n            originalItem: update,', content)
content = re.sub(r'(id: `all-update-\$\{update\.id\}`,)', r'\1\n        originalItem: update,', content)

content = re.sub(r'(id: `checklist-\$\{checklist\.id\}`,)', r'\1\n        originalItem: checklist,', content)
content = re.sub(r'(id: `allpost-checklist-\$\{.*?\}`,)', r'\1\n            originalItem: checklist,', content)
content = re.sub(r'(id: `all-checklist-\$\{checklist\.id\}`,)', r'\1\n        originalItem: checklist,', content)

content = re.sub(r'(id: `training-\$\{plan\.id\}`,)', r'\1\n        originalItem: plan,', content)
content = re.sub(r'(id: `allpost-training-\$\{.*?\}`,)', r'\1\n            originalItem: plan,', content)
content = re.sub(r'(id: `all-training-\$\{plan\.id\}`,)', r'\1\n        originalItem: plan,', content)

content = re.sub(r'(id: `task-\$\{task\.id\}`,)', r'\1\n        originalItem: task,', content)
content = re.sub(r'(id: `allpost-task-\$\{.*?\}`,)', r'\1\n            originalItem: task,', content)
content = re.sub(r'(id: `all-task-\$\{task\.id\}`,)', r'\1\n        originalItem: task,', content)

# 2. Update activeOpacity and disabled props
content = content.replace('disabled={row.kind !== "match"}', 'disabled={!["match", "event", "task", "update", "checklist", "training"].includes(row.kind)}')
content = content.replace('activeOpacity={row.kind === "match" ? 0.92 : 1}', 'activeOpacity={["match", "event", "task", "update", "checklist", "training"].includes(row.kind) ? 0.92 : 1}')

# 3. Replace openMatchDetails function
new_open_match = """  const openMatchDetails = (row) => {
    if (!row) return;
    if (row.kind === "match" || row.kind === "event") {
      navigation.navigate("MatchDetails", {
        match: row.originalItem || {
          id: row.eventId || row.id,
          teamId,
          teamName: row.teamName || selectedTeam?.name || "Team",
          opponent: row.opponent || "Opponent",
          date: row.date || "",
          startTime: row.startTime || "",
          location: row.location || "",
          status: row.status || "scheduled",
          ourScore: row.ourScore,
          opponentScore: row.opponentScore,
          description: row.description || "",
        },
      });
    } else if (row.kind === "task") {
      navigation.navigate("Tasks", { openTask: row.originalItem });
    } else if (row.kind === "update") {
      navigation.navigate("Updates");
    } else if (row.kind === "checklist") {
      navigation.navigate("ClubOperations", { initialTab: 1 });
    } else if (row.kind === "training") {
      navigation.navigate("ClubOperations", { initialTab: 5 });
    }
  };"""

content = re.sub(r'  const openMatchDetails = \(row\) => \{[\s\S]*?    \};\n', new_open_match + '\n', content)

# 4. Add taskFilter state
filter_state = """  const [activeTab, setActiveTab] = useState("All Posts");
  const [taskFilter, setTaskFilter] = useState("Upcoming");"""
content = content.replace('  const [activeTab, setActiveTab] = useState("All Posts");', filter_state)

# 5. Modify activeTab === "Tasks" map inside feedRows useMemo
old_tasks_map = """    if (activeTab === "Tasks") {
      return teamTasks.map((task) => ({"""
new_tasks_map = """    if (activeTab === "Tasks") {
      let filteredTasks = teamTasks;
      if (taskFilter === "Upcoming") {
        filteredTasks = teamTasks.filter(t => !["completed", "done", "resolved"].includes(String(t.status || "").toLowerCase()));
      } else if (taskFilter === "Completed") {
        filteredTasks = teamTasks.filter(t => ["completed", "done", "resolved"].includes(String(t.status || "").toLowerCase()));
      }
      return filteredTasks.map((task) => ({"""
content = content.replace(old_tasks_map, new_tasks_map)

# Add taskFilter to dependency array of feedRows useMemo
content = content.replace('teamTasks,\n    teamShifts,\n  ]);', 'teamTasks,\n    teamShifts,\n    taskFilter,\n  ]);')

# 6. Add task filters UI above feed rows
old_ui = """          {FEED_TABS.map((tab) => {"""
new_ui = """          {activeTab === "Tasks" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              {["Upcoming", "Completed", "All"].map(filter => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setTaskFilter(filter)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    backgroundColor: taskFilter === filter ? theme.colors.primary : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: taskFilter === filter ? theme.colors.primary : theme.colors.border,
                    marginRight: 8
                  }}
                >
                  <Text variant="small" color={taskFilter === filter ? theme.colors.white : theme.colors.textSecondary} weight={taskFilter === filter ? "600" : "400"}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {FEED_TABS.map((tab) => {"""
content = content.replace(old_ui, new_ui)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated TeamFeedScreen.js")
