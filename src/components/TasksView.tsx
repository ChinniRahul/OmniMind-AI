import React, { useState } from "react";
import { CheckSquare, Calendar, Target, Plus, Trash, Clock, Check, Bell, Flame, ChevronRight } from "lucide-react";
import { TaskRecord, GoalRecord } from "../types";
import { localStore } from "../lib/firebase";

interface TasksViewProps {
  user: any;
  tasks: TaskRecord[];
  goals: GoalRecord[];
  onRefreshStates: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  user,
  tasks,
  goals,
  onRefreshStates,
}) => {
  const [activeSegment, setActiveSegment] = useState<"tasks" | "goals">("tasks");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // New Goal State
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState(10);
  const [goalUnit, setGoalUnit] = useState("Milestones");
  const [goalDeadline, setGoalDeadline] = useState("");

  // New Task State
  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskGoalId, setTaskGoalId] = useState("");
  const [taskReminder, setTaskReminder] = useState(false);

  // Filter tasks based on selected calendar day if any
  const filteredTasks = tasks.filter((t) => {
    if (!selectedDay) return true;
    if (!t.dueDate) return false;
    const dayVal = parseInt(t.dueDate.split("-")[2], 10);
    return dayVal === selectedDay;
  });

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    const newGoal: GoalRecord = {
      goalId: "goal-" + Math.random().toString(36).substring(3, 9),
      userId: user?.userId ?? "local-user-id",
      title: goalTitle,
      targetValue: Number(goalTarget),
      currentValue: 0,
      unit: goalUnit,
      deadline: goalDeadline || undefined,
      createdAt: new Date().toISOString(),
    };

    localStore.saveGoal(newGoal);
    onRefreshStates();
    setGoalTitle("");
    setGoalDeadline("");
    setAddingGoal(false);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const newTask: TaskRecord = {
      taskId: "task-" + Math.random().toString(36).substring(3, 9),
      userId: user?.userId ?? "local-user-id",
      title: taskTitle,
      description: taskDesc || undefined,
      status: "pending",
      dueDate: taskDueDate || undefined,
      goalId: taskGoalId || undefined,
      reminderEnabled: taskReminder,
      createdAt: new Date().toISOString(),
    };

    localStore.saveTask(newTask);
    onRefreshStates();
    setTaskTitle("");
    setTaskDesc("");
    setTaskDueDate("");
    setTaskGoalId("");
    setTaskReminder(false);
    setAddingTask(false);
  };

  const handleToggleTask = (task: TaskRecord) => {
    const updated: TaskRecord = {
      ...task,
      status: task.status === "pending" ? "completed" : "pending",
    };
    localStore.saveTask(updated);
    onRefreshStates();
  };

  const handleDeleteTask = (id: string) => {
    localStore.deleteTask(id);
    onRefreshStates();
  };

  const handleDeleteGoal = (id: string) => {
    localStore.deleteGoal(id);
    onRefreshStates();
  };

  const handleAdjustGoalProgress = (goal: GoalRecord, delta: number) => {
    const val = Math.max(0, Math.min(goal.currentValue + delta, goal.targetValue));
    const updated: GoalRecord = {
      ...goal,
      currentValue: val,
    };
    localStore.saveGoal(updated);
    onRefreshStates();
  };

  // Rendering static mock monthly scheduler grids
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Segment Selector bar */}
      <div className="flex bg-white dark:bg-[#0f131a] p-1.5 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm w-max">
        <button
          id="segment_toggle_tasks"
          onClick={() => setActiveSegment("tasks")}
          className={`px-4.5 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
            activeSegment === "tasks" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-indigo-500"
          }`}
        >
          Checklists & Calendar
        </button>
        <button
          id="segment_toggle_goals"
          onClick={() => setActiveSegment("goals")}
          className={`px-4.5 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
            activeSegment === "goals" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-indigo-500"
          }`}
        >
          Aspiration Goals
        </button>
      </div>

      {activeSegment === "tasks" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar integration card */}
          <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
            <div>
              <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-5 h-5 text-indigo-500" /> Integrated Calendar
              </h3>
              <p className="text-xs text-gray-400">Click dates to filter task lists</p>
            </div>

            {/* Static Days Grids */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {daysInMonth.map((day) => {
                const hasTask = tasks.some((t) => t.dueDate && parseInt(t.dueDate.split("-")[2], 10) === day);
                const isSelected = selectedDay === day;

                return (
                  <button
                    id={`calendar_day_btn_${day}`}
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`h-9 rounded-xl flex flex-col items-center justify-center relative transition-all text-xs font-semibold select-none ${
                      isSelected
                        ? "bg-indigo-600 text-white font-extrabold shadow-sm"
                        : "bg-gray-50 dark:bg-[#141a24] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a212e]"
                    }`}
                  >
                    <span>{day}</span>
                    {hasTask && (
                      <span className={`w-1 h-1 rounded-full absolute bottom-1 ${isSelected ? "bg-white" : "bg-indigo-500"}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <button
                id="clear_cal_filter"
                onClick={() => setSelectedDay(null)}
                className="w-full py-1 bg-gray-50 dark:bg-[#111621] hover:bg-gray-100 dark:hover:bg-[#1c2331] text-[10px] uppercase font-extrabold text-gray-400 dark:text-gray-500 rounded-xl transition-all border border-transparent"
              >
                Clear Day Filter
              </button>
            )}
          </div>

          {/* Checklist list card */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-md font-bold text-gray-900 dark:text-white">Active Tasks</h4>
                <p className="text-xs text-gray-400">
                  {selectedDay ? `Tasks due on index day ${selectedDay}` : "Consolidated user checklists"}
                </p>
              </div>

              <button
                id="add_task_form_btn"
                onClick={() => setAddingTask(!addingTask)}
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> {addingTask ? "Close" : "Add Task"}
              </button>
            </div>

            {addingTask && (
              <form onSubmit={handleCreateTask} className="p-4 bg-gray-50 dark:bg-[#141a24] rounded-2xl border border-gray-100 dark:border-[#1d2432]/40 space-y-3">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Create new task card</span>
                <input
                  id="task_name"
                  type="text"
                  required
                  placeholder="Task title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#0f131a] text-gray-900 dark:text-white border border-transparent dark:border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold placeholder-gray-400 shadow-sm"
                />

                <input
                  id="task_desc"
                  type="text"
                  placeholder="Short description"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#0f131a] text-gray-900 dark:text-white border border-transparent dark:border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold placeholder-gray-400 shadow-sm"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Due Date</label>
                    <input
                      id="task_due"
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full text-xs p-2 bg-white dark:bg-[#0f131a] text-gray-900 dark:text-white rounded-xl focus:outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Link Goal</label>
                    <select
                      id="task_link_goal"
                      value={taskGoalId}
                      onChange={(e) => setTaskGoalId(e.target.value)}
                      className="w-full text-xs p-2 bg-white dark:bg-[#0f131a] text-gray-900 dark:text-white rounded-xl focus:outline-none font-bold"
                    >
                      <option value="">None</option>
                      {goals.map((g) => (
                        <option key={g.goalId} value={g.goalId}>{g.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="task_reminder"
                    type="checkbox"
                    checked={taskReminder}
                    onChange={(e) => setTaskReminder(e.target.checked)}
                    className="w-4 h-4 text-indigo-500 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-500 flex items-center gap-1.5 font-semibold">
                    <Bell className="w-3.5 h-3.5 text-indigo-500" /> Enable Dashboard Alert Reminder
                  </span>
                </div>

                <button
                  id="task_submit"
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl"
                >
                  Create Task
                </button>
              </form>
            )}

            <div className="space-y-2 pt-1">
              {filteredTasks.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">Checklist is clean.</p>
              ) : (
                filteredTasks.map((t) => (
                  <div
                    id={`task_card_block_${t.taskId}`}
                    key={t.taskId}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      t.status === "completed"
                        ? "bg-gray-50/40 dark:bg-[#111721] border-transparent text-gray-400 line-through"
                        : "bg-white dark:bg-[#141a24] border-gray-100 dark:border-transparent hover:border-indigo-100 dark:hover:border-indigo-950/40 text-gray-700 dark:text-gray-200 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3 pr-2 truncate">
                      <button
                        id={`chk_toggle_${t.taskId}`}
                        onClick={() => handleToggleTask(t)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          t.status === "completed"
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f131a]"
                        }`}
                      >
                        {t.status === "completed" && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{t.title}</p>
                        {t.description && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{t.description}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.reminderEnabled && (
                        <span className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" title="Alert enabled">
                          <Bell className="w-3.5 h-3.5 animate-bounce" />
                        </span>
                      )}

                      {t.dueDate && (
                        <span className="px-2 py-0.5 bg-gray-50 dark:bg-[#1f2838] text-[10px] rounded text-gray-400 whitespace-nowrap font-medium">
                          {t.dueDate}
                        </span>
                      )}

                      <button
                        id={`delete_task_${t.taskId}`}
                        onClick={() => handleDeleteTask(t.taskId)}
                        className="p-1 rounded text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Goals Aspirational list board */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* New Goal Creator slot */}
          <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Target className="w-5 h-5 text-indigo-500" /> Aspiration Goals Tracker
              </h3>
              <p className="text-xs text-gray-400">Establish metrics objectives and deadlines</p>
            </div>

            {!addingGoal ? (
              <button
                id="add_goal_form_btn"
                onClick={() => setAddingGoal(true)}
                className="w-full py-2.5 bg-gray-50 dark:bg-[#141a24] hover:bg-gray-100 dark:hover:bg-[#1e2735] text-gray-700 dark:text-gray-200 text-xs font-bold border border-dashed border-gray-200 dark:border-gray-800 rounded-xl transition-all"
              >
                + Define Metric Goal
              </button>
            ) : (
              <form onSubmit={handleCreateGoal} className="space-y-3">
                <input
                  id="goal_title"
                  type="text"
                  required
                  placeholder="Goal name"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-[#141a24] text-gray-900 dark:text-white border border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold placeholder-gray-400"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Target Value</label>
                    <input
                      id="goal_target"
                      type="number"
                      required
                      min={1}
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(Number(e.target.value))}
                      className="w-full text-xs p-2 bg-gray-50 dark:bg-[#141a24] text-gray-900 dark:text-white rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Unit</label>
                    <input
                      id="goal_unit"
                      type="text"
                      required
                      value={goalUnit}
                      onChange={(e) => setGoalUnit(e.target.value)}
                      className="w-full text-xs p-2 bg-gray-50 dark:bg-[#141a24] text-gray-900 dark:text-white rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Deadline Date</label>
                  <input
                    id="goal_due"
                    type="date"
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="w-full text-xs p-2 bg-gray-50 dark:bg-[#141a24] text-gray-900 dark:text-white rounded-xl focus:outline-none font-bold"
                  />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl">
                    Save Target
                  </button>
                  <button type="button" onClick={() => setAddingGoal(false)} className="px-3 py-1.5 bg-gray-100 dark:bg-[#202a3a] text-xs font-semibold rounded-xl text-gray-500">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Render goals list Cards */}
          {goals.map((g) => {
            const percent = Math.min(Math.round((g.currentValue / g.targetValue) * 100), 100);
            return (
              <div
                id={`goal_panel_card_${g.goalId}`}
                key={g.goalId}
                className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-snug line-clamp-1">{g.title}</h4>
                    {g.deadline && (
                      <span className="text-[9px] text-indigo-500 dark:text-indigo-400 font-extrabold block mt-0.5">
                        DEADLINE: {g.deadline}
                      </span>
                    )}
                  </div>

                  <button
                    id={`delete_goal_${g.goalId}`}
                    onClick={() => handleDeleteGoal(g.goalId)}
                    className="text-gray-400 hover:text-rose-500 p-0.5"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress bars meters and slider adjustments */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Progression</span>
                    <span className="text-gray-900 dark:text-white font-extrabold">
                      {g.currentValue} / {g.targetValue} {g.unit || "items"} ({percent}%)
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 dark:bg-[#161d27] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Slider button controls */}
                <div className="flex gap-2">
                  <button
                    id={`goal_dec_${g.goalId}`}
                    onClick={() => handleAdjustGoalProgress(g, -1)}
                    disabled={g.currentValue <= 0}
                    className="flex-1 py-1 bg-gray-50 dark:bg-[#151a24] hover:bg-gray-100 dark:hover:bg-[#1f2838] border border-gray-100 dark:border-transparent rounded-xl text-xs font-semibold text-gray-500 hover:text-indigo-500 disabled:opacity-40"
                  >
                    - Decrease
                  </button>
                  <button
                    id={`goal_inc_${g.goalId}`}
                    onClick={() => handleAdjustGoalProgress(g, 1)}
                    disabled={g.currentValue >= g.targetValue}
                    className="flex-1 py-1 bg-gray-50 dark:bg-[#151a24] hover:bg-gray-100 dark:hover:bg-[#1f2838] border border-gray-100 dark:border-transparent rounded-xl text-xs font-semibold text-gray-500 hover:text-indigo-500 disabled:opacity-40"
                  >
                    + Increase
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
