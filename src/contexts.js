import { createContext } from "react";
import PropTypes from "prop-types";

// ── Task contexts — eliminates rowProps drilling through ProjectTree/CompletedTree ──
// Stable callbacks (completeTask, deleteTask, etc.) that TaskRow needs from GTDManager.
const TaskActionsContext = createContext(null);
// Shared state (currentBucket, allTasks, moveMenu, etc.) that every row in a view reads.
const TaskRowContext = createContext(null);

// Shared PropTypes shape for a task object — used across multiple components.
const taskShape = PropTypes.shape({
  id:           PropTypes.string.isRequired,
  text:         PropTypes.string.isRequired,
  bucket:       PropTypes.string.isRequired,
  done:         PropTypes.bool.isRequired,
  created:      PropTypes.number.isRequired,
  priority:     PropTypes.arrayOf(PropTypes.string),
  location:     PropTypes.arrayOf(PropTypes.string),
  dueDate:      PropTypes.string,
  effort:       PropTypes.string,
  actualEffort: PropTypes.string,
  deferUntil:   PropTypes.string,
  notes:        PropTypes.string,
  recurrence:   PropTypes.object,
  dueTime:      PropTypes.string,
  processed:    PropTypes.bool,
  parentId:     PropTypes.string,
  childIds:     PropTypes.arrayOf(PropTypes.string),
});

export { TaskActionsContext, TaskRowContext, taskShape };
