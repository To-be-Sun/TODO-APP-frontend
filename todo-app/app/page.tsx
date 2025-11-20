"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { apiService } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CalendarIcon } from "lucide-react";
import { authService } from "@/lib/auth";

// ========================
// 型定義
// ========================

type TaskStatus = "active" | "done";

type Category = {
  id: number;
  name: string;
  userId: number;
  createdAt: string;
};

type Task = {
  id: string;
  title: string;
  category?: string; // 後方互換性のため残す
  categoryId?: number; // Prisma用
  status: TaskStatus;
  createdAt: string; // ISO string
  estimatedHours?: number; // 予定工数（時間）
  actualHours?: number; // 実績工数（時間）
  isWorking?: boolean; // 作業中かどうか
  workStartTime?: string; // 作業開始時刻（ISO string）
  dueDate?: string; // 期日（ISO string）
};

type PrismaTask = {
  id: string;
  title: string;
  status: string;
  categoryId: number;
  userId: number;
  estimatedHours: number | null;
  actualHours: number | null;
  isWorking: boolean;
  workStartTime: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    name: string;
  };
};

// localStorage 用キーを生成する関数
const getStorageKey = (userId: number, key: string) => {
  return `portfolio-todo-${userId}-${key}`;
};

// 日付をローカルタイムゾーンでYYYY-MM-DD形式に変換
const formatDateToLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// YYYY-MM-DD形式の文字列をローカルタイムゾーンのDateオブジェクトに変換
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// ========================
// メインコンポーネント
// ==========================

