const bodyText = `#task# Tes masupin task dengan Sub task, kategori, prioritas
#priority# Medium
#category# UAT
#subtask# Tes 1
#subtask# Tes 2
#parent_task# IC-00455`;

var description = "";
var match = bodyText.match(/#task#\s*(.*?)(?:\r?\n|$)/i);
if (match && match[1]) {
  description = match[1].trim(); 
}
console.log("description:", description);

var parentTaskId = null;
var parentMatch = bodyText.match(/#parent_task#\s*(.*?)(?:\r?\n|$)/i);
if (parentMatch && parentMatch[1]) {
  parentTaskId = parentMatch[1].trim();
}
console.log("parentTaskId:", parentTaskId);

var category = "General";
var categoryMatch = bodyText.match(/#category#\s*(.*?)(?:\r?\n|$)/i);
if (categoryMatch && categoryMatch[1]) {
  category = categoryMatch[1].trim();
}
console.log("category:", category);

var priority = "LOW";
var priorityMatch = bodyText.match(/#priority#\s*(.*?)(?:\r?\n|$)/i);
if (priorityMatch && priorityMatch[1]) {
  priority = priorityMatch[1].trim().toUpperCase();
}
console.log("priority:", priority);

var subtasks = [];
var subtaskRegex = /#subtask#\s*(.*?)(?:\r?\n|$)/gi;
var subtaskMatch;
while ((subtaskMatch = subtaskRegex.exec(bodyText)) !== null) {
  if (subtaskMatch[1]) {
    subtasks.push(subtaskMatch[1].trim());
  }
}
console.log("subtasks:", subtasks);
