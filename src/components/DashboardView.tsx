import React, { useState } from "react";
import { Sparkles, FileText, CheckSquare, BarChart, BookOpen, Clock, ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
import { ChatSession, NoteRecord, TaskRecord, GoalRecord } from "../types";
import { localStore } from "../lib/firebase";

interface DashboardViewProps {
  user: any;
  chats: ChatSession[];
  notes: NoteRecord[];
  tasks: TaskRecord[];
  goals: GoalRecord[];
  onNavigate: (tab: string) => void;
  onRefreshStates: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  chats,
  notes,
  tasks,
  goals,
  onNavigate,
  onRefreshStates,
}) => {
  const [quickScribble, setQuickScribble] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const averageGoalProgression = goals.length
    ? Math.round((goals.reduce((acc, current) => acc + (current.currentValue / current.targetValue), 0) / goals.length) * 100)
    : 0;

  const handleCreateScribbleNote = () => {
    if (!quickScribble.trim()) return;
    const newNote: NoteRecord = {
      noteId: "note-" + Math.random().toString(36).substring(3, 9),
      userId: user?.userId ?? "local-user-id",
      title: "Quick Scribble: " + quickScribble.slice(0, 20) + (quickScribble.length > 20 ? "..." : ""),
      content: `# Quick Scribble\n\n${quickScribble}\n\n*Created from Dashboard rapid action.*`,
      folder: "Unsorted",
      isSynced: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStore.saveNote(newNote);
    setQuickScribble("");
    onRefreshStates();
    onNavigate("notes");
  };

  const handleQuickAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: TaskRecord = {
      taskId: "task-" + Math.random().toString(36).substring(3, 9),
      userId: user?.userId ?? "local-user-id",
      title: newTaskTitle,
      status: "pending",
      reminderEnabled: false,
      createdAt: new Date().toISOString(),
    };
    localStore.saveTask(newTask);
    setNewTaskTitle("");
    setAddingTask(false);
    onRefreshStates();
  };

  const handleToggleTaskStatus = (task: TaskRecord) => {
    const updated: TaskRecord = {
      ...task,
      status: task.status === "pending" ? "completed" : "pending",
    };
    localStore.saveTask(updated);
    onRefreshStates();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greetings Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Welcome back, <span className="bg-gradient-to-r from-indigo-500 to-indigo-400 bg-clip-text text-transparent">{user?.displayName || "Rahul"}</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            OmniMind is synchronized. You have {pendingTasks.length} pending actions and {notes.length} offline cache points.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            id="dash_action_chat"
            onClick={() => onNavigate("chat")}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm"
          >
            Start Chat Session
          </button>
          <button
            id="dash_action_doc"
            onClick={() => onNavigate("documents")}
            className="px-4 py-2 text-xs font-semibold bg-gray-100 dark:bg-[#1b222d] hover:bg-gray-200 dark:hover:bg-[#232c3a] text-gray-700 dark:text-gray-200 rounded-xl transition-all"
          >
            Upload File
          </button>
        </div>
      </div>

      {/* Analytics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-[#0f131a] p-5 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Active Dialogues</span>
            <span className="text-3xl font-bold text-gray-900 dark:text-white block">{chats.length}</span>
            <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">Synced Cloud Logs</span>
          </div>
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-[#0f131a] p-5 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Offline Notes</span>
            <span className="text-3xl font-bold text-gray-900 dark:text-white block">{notes.length}</span>
            <span className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">{notes.filter(n => n.isSynced).length} Synced To Firestore</span>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-[#0f131a] p-5 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Todo Checklist</span>
            <span className="text-3xl font-bold text-gray-900 dark:text-white block">{pendingTasks.length}</span>
            <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">{completedTasks.length} Done Completed</span>
          </div>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-[#0f131a] p-5 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Goal completion</span>
            <span className="text-3xl font-bold text-gray-900 dark:text-white block">{averageGoalProgression}%</span>
            <span className="text-xs text-teal-500 dark:text-teal-400 font-medium">{goals.length} Active Targets</span>
          </div>
          <div className="p-2 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-lg">
            <BarChart className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 column block: Goals & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Goals section */}
          <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-bold text-gray-900 dark:text-white">Active Goal Progress</h3>
                <p className="text-xs text-gray-400">Tracking long-term objectives and skill markers</p>
              </div>
              <button
                id="dash_go_goals"
                onClick={() => onNavigate("tasks")}
                className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold flex items-center gap-1"
              >
                Manage Goals <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-2">
              {goals.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No targets defined yet. Head to the Tasks tab.</p>
              ) : (
                goals.map((g) => {
                  const percent = Math.min(Math.round((g.currentValue / g.targetValue) * 100), 100);
                  return (
                    <div id={`goal_card_${g.goalId}`} key={g.goalId} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{g.title}</span>
                        <span className="text-gray-400 font-medium">
                          {g.currentValue} / {g.targetValue} {g.unit || "units"} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-[#161d27] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Tasks checkbox panel */}
          <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-bold text-gray-900 dark:text-white">Productivity Task Board</h3>
                <p className="text-xs text-gray-400">Checkbox lists cached in LocalStorage</p>
              </div>
              {!addingTask ? (
                <button
                  id="dash_add_task_toggle"
                  onClick={() => setAddingTask(true)}
                  className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                >
                  + Add Quick Task
                </button>
              ) : (
                <button
                  id="dash_cancel_task_toggle"
                  onClick={() => setAddingTask(false)}
                  className="text-xs text-gray-400 hover:text-gray-500 font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>

            {addingTask && (
              <form onSubmit={handleQuickAddTask} className="flex gap-2 bg-gray-50 dark:bg-[#151a24] p-3 rounded-xl">
                <input
                  id="dash_task_input"
                  type="text"
                  required
                  placeholder="What is your next goal?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1 text-xs bg-transparent text-gray-900 dark:text-white focus:outline-none placeholder-gray-400"
                />
                <button type="submit" className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold">
                  Add
                </button>
              </form>
            )}

            <div className="space-y-2 pt-2">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-500 italic flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> All items completed!
                </div>
              ) : (
                pendingTasks.slice(0, 4).map((t) => (
                  <div
                    id={`task_row_${t.taskId}`}
                    key={t.taskId}
                    onClick={() => handleToggleTaskStatus(t)}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#151a24] hover:bg-gray-100 dark:hover:bg-[#1a212e] rounded-xl cursor-pointer border border-transparent dark:border-transparent hover:border-indigo-100 dark:hover:border-indigo-950/40 transition-all text-xs"
                  >
                    <div className="w-5 h-5 rounded-md border border-gray-300 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-[#0f131a]">
                      <div className="w-2.5 h-2.5 rounded bg-transparent" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{t.title}</p>
                      {t.description && <p className="text-gray-400 text-[10px] mt-0.5 line-clamp-1">{t.description}</p>}
                    </div>
                    {t.dueDate && (
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium text-[10px] rounded-md flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.dueDate}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column sidebar: Quick Notes & Actions */}
        <div className="space-y-6">
          {/* Quick Scribbler */}
          <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
            <div>
              <h3 className="text-md font-bold text-gray-900 dark:text-white">Quick Note Scribble</h3>
              <p className="text-xs text-gray-400">Instantly persist markdown notes locally</p>
            </div>
            <textarea
              id="dash_scribble_textarea"
              rows={4}
              value={quickScribble}
              onChange={(e) => setQuickScribble(e.target.value)}
              className="w-full p-3 text-xs bg-gray-50 dark:bg-[#151a24] text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent placeholder-gray-400 resize-none transition-all"
              placeholder="Scribble down reminders or meeting key points..."
            />
            <button
              id="dash_scribble_submit"
              onClick={handleCreateScribbleNote}
              disabled={!quickScribble.trim()}
              className="w-full py-2 bg-gray-900 dark:bg-indigo-600 hover:bg-gray-800 dark:hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
            >
              Convert to Note <ArrowRight className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Recent Synced Notes card */}
          <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-bold text-gray-900 dark:text-white">Recent Cache Records</h3>
                <p className="text-xs text-gray-400">Fast load markdown documents</p>
              </div>
              <button
                id="dash_go_notes"
                onClick={() => onNavigate("notes")}
                className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
              >
                See All
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {notes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No notes created yet.</p>
              ) : (
                notes.slice(0, 3).map((n) => (
                  <div
                    id={`note_shortcut_${n.noteId}`}
                    key={n.noteId}
                    onClick={() => onNavigate("notes")}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#151a24] hover:bg-gray-100 dark:hover:bg-[#1a212e] rounded-xl cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{n.title}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap bg-gray-100 dark:bg-[#202937] px-2 py-0.5 rounded-md">
                      {n.folder || "General"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