export default function TodoPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [useDatabase, setUseDatabase] = useState(false); // DB使用フラグ
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [editingEstimatedHours, setEditingEstimatedHours] = useState<string>("");
  const [editingDueDate, setEditingDueDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("todo");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      const token = authService.getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      
      try {
        const userData = await authService.getMe(token);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        authService.removeToken();
        router.push("/login");
      }
    };
    
    checkAuth();
  }, [router]);

  const handleLogout = () => {
    authService.removeToken();
    router.push("/login");
  };

  // ------------------------
  // 初期ロード（Prisma API + localStorage）
  // ------------------------
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    
    const loadData = async () => {
      try {
        // データベースからカテゴリーとタスクを取得
        try {
          const [dbCats, dbTasks] = await Promise.all([
            apiService.getCategories(),
            apiService.getTasks()
          ]);
          
          setDbCategories(dbCats);
          setCategories(dbCats.map((c: Category) => c.name));
          
          // PrismaタスクをローカルTask型に変換
          const convertedTasks = dbTasks.map((t: PrismaTask) => ({
            id: t.id,
            title: t.title,
            category: t.category?.name || '',
            categoryId: t.categoryId,
            status: t.status as TaskStatus,
            createdAt: t.createdAt,
            estimatedHours: t.estimatedHours || undefined,
            actualHours: t.actualHours || undefined,
            isWorking: t.isWorking || false,
            workStartTime: t.workStartTime || undefined,
            dueDate: t.dueDate || undefined
          }));
          
          setTasks(convertedTasks);
          setUseDatabase(true);
          
          console.log('Loaded from database:', { categories: dbCats.length, tasks: dbTasks.length });
        } catch (dbError) {
          console.error("Failed to load from database, falling back to localStorage:", dbError);
          
          // データベース読み込み失敗時はlocalStorageから読み込み
          const STORAGE_KEY = getStorageKey(user.id, "tasks");
          const CATEGORIES_KEY = getStorageKey(user.id, "categories");
          
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as Task[];
              setTasks(parsed);
            } catch (e) {
              console.error("Failed to parse tasks from localStorage", e);
            }
          }
          const storedCategories = window.localStorage.getItem(CATEGORIES_KEY);
          if (storedCategories) {
            try {
              const parsed = JSON.parse(storedCategories) as string[];
              setCategories(parsed);
            } catch (e) {
              console.error("Failed to parse categories from localStorage", e);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };
    
    loadData();
  }, [user]);

  // ------------------------
  // 変更があるたびに保存（DBモードではスキップ）
  // ------------------------
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id || useDatabase) return;
    const STORAGE_KEY = getStorageKey(user.id, "tasks");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, user, useDatabase]);

  useEffect(() => {
    if (typeof window === "undefined" || !user?.id || useDatabase) return;
    const CATEGORIES_KEY = getStorageKey(user.id, "categories");
    window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories, user]);

  // ------------------------
  // タスク追加
  // ------------------------
  const handleAddTask = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      alert("タスク名を入力してください");
      return;
    }

    if (!estimatedHours || parseFloat(estimatedHours) <= 0) {
      alert("工数を入力してください");
      return;
    }

    if (!category) {
      alert("カテゴリを選択してください");
      return;
    }

    const hours = parseFloat(estimatedHours);

    if (useDatabase) {
      try {
        const catObj = dbCategories.find(c => c.name === category);
        if (!catObj) {
          alert("カテゴリが見つかりません");
          return;
        }
        
        const createdTask = await apiService.createTask({
          title: trimmed,
          categoryId: catObj.id,
          status: "active",
          estimatedHours: hours,
          ...(dueDate && { dueDate: new Date(dueDate).toISOString() })
        });
        
        const newTask: Task = {
          id: createdTask.id,
          title: createdTask.title,
          category: createdTask.category?.name || category,
          categoryId: createdTask.categoryId,
          status: createdTask.status as TaskStatus,
          createdAt: createdTask.createdAt,
          estimatedHours: createdTask.estimatedHours || undefined,
          dueDate: createdTask.dueDate || undefined
        };
        
        setTasks((prev) => [newTask, ...prev]);
        console.log('Task created in database:', createdTask);
      } catch (error: any) {
        console.error('Failed to create task:', error);
        alert(error.message || 'タスクの作成に失敗しました');
        return;
      }
    } else {
      const newTask: Task = {
        id: uuidv4(),
        title: trimmed,
        category,
        status: "active",
        createdAt: new Date().toISOString(),
        estimatedHours: hours,
        ...(dueDate && { dueDate: new Date(dueDate).toISOString() }),
      };

      setTasks((prev) => [newTask, ...prev]);
    }
    setTitle("");
    setEstimatedHours("");
    setDueDate("");
  };

  // Ctrl+Enterキーで追加
  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAddTask();
    }
  };

  // ------------------------
  // 完了トグル
  // ------------------------
  const toggleTaskStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              status: task.status === "active" ? "done" : "active",
            }
          : task
      )
    );
  };

  // ------------------------
  // delete
  // ------------------------
  const deleteTask = (id: string, taskTitle: string) => {
    if (window.confirm(`「${taskTitle}」を削除しますか？\nこの操作は取り消せません。`)) {
      setTasks((prev) => prev.filter((task) => task.id !== id));
    }
  };

  // ------------------------
  // カテゴリ変更
  // ------------------------
  const changeTaskCategory = (id: string, newCategory: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, category: newCategory } : task
      )
    );
  };

  // ------------------------
  // タスク名・予定工数・期日編集
  // ------------------------
  const startEditTask = (id: string, currentTitle: string, currentEstimatedHours?: number, currentDueDate?: string) => {
    setEditingTaskId(id);
    setEditingTitle(currentTitle);
    setEditingEstimatedHours(currentEstimatedHours ? currentEstimatedHours.toString() : "");
    setEditingDueDate(currentDueDate ? currentDueDate.split('T')[0] : "");
  };

  const saveEditTask = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      const estimatedHours = editingEstimatedHours ? parseFloat(editingEstimatedHours) : undefined;
      const dueDate = editingDueDate ? new Date(editingDueDate).toISOString() : undefined;
      
      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { 
            ...task, 
            title: trimmed,
            ...(estimatedHours && estimatedHours > 0 && { estimatedHours }),
            ...(dueDate ? { dueDate } : { dueDate: undefined })
          } : task
        )
      );
    }
    setEditingTaskId(null);
    setEditingTitle("");
    setEditingEstimatedHours("");
    setEditingDueDate("");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTitle("");
    setEditingEstimatedHours("");
    setEditingDueDate("");
  };

  // タスク更新（カレンダーでのドラッグ&ドロップ用）
  const handleUpdateTask = async (id: string, updates: { dueDate?: string }) => {
    if (useDatabase) {
      try {
        const dueDate = updates.dueDate ? new Date(updates.dueDate).toISOString() : undefined;
        await apiService.updateTask(id, { dueDate });
        
        setTasks((prev) =>
          prev.map((task) =>
            task.id === id ? { ...task, dueDate } : task
          )
        );
        console.log('Task updated in database');
      } catch (error: any) {
        console.error('Failed to update task:', error);
        alert(error.message || 'タスクの更新に失敗しました');
      }
    } else {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { 
            ...task, 
            dueDate: updates.dueDate ? new Date(updates.dueDate).toISOString() : undefined 
          } : task
        )
      );
    }
  };

  // ------------------------
  // タスク作業時間管理
  // ------------------------
  const [activeTaskIds, setActiveTaskIds] = useState<string[]>([]);

  const startWork = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              isWorking: true,
              workStartTime: new Date().toISOString(),
            }
          : task
      )
    );
    setActiveTaskIds((prev) => [...new Set([...prev, id])]);
  };

  const stopWork = (id: string, removeFromActive: boolean = false) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === id && task.isWorking && task.workStartTime) {
          const startTime = new Date(task.workStartTime).getTime();
          const endTime = new Date().getTime();
          const workedHours = (endTime - startTime) / (1000 * 60 * 60); // ミリ秒を時間に変換
          return {
            ...task,
            isWorking: false,
            workStartTime: undefined,
            actualHours: (task.actualHours || 0) + workedHours,
          };
        }
        return task;
      })
    );
    if (removeFromActive) {
      setActiveTaskIds((prev) => prev.filter((taskId) => taskId !== id));
    }
  };

  // 期日の色分けを取得
  const getDueDateColor = (dueDate: string, status: TaskStatus) => {
    if (status === "done") return "";
    
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      // 過ぎた - 赤
      return "border-red-500 text-red-500 bg-red-50 dark:bg-red-950";
    } else if (diffDays <= 3) {
      // 3日以内 - オレンジ
      return "border-orange-500 text-orange-500 bg-orange-50 dark:bg-orange-950";
    } else if (diffDays <= 7) {
      // 7日以内 - 黄色
      return "border-yellow-500 text-yellow-500 bg-yellow-50 dark:bg-yellow-950";
    } else {
      // 7日以上 - 緑
      return "border-green-500 text-green-500 bg-green-50 dark:bg-green-950";
    }
  };

  // 作業中のタスクの経過時間を計算
  const getElapsedTime = (task: Task) => {
    if (!task.isWorking || !task.workStartTime) return 0;
    const startTime = new Date(task.workStartTime).getTime();
    const now = new Date().getTime();
    return (now - startTime) / 1000; // 秒単位
  };

  // 秒を時:分:秒形式にフォーマット
  const formatSecondsToTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 秒を分に変換
  const secondsToMinutes = (seconds: number) => seconds / 60;

  // 作業中のタスクの表示を更新するための状態
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      if (tasks.some((t) => t.isWorking)) {
        setTick((prev) => prev + 1);
      }
    }, 1000); // 1秒ごとに更新
    return () => clearInterval(interval);
  }, [tasks]);

  // ------------------------
  // カテゴリ追加
  // ------------------------
  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    
    if (useDatabase) {
      try {
        const newCat = await apiService.createCategory(trimmed);
        setDbCategories((prev) => [...prev, newCat]);
        setCategories((prev) => [...prev, newCat.name]);
        setCategory(newCat.name);
        console.log('Category created in database:', newCat);
      } catch (error: any) {
        console.error('Failed to create category:', error);
        alert(error.message || 'カテゴリーの作成に失敗しました');
        return;
      }
    } else {
      setCategories((prev) => [...prev, trimmed]);
      setCategory(trimmed);
    }
    
    setNewCategory("");
    setShowCategoryInput(false);
  };

  // ------------------------
  // カテゴリdelete
  // ------------------------
  const handleDeleteCategory = async (categoryToDelete: string) => {
    // そのカテゴリのタスクが存在する場合は警告
    const tasksInCategory = tasks.filter((task) => task.category === categoryToDelete);
    if (tasksInCategory.length > 0) {
      if (!window.confirm(`「${categoryToDelete}」には${tasksInCategory.length}件のタスクがあります。カテゴリとすべてのタスクをdeleteしてもよろしいですか？`)) {
        return;
      }
    }
    
    if (useDatabase) {
      try {
        const catToDelete = dbCategories.find(c => c.name === categoryToDelete);
        if (catToDelete) {
          await apiService.deleteCategory(catToDelete.id);
          setDbCategories((prev) => prev.filter((cat) => cat.id !== catToDelete.id));
          console.log('Category deleted from database:', catToDelete);
        }
      } catch (error: any) {
        console.error('Failed to delete category:', error);
        alert(error.message || 'カテゴリーの削除に失敗しました');
        return;
      }
    }
    
    // カテゴリをdelete
    setCategories((prev) => prev.filter((cat) => cat !== categoryToDelete));
    
    // そのカテゴリのタスクをすべてdelete
    setTasks((prev) => prev.filter((task) => task.category !== categoryToDelete));
    
    // deleteされたカテゴリが現在選択されている場合、最初のカテゴリに変更
    if (category === categoryToDelete) {
      const remaining = categories.filter((cat) => cat !== categoryToDelete);
      if (remaining.length > 0) {
        setCategory(remaining[0]);
      }
    }
    
    // フィルタで選択されている場合は"all"に変更
    if (categoryFilter === categoryToDelete) {
      setCategoryFilter("all");
    }
  };

  // ------------------------
  // カテゴリ名変更
  // ------------------------
  const handleRenameCategory = (oldName: string) => {
    const newName = window.prompt(`「${oldName}」の新しい名前を入力してください:`, "");
    if (!newName || newName.trim() === "") return;
    
    const trimmedNewName = newName.trim();
    
    // 既存のカテゴリ名と重複チェック
    if (categories.includes(trimmedNewName)) {
      window.alert(`「${trimmedNewName}」は既に存在します。`);
      return;
    }
    
    // カテゴリ名を更新
    setCategories((prev) => prev.map((cat) => cat === oldName ? trimmedNewName : cat));
    
    // タスクのカテゴリも更新
    setTasks((prev) => 
      prev.map((task) => 
        task.category === oldName ? { ...task, category: trimmedNewName } : task
      )
    );
    
    // 現在選択中のカテゴリを更新
    if (category === oldName) {
      setCategory(trimmedNewName);
    }
    
    // フィルタで選択されている場合も更新
    if (categoryFilter === oldName) {
      setCategoryFilter(trimmedNewName);
    }
  };

  // ------------------------
  // コンテキストメニューの状態管理
  // ------------------------
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    category: string;
    sourceSelect: 'add' | 'filter' | null;
  } | null>(null);

  // コンテキストメニューを閉じる
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // ------------------------
  // フィルタ適用
  // ------------------------
  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const statusOk = statusFilter === "all" ? true : task.status === statusFilter;
      const categoryOk = categoryFilter === "all" ? true : task.category === categoryFilter;
      const selectedOk = selectedCategory === "all" ? true : task.category === selectedCategory;
      return statusOk && categoryOk && selectedOk;
    });
    
    // ソート: 完了タスクを下に、activeタスクは期限が近い順
    return filtered.sort((a, b) => {
      // まずステータスで分ける（active -> done）
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      
      // 同じステータス内で期限順にソート
      if (a.status === "active") {
        // 期限がない場合は最後に
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        
        // 期限が近い順（昇順）
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      
      return 0;
    });
  }, [tasks, statusFilter, categoryFilter, selectedCategory]);

  // ------------------------
  // 統計情報
  // ------------------------
  const totalCount = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  // カテゴリごとの統計
  const categoryStats = useMemo(() => {
    return categories.map((cat) => {
      const categoryTasks = tasks.filter((t) => t.category === cat);
      const total = categoryTasks.length;
      const done = categoryTasks.filter((t) => t.status === "done").length;
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);
      return { category: cat, total, done, percent };
    }).filter((stat) => stat.total > 0);
  }, [tasks, categories]);

  // 選択されたカテゴリの統計
  const selectedStats = useMemo(() => {
    const targetTasks = selectedCategory === "all" 
      ? tasks 
      : tasks.filter((t) => t.category === selectedCategory);
    
    const incompleteTasks = targetTasks.filter((t) => t.status !== "done");
    const totalEstimatedHours = incompleteTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActualSeconds = incompleteTasks.reduce((sum, t) => {
      const actualSeconds = (t.actualHours || 0) * 3600;
      const elapsedSeconds = t.isWorking ? getElapsedTime(t) : 0;
      return sum + actualSeconds + elapsedSeconds;
    }, 0);
    const totalActualHours = totalActualSeconds / 3600;
    const percent = totalEstimatedHours === 0 ? 0 : Math.min(Math.round((totalActualHours / totalEstimatedHours) * 100), 100);
    
    return {
      total: targetTasks.length,
      done: targetTasks.filter((t) => t.status === "done").length,
      totalEstimatedHours,
      totalActualHours,
      totalActualSeconds,
      percent
    };
  }, [tasks, selectedCategory]);

  // 日別作業時間データの集計
  const dailyData = useMemo(() => {
    const dataMap = new Map<string, { [category: string]: number }>();
    
    tasks.forEach(task => {
      if (task.actualHours && task.actualHours > 0) {
        const date = formatDateToLocal(new Date(task.createdAt));
        if (!dataMap.has(date)) {
          dataMap.set(date, {});
        }
        const dayData = dataMap.get(date)!;
        const categoryName = task.category || 'Unknown';
        dayData[categoryName] = (dayData[categoryName] || 0) + task.actualHours;
      }
    });
    
    // 過去30日分のデータを生成
    const result = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDateToLocal(date);
      const dayData = dataMap.get(dateStr) || {};
      
      result.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        ...dayData,
      });
    }
    
    return result;
  }, [tasks]);

  // 認証チェック中のローディング表示
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">読み込み中...</h2>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* Sidebar */}
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>カテゴリ</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCategoryInput(!showCategoryInput)}
                  className="w-full h-8 text-sm"
                >
                  + ADD
                </Button>
              </div>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      setSelectedCategory("all");
                      if (categories.length > 0) {
                        setCategory(categories[0]);
                      }
                      setActiveTab("todo");
                    }}
                    isActive={selectedCategory === "all"}
                  >
                    <span>ALL</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {tasks.filter((t) => t.status !== "done").length}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {categories.map((cat) => {
                  const catTasks = tasks.filter((t) => t.category === cat && t.status !== "done");
                  return (
                    <SidebarMenuItem key={cat}>
                      <SidebarMenuButton
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCategory(cat);
                          setActiveTab("todo");
                        }}
                        isActive={selectedCategory === cat}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            show: true,
                            x: e.clientX,
                            y: e.clientY,
                            category: cat,
                            sourceSelect: null
                          });
                        }}
                      >
                        <span>{cat}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {catTasks.length}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
              {showCategoryInput && (
                <div className="px-2 py-2 border-t">
                  <Input
                    key={`sidebar-category-input-${categories.length}`}
                    placeholder="カテゴリ名を入力"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddCategory();
                      } else if (e.key === "Escape") {
                        setShowCategoryInput(false);
                        setNewCategory("");
                      }
                    }}
                    onBlur={() => {
                      if (!newCategory.trim()) {
                        setShowCategoryInput(false);
                      }
                    }}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <main className="flex-1 overflow-auto" onClick={() => setContextMenu(null)}>
        <div className="min-h-screen bg-background px-4 py-8 md:px-8">
          <div className="mx-auto space-y-8 lg:max-w-none">
            {/* Sidebar Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <h1 className="text-3xl font-bold tracking-tight">TODO</h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {user?.email}
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  ログアウト
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="todo">Todo</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="record">Record</TabsTrigger>
              </TabsList>

              <TabsContent value="todo" className="space-y-8 mt-6">
            {/* カテゴリコンテキストメニュー */}
        {contextMenu && (
          <div
            className="fixed z-[9999] w-48 rounded-md border bg-popover/95 backdrop-blur-sm p-1 text-popover-foreground shadow-lg pointer-events-auto"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent pointer-events-auto"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const cat = contextMenu.category;
                setContextMenu(null);
                setTimeout(() => handleRenameCategory(cat), 50);
              }}
            >
              edit
            </button>
            <button
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent pointer-events-auto"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const cat = contextMenu.category;
                setContextMenu(null);
                setTimeout(() => handleDeleteCategory(cat), 50);
              }}
            >
              delete
            </button>
          </div>
        )}

            {/* 進捗カードと追加フォームを横並びに */}
            <section className="flex flex-col gap-4 lg:flex-row">
              {/* 左側: 進捗カード */}
              <div className="space-y-4 lg:flex-1">
                {/* 作業中のタスクの工数管理 */}
                {(() => {
                  const activeTasks = filteredTasks.filter((t) => activeTaskIds.includes(t.id));
                  if (activeTasks.length > 0) {
                    const totalEstimated = activeTasks.reduce(
                      (sum, t) => sum + (t.estimatedHours || 0),
                      0
                    );
                    const totalActual = activeTasks.reduce(
                      (sum, t) => sum + ((t.actualHours || 0) * 3600 + getElapsedTime(t)),
                      0
                    );
                    const totalEstimatedSeconds = totalEstimated * 3600;
                    const isOverBudget = totalActual > totalEstimatedSeconds;
                    const percentage = totalEstimatedSeconds > 0 ? Math.min((totalActual / totalEstimatedSeconds) * 100, 100) : 0;
                    const overPercentage = totalEstimatedSeconds > 0 && totalActual > totalEstimatedSeconds 
                      ? ((totalActual - totalEstimatedSeconds) / totalEstimatedSeconds) * 100 
                      : 0;
                    const workingCount = activeTasks.filter(t => t.isWorking).length;

                    return (
                      <Card className={isOverBudget ? "border-destructive" : ""}>
                        <CardHeader>
                          <CardTitle className="text-base font-medium">
                            作業中タスクの工数
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-col items-center justify-center gap-4">
                            <div className="relative w-[200px] h-[200px]">
                              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                                {/* 背景の円 */}
                                <circle
                                  cx="100"
                                  cy="100"
                                  r="80"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="20"
                                  className="text-muted opacity-30"
                                />
                                {/* 進捗の円 */}
                                <circle
                                  cx="100"
                                  cy="100"
                                  r="80"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="20"
                                  strokeDasharray={`${(percentage * 502.65) / 100} 502.65`}
                                  strokeLinecap="round"
                                  className={isOverBudget ? "text-destructive" : "text-primary"}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="text-2xl font-bold">
                                  {formatSecondsToTime(totalActual)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  / {totalEstimated.toFixed(1)}h
                                </div>
                              </div>
                            </div>
                          </div>
                          {isOverBudget && (
                            <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
                              ⚠️ 予定工数を超過しています！
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="text-center text-sm text-muted-foreground">
                              {activeTasks.length}個のタスク（{workingCount}個が作業中）
                            </div>
                            <div className="space-y-1">
                              {activeTasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between text-xs border-t pt-2">
                                  <div className="flex-1">
                                    <div className={task.isWorking ? "font-medium" : "text-muted-foreground"}>
                                      {task.isWorking && "▶ "}{task.title}
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    {task.isWorking ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-xs px-2"
                                          onClick={() => stopWork(task.id, false)}
                                        >
                                          Break
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="h-6 text-xs px-2"
                                          onClick={() => stopWork(task.id, true)}
                                        >
                                          Finish
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-xs px-2"
                                        onClick={() => startWork(task.id)}
                                      >
                                        restart
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                })()}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-medium">
                      {selectedCategory === "all" ? "全体の進捗" : `${selectedCategory}の進捗`}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {selectedStats.done}/{selectedStats.total} tasks done
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Progress value={selectedStats.percent} />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>作業工数: {formatSecondsToTime(selectedStats.totalActualSeconds)}</span>
                      <span>予定工数: {selectedStats.totalEstimatedHours.toFixed(1)}h</span>
                    </div>
                  </CardContent>
                </Card>

                {/* カテゴリごとの進捗（ALLの場合のみ表示） */}
                {selectedCategory === "all" && categoryStats.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">カテゴリ別進捗</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {categoryStats.map((stat) => (
                        <div key={stat.category} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{stat.category}</span>
                            <span className="text-muted-foreground">
                              {stat.done}/{stat.total} ({stat.percent}%)
                            </span>
                          </div>
                          <Progress value={stat.percent} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>          {/* 右側: 追加フォーム */}
          <div className="lg:w-[400px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">タスクを追加</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    key={`task-input-${tasks.length}`}
                    placeholder="タスク名 *"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                    required
                  />
                  <Input
                    type="number"
                    placeholder="工数(h) *"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-[100px]"
                    min="0"
                    step="0.5"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[140px] justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? new Date(dueDate).toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                        }) : "期日"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate ? parseLocalDate(dueDate) : undefined}
                        onSelect={(date) => setDueDate(date ? formatDateToLocal(date) : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v)}
                    open={contextMenu?.sourceSelect === 'add' ? true : undefined}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="カテゴリ" />
                    </SelectTrigger>
                    <SelectContent onContextMenu={(e) => e.preventDefault()}>
                      {categories.map((cat) => (
                        <SelectItem 
                          key={cat} 
                          value={cat}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({
                              show: true,
                              x: e.clientX,
                              y: e.clientY,
                              category: cat,
                              sourceSelect: 'add'
                            });
                          }}
                          className="cursor-context-menu"
                        >
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddTask} className="w-full">追加</Button>
              </div>
              <div className="flex gap-2">
                <Input
                  key={`category-input-${categories.length}`}
                  placeholder="新しいカテゴリを追加"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  className="flex-1"
                />
                <Button onClick={handleAddCategory} variant="outline">
                  カテゴリ追加
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </section>

        {/* フィルタ */}
        <section className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">ステータス:</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | TaskStatus)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">カテゴリ:</span>
            <Select
              value={selectedCategory === "all" ? categoryFilter : selectedCategory}
              onValueChange={(v) => setCategoryFilter(v)}
              open={contextMenu?.sourceSelect === 'filter' ? true : undefined}
              disabled={selectedCategory !== "all"}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent onContextMenu={(e) => e.preventDefault()}>
                <SelectItem value="all">All</SelectItem>
                {categories.map((cat) => (
                  <SelectItem 
                    key={cat} 
                    value={cat}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({
                        show: true,
                        x: e.clientX,
                        y: e.clientY,
                        category: cat,
                        sourceSelect: 'filter'
                      });
                    }}
                    className="cursor-context-menu"
                  >
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* タスク一覧 */}
        <section className="space-y-2">
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              条件に一致するタスクがありません。新しいタスクを追加してみてください。
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredTasks.map((task) => (
                <li
                  key={task.id}
                  id={`task-${task.id}`}
                  className="flex items-start justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex flex-1 items-start gap-2">
                    <button
                      onClick={() => toggleTaskStatus(task.id)}
                      className="mt-1 h-4 w-4 rounded border text-sm"
                      aria-label="toggle status"
                    >
                      {task.status === "done" ? "✓" : ""}
                    </button>
                    <div className="flex-1 space-y-1">
                      {editingTaskId === task.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveEditTask(task.id);
                              } else if (e.key === "Escape") {
                                cancelEditTask();
                              }
                            }}
                            autoFocus
                            className="h-7 text-sm"
                            placeholder="タスク名"
                          />
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={editingEstimatedHours}
                              onChange={(e) => setEditingEstimatedHours(e.target.value)}
                              className="h-7 text-sm w-[100px]"
                              placeholder="工数(h)"
                              min="0"
                              step="0.5"
                            />
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="h-7 w-[140px] justify-start text-left font-normal text-sm"
                                >
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {editingDueDate ? new Date(editingDueDate).toLocaleDateString("ja-JP", {
                                    month: "short",
                                    day: "numeric",
                                  }) : "期日"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={editingDueDate ? parseLocalDate(editingDueDate) : undefined}
                                  onSelect={(date) => setEditingDueDate(date ? formatDateToLocal(date) : "")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => saveEditTask(task.id)}
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={cancelEditTask}
                            >
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 ${
                            task.status === "done"
                              ? "text-muted-foreground line-through"
                              : ""
                          }`}
                          onClick={() => startEditTask(task.id, task.title, task.estimatedHours, task.dueDate)}
                        >
                          {task.title}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Select
                          value={task.category}
                          onValueChange={(v) => changeTaskCategory(task.id, v)}
                        >
                          <SelectTrigger className="h-5 w-auto border-0 px-1 py-0 text-[10px] hover:bg-accent">
                            <Badge variant="outline" className="px-1 py-0 text-[10px]">
                              {task.category}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {task.estimatedHours && (
                          <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                            予定: {task.estimatedHours}h
                          </Badge>
                        )}
                        {(task.actualHours || task.isWorking) && (
                          <Badge 
                            variant={task.isWorking ? "default" : "secondary"} 
                            className="px-1 py-0 text-[10px]"
                          >
                            実績: {task.isWorking ? formatSecondsToTime((task.actualHours || 0) * 3600 + getElapsedTime(task)) : `${(task.actualHours || 0).toFixed(2)}h`}
                          </Badge>
                        )}
                        {task.dueDate && (
                          <Badge 
                            variant="outline" 
                            className={`px-1 py-0 text-[10px] ${getDueDateColor(task.dueDate, task.status)}`}
                          >
                            期日: {new Date(task.dueDate).toLocaleDateString("ja-JP", {
                              month: "short",
                              day: "numeric",
                            })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!activeTaskIds.includes(task.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => startWork(task.id)}
                      >
                        start
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-sm text-destructive"
                      onClick={() => deleteTask(task.id, task.title)}
                    >
                      delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
              </TabsContent>

              <TabsContent value="calendar" className="space-y-8 mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                    >
                      ←
                    </Button>
                    <CardTitle>
                      {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    >
                      →
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                      {/* 曜日ヘッダー */}
                      {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                        <div key={day} className="text-center font-semibold text-sm py-2">
                          {day}
                        </div>
                      ))}
                      
                      {/* カレンダーのセル */}
                      {(() => {
                        const today = new Date();
                        const year = currentMonth.getFullYear();
                        const month = currentMonth.getMonth();
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        const startDayOfWeek = firstDay.getDay();
                        const daysInMonth = lastDay.getDate();
                        
                        const cells = [];
                        
                        // 前月の空白セル
                        for (let i = 0; i < startDayOfWeek; i++) {
                          cells.push(
                            <div key={`empty-${i}`} className="min-h-[120px] border rounded-md bg-muted/30" />
                          );
                        }
                        
                        // 当月の日付セル
                        for (let day = 1; day <= daysInMonth; day++) {
                          const currentDate = new Date(year, month, day);
                          const dateStr = formatDateToLocal(currentDate);
                          const tasksOnThisDay = tasks.filter(t => 
                            t.dueDate && t.dueDate.startsWith(dateStr)
                          );
                          const isToday = dateStr === formatDateToLocal(today);
                          
                          cells.push(
                            <div
                              key={day}
                              className={`min-h-[120px] border rounded-md p-2 ${
                                isToday ? 'bg-primary/10 border-primary' : 'bg-background'
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.add('bg-primary/20');
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.classList.remove('bg-primary/20');
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('bg-primary/20');
                                const taskId = e.dataTransfer.getData('taskId');
                                if (taskId) {
                                  handleUpdateTask(taskId, { dueDate: dateStr });
                                }
                              }}
                            >
                              <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-primary' : ''}`}>
                                {day}
                              </div>
                              <div className="space-y-1">
                                {tasksOnThisDay.map(task => {
                                  const colorClass = getDueDateColor(task.dueDate!, task.status);
                                  return (
                                    <div
                                      key={task.id}
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData('taskId', task.id);
                                        e.currentTarget.classList.add('opacity-50');
                                      }}
                                      onDragEnd={(e) => {
                                        e.currentTarget.classList.remove('opacity-50');
                                      }}
                                      className={`text-xs px-2 py-1 rounded truncate cursor-move hover:opacity-80 transition-opacity ${colorClass}`}
                                      title={task.title}
                                      onClick={() => {
                                        setActiveTab("todo");
                                        setTimeout(() => {
                                          const element = document.getElementById(`task-${task.id}`);
                                          if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          }
                                        }, 100);
                                      }}
                                    >
                                      {task.title}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        
                        return cells;
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="record" className="space-y-8 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>作業記録（過去30日）</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={dailyData} barCategoryGap="10%">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          interval="preserveStartEnd"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis label={{ value: '時間 (h)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        {categories.map((cat, index) => {
                          const colors = [
                            '#8884d8', '#82ca9d', '#ffc658', '#ff8042', 
                            '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1'
                          ];
                          return (
                            <Bar 
                              key={cat} 
                              dataKey={cat} 
                              stackId="a" 
                              fill={colors[index % colors.length]}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}