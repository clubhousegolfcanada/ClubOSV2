import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import logger from '@/services/logger';

interface Task {
  id: string;
  text: string;
  is_completed: boolean;
  created_at: string;
}

export const TaskList = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { notify } = useNotifications();
  const { user } = useAuthState();

  // Load collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('taskListCollapsed');
    if (savedState !== null) {
      setIsCollapsed(savedState === 'true');
    }
  }, []);

  // Load tasks when user is authenticated
  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('taskListCollapsed', String(newState));
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await http.get('tasks');
      if (response.data.success) {
        setTasks(response.data.data);
      }
    } catch (error) {
      logger.error('Failed to load tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      await http.post('tasks', { text: newTask });
      setNewTask('');
      loadTasks();
    } catch (error) {
      notify('error', 'Failed to add task');
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    try {
      await http.patch(`tasks/${id}`, { is_completed: completed });
      loadTasks();
    } catch (error) {
      notify('error', 'Failed to update task');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await http.delete(`tasks/${id}`);
      loadTasks();
    } catch (error) {
      notify('error', 'Failed to delete task');
    }
  };

  const activeTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  if (!user) {
    return null;
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg">
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            My Tasks
          </h3>
          {isCollapsed && activeTasks.length > 0 && (
            <span className="bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">
              {activeTasks.length}
            </span>
          )}
        </div>
        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        isCollapsed ? 'max-h-0' : 'max-h-[600px]'
      }`}>
        <div className="p-4 pt-0">
          {/* Add Task Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={addTask}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Task List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {loadingTasks ? (
              <div className="text-center py-8">
                <Loader className="w-5 h-5 animate-spin mx-auto text-[var(--accent)]" />
              </div>
            ) : (
              <>
                {/* Active Tasks */}
                {activeTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => toggleTask(task.id, true)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="flex-1 text-sm text-[var(--text-primary)]">{task.text}</span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Completed Section */}
                {completedTasks.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-[var(--border-secondary)]">
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      + {completedTasks.length} completed {showCompleted ? '▼' : '▶'}
                    </button>

                    {showCompleted && (
                      <div className="mt-2 space-y-2">
                        {completedTasks.map(task => (
                          <div key={task.id} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg opacity-60">
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => toggleTask(task.id, false)}
                              className="w-4 h-4 rounded"
                            />
                            <span className="flex-1 text-sm line-through text-[var(--text-muted)]">{task.text}</span>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state */}
                {tasks.length === 0 && (
                  <div className="text-center py-8 text-sm text-[var(--text-muted)]">
                    No tasks yet. Add one above!
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};