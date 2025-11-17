import React, { useState, useMemo } from "react";
import type { Task, Transaction } from "../types";

// Utilitário: converte ISO (UTC) → YYYY-MM-DD local
function toLocalYMD(iso: string) {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// Separa horário apenas (HH:MM)
function extractLocalTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface DashboardProps {
  tasks: Task[];
  transactions: Transaction[];
  onOpenTaskModal: (date: string) => void;
}

export default function Dashboard({ tasks, transactions, onOpenTaskModal }: DashboardProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 🔥 AGRUPAMENTO 100% CORRIGIDO
  const groupedTasks = useMemo(() => {
    const map = new Map<
      string,
      { timed: Task[]; allday: Task[] }
    >();

    tasks.forEach((task) => {
      if (!task.due_at) {
        // Se não tem horário → "all-day"
        const key = "all-day";
        const entry = map.get(key) || { timed: [], allday: [] };
        entry.allday.push(task);
        map.set(key, entry);
        return;
      }

      const key = toLocalYMD(task.due_at);
      const entry = map.get(key) || { timed: [], allday: [] };
      entry.timed.push(task);
      map.set(key, entry);
    });

    return map;
  }, [tasks]);

  // DEBUG opcional
  console.log("GroupedTasks:", groupedTasks);

  return (
    <div className="w-full p-6">
      <h1 className="text-2xl font-bold text-white mb-4">
        Dashboard
      </h1>


      {/* Tarefas do dia atual */}
      <h2 className="text-xl text-white mb-2">Tarefas</h2>

      {Array.from(groupedTasks.entries()).map(([dateKey, group]) => (
        <div
          key={dateKey}
          className="bg-gray-800 p-4 rounded-lg mb-4 border border-gray-700"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold text-lg">
              {dateKey === "all-day"
                ? "Tarefas sem horário"
                : new Date(dateKey).toLocaleDateString("pt-BR")}
            </h3>

            {dateKey !== "all-day" && (
              <button
                onClick={() => onOpenTaskModal(dateKey)}
                className="text-sm bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 text-white"
              >
                Abrir dia
              </button>
            )}
          </div>

          {/* Tarefas com horário */}
          {group.timed.length > 0 && (
            <div>
              {group.timed
                .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
                .map((task) => (
                  <div
                    key={task.id}
                    className="bg-gray-700 p-3 rounded mb-2 text-white flex justify-between"
                  >
                    <span>{task.title}</span>
                    <span className="opacity-70">{extractLocalTime(task.due_at!)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Tarefas sem horário */}
          {group.allday.length > 0 && (
            <div className="mt-2">
              {group.allday.map((task) => (
                <div
                  key={task.id}
                  className="bg-gray-700 p-3 rounded mb-2 text-white"
                >
                  {task.title}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* FINANCEIRO */}
      <h2 className="text-xl text-white mt-8 mb-2">
        Movimentações financeiras
      </h2>

      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        {transactions.length === 0 ? (
          <p className="text-gray-400">Nenhuma movimentação.</p>
        ) : (
          transactions.map((t) => (
            <div
              key={t.id}
              className="flex justify-between bg-gray-700 p-3 rounded mb-2 text-white"
            >
              <span>{t.description}</span>
              <span
                className={
                  t.amount >= 0 ? "text-green-400" : "text-red-400"
                }
              >
                R$ {t.amount.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
