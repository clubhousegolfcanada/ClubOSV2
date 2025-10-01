import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown, ChevronUp, Loader, Check, Edit2 } from 'lucide-react';
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
    // Auto-focus textarea when expanding
    if (!newState && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300); // Wait for animation to complete
    }
  };

  // Auto-resize textarea as user types
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
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
      await http.post('tasks', { text: newTask.trim() });
      setNewTask('');
      loadTasks();
      // Auto-focus textarea for continuous entry (Google Keep style)
      setTimeout(() => {
        textareaRef.current?.focus();
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }, 100);
    } catch (error) {
      notify('error', 'Failed to add task');
    }
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingText(task.text);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 50);
  };

  const saveEdit = async (taskId: string) => {
    if (!editingText.trim()) {
      setEditingTaskId(null);
      return;
    }
    if (editingText === tasks.find(t => t.id === taskId)?.text) {
      setEditingTaskId(null);
      return;
    }
    try {
      await http.patch(`tasks/${taskId}`, { text: editingText.trim() });
      loadTasks();
      setEditingTaskId(null);
    } catch (error) {
      notify('error', 'Failed to update task');
    }
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditingText('');
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

  // Sort tasks: active first, then completed
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.is_completed === b.is_completed) {
      // If both have same status, sort by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    // Active tasks come first
    return a.is_completed ? 1 : -1;
  });

  const activeTasks = tasks.filter(t => !t.is_completed);

  if (!user) {
    return null;
  }

  return (
    <div className="card mt-4">
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors rounded-lg -m-3 p-3"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
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
        <div className="pt-3">
          {/* Add Task Textarea */}
          <div className="flex gap-2 mb-4">
            <textarea
              ref={textareaRef}
              value={newTask}
              onChange={(e) => {
                setNewTask(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addTask();
                }
              }}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg focus:outline-none focus:border-[var(--accent)] resize-none overflow-hidden"
              autoComplete="on"
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck={true}
              rows={1}
              style={{ minHeight: '38px', lineHeight: '1.5' }}
            />
            <button
              onClick={addTask}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:opacity-90 self-start"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Task List */}
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {loadingTasks ? (
              <div className="text-center py-8">
                <Loader className="w-5 h-5 animate-spin mx-auto text-[var(--accent)]" />
              </div>
            ) : (
              <>
                {/* All Tasks - Google Keep Style */}
                {sortedTasks.map(task => (
                  <div
                    key={task.id}
                    className={`
                      flex items-center gap-3 rounded-lg transition-all duration-300 ease-in-out group
                      ${task.is_completed
                        ? 'opacity-50 p-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transform scale-[0.98]'
                        : 'p-3 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] opacity-100'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      onChange={() => toggleTask(task.id, !task.is_completed)}
                      className="w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                    />
                    {editingTaskId === task.id && !task.is_completed ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEdit(task.id);
                          } else if (e.key === 'Escape') {
                            cancelEdit();
                          }
                        }}
                        onBlur={() => saveEdit(task.id)}
                        className="flex-1 px-2 py-1 text-sm bg-[var(--bg-secondary)] border border-[var(--accent)] rounded focus:outline-none"
                        autoComplete="on"
                        autoCorrect="on"
                        spellCheck={true}
                      />
                    ) : (
                      <span
                        className={`
                          flex-1 text-sm cursor-pointer transition-all duration-200
                          ${task.is_completed
                            ? 'line-through text-[var(--text-muted)] decoration-1'
                            : 'text-[var(--text-primary)]'
                          }
                        `}
                        onClick={() => !task.is_completed && startEditing(task)}
                      >
                        {task.text}
                      </span>
                    )}
                    {/* Edit button - only for active tasks */}
                    {!task.is_completed && (
                      editingTaskId === task.id ? (
                        <button
                          onClick={() => saveEdit(task.id)}
                          className="text-green-500 hover:text-green-600 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditing(task)}
                          className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className={`
                        transition-colors
                        ${task.is_completed
                          ? 'text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-50'
                          : 'text-[var(--text-muted)] hover:text-red-500'
                        }
                      `}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

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