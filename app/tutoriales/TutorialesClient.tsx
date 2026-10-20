"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PlayCircle,
  Plus,
  Edit2,
  Trash2,
  Search,
  ExternalLink,
  Eye,
  EyeOff,
  Video,
  X,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  BookOpen,
  Tag,
  FolderPlus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export interface TutorialCategory {
  id: string;
  name: string;
  created_at?: string;
}

export interface TutorialItem {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  category: string;
  category_id?: string;
  tutorial_categories?: { id: string; name: string } | null;
  order_index: number;
  is_published: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Convierte enlaces estándar de YouTube o Vimeo a URL embebible
function getEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube match
  const ytMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  }

  // Vimeo match
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/);
  if (vimeoMatch && vimeoMatch[3]) {
    return `https://player.vimeo.com/video/${vimeoMatch[3]}`;
  }

  // Si ya es un embed directo
  if (trimmed.includes("embed") || trimmed.endsWith(".mp4")) {
    return trimmed;
  }

  return null;
}

const CATEGORY_PRESETS = [
  "General",
  "Plantillas PDF",
  "Excel y Destinatarios",
  "Configuración SMTP",
  "Auditoría y Reportes",
];

const DEFAULT_SEEDS = [
  {
    title: "1. Estructuración y Normalización del Archivo Excel (.xlsx)",
    description:
      "Aprende a preparar el archivo exportado de Google Forms o Excel con las columnas requeridas: Nombre Completo, Tipo de Documento, Número de Documento y Correo Electrónico.",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Excel y Destinatarios",
    order_index: 1,
    is_published: true,
  },
  {
    title: "2. Carga Dinámica de Plantilla PDF y Calibración Visual",
    description:
      "Paso a paso para cargar tu propio diseño de diploma, ajustar las fuentes personalizadas, elegir la paleta cromática en el panel de Configuraciones y realizar la previsualización en vivo.",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Plantillas PDF",
    order_index: 2,
    is_published: true,
  },
  {
    title: "3. Creación de Contraseña de Aplicación en Google para Envíos SMTP",
    description:
      "Guía para habilitar la verificación en dos pasos en tu cuenta de correo y generar la contraseña de aplicación de 16 caracteres para despacho seguro con cifrado TLS.",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Configuración SMTP",
    order_index: 3,
    is_published: true,
  },
];

export default function TutorialesClient() {
  const { user, role, session } = useAuth();
  const isSuperadmin = role === "superadmin";

  const [tutorials, setTutorials] = useState<TutorialItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado para el modal de lectura completa de la guía
  const [readingTutorial, setReadingTutorial] = useState<TutorialItem | null>(null);

  // Estados del Modal de Creación / Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TutorialItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formOrder, setFormOrder] = useState<number>(0);
  const [formIsPublished, setFormIsPublished] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Estados para Categorías Dinámicas
  const [categories, setCategories] = useState<TutorialCategory[]>([]);

  // Estados del Modal de Gestión de Categorías (CRUD)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TutorialCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Helper para armar cabeceras con el JWT de Supabase
  const getAuthHeaders = useCallback(
    async (includeContentType = false): Promise<Record<string, string>> => {
      const headers: Record<string, string> = {};
      if (includeContentType) {
        headers["Content-Type"] = "application/json";
      }

      let token = session?.access_token;
      if (!token) {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token;
      }

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      return headers;
    },
    [session]
  );

  // Cargar lista de tutoriales desde la API para refrescar
  const fetchTutorials = useCallback(async () => {
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (user?.id) params.append("userId", user.id);

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tutorials?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setTutorials(data.data || []);
      if (data.categories) {
        setCategories(data.categories || []);
      }
    } catch (err: unknown) {
      console.error("Error al cargar tutoriales:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los tutoriales.";
      setErrorMessage(msg);
      setTutorials([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, getAuthHeaders]);

  // Carga inicial en el montaje
  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        if (user?.id) params.append("userId", user.id);

        const headers = await getAuthHeaders();
        const res = await fetch(`/api/tutorials?${params.toString()}`, { headers });
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
          setTutorials(data.data || []);
          if (data.categories) {
            setCategories(data.categories || []);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg =
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los tutoriales.";
          setErrorMessage(msg);
          setTutorials([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      ignore = true;
    };
  }, [user, getAuthHeaders]);

  // Mensajes flotantes de feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Apertura del modal en modo Crear
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormDescription("");
    setFormVideoUrl("");
    const defaultCat = categories[0];
    setFormCategoryId(defaultCat?.id || "");
    setFormCategory(defaultCat?.name || "General");
    setFormOrder((tutorials.length + 1) * 1);
    setFormIsPublished(true);
    setIsModalOpen(true);
  };

  // Apertura del modal en modo Editar
  const handleOpenEditModal = (item: TutorialItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDescription(item.description || "");
    setFormVideoUrl(item.video_url || "");
    const matchingCat = categories.find(
      (c) => c.id === item.category_id || c.name === item.category
    );
    setFormCategoryId(matchingCat ? matchingCat.id : item.category_id || "");
    setFormCategory(
      matchingCat
        ? matchingCat.name
        : item.tutorial_categories?.name || item.category || "General"
    );
    setFormOrder(item.order_index ?? 0);
    setFormIsPublished(item.is_published);
    setIsModalOpen(true);
  };

  // Guardar (Crear o Actualizar Tutorial)
  const handleSaveTutorial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("El título del tutorial es obligatorio.");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = Boolean(editingItem);
      const url = "/api/tutorials";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        id: editingItem?.id,
        title: formTitle,
        description: formDescription,
        video_url: formVideoUrl,
        category_id: formCategoryId || undefined,
        category: formCategory,
        order_index: Number(formOrder) || 0,
        is_published: formIsPublished,
        userId: user?.id,
      };

      const headers = await getAuthHeaders(true);
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      showToast(
        isEditing
          ? "Tutorial actualizado exitosamente."
          : "Tutorial creado exitosamente."
      );
      setIsModalOpen(false);
      fetchTutorials();
    } catch (err: unknown) {
      console.error("Error al guardar tutorial:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar el tutorial."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Guardar Categoría (Crear o Actualizar)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryNameInput.trim()) {
      alert("El nombre de la categoría es obligatorio.");
      return;
    }

    setIsSavingCategory(true);
    try {
      const isEditing = Boolean(editingCategory);
      const url = "/api/tutorials/categories";
      const method = isEditing ? "PUT" : "POST";

      const headers = await getAuthHeaders(true);
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          id: editingCategory?.id,
          name: categoryNameInput.trim(),
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      showToast(
        isEditing
          ? "Categoría actualizada exitosamente."
          : "Categoría creada exitosamente."
      );
      setEditingCategory(null);
      setCategoryNameInput("");
      fetchTutorials();
    } catch (err: unknown) {
      console.error("Error al guardar categoría:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar la categoría."
      );
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Iniciar edición de categoría
  const handleStartEditCategory = (cat: TutorialCategory) => {
    setEditingCategory(cat);
    setCategoryNameInput(cat.name);
  };

  // Cancelar edición de categoría
  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setCategoryNameInput("");
  };

  // Eliminar Categoría
  const handleDeleteCategory = async (cat: TutorialCategory) => {
    if (
      !confirm(
        `¿Estás seguro de eliminar la categoría "${cat.name}"? Los manuales deben ser reasignados antes de eliminarla.`
      )
    ) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.append("id", cat.id);
      if (user?.id) params.append("userId", user.id);

      const res = await fetch(`/api/tutorials/categories?${params.toString()}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      showToast(`Categoría "${cat.name}" eliminada.`);
      if (editingCategory?.id === cat.id) {
        setEditingCategory(null);
        setCategoryNameInput("");
      }
      fetchTutorials();
    } catch (err: unknown) {
      console.error("Error al eliminar categoría:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Error al eliminar la categoría."
      );
    }
  };

  // Eliminar tutorial
  const handleDeleteTutorial = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de eliminar el tutorial "${title}"?`)) {
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append("id", id);
      if (user?.id) params.append("userId", user.id);

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tutorials?${params.toString()}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      showToast("Tutorial eliminado correctamente.");
      fetchTutorials();
    } catch (err: unknown) {
      console.error("Error al eliminar tutorial:", err);
      alert(
        err instanceof Error ? err.message : "Error al eliminar el tutorial."
      );
    }
  };

  // Cambiar visibilidad rápido (Publicar / Ocultar)
  const handleTogglePublished = async (item: TutorialItem) => {
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch("/api/tutorials", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          id: item.id,
          is_published: !item.is_published,
          userId: user?.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al cambiar estado");
      }

      showToast(
        !item.is_published
          ? "Tutorial publicado para la facultad."
          : "Tutorial ocultado de la vista docente."
      );
      fetchTutorials();
    } catch (err) {
      console.error("Error al alternar visibilidad:", err);
    }
  };

  // Sembrar tutoriales iniciales recomendados
  const handleSeedDefaults = async () => {
    if (
      !confirm(
        "¿Deseas precargar los 3 tutoriales iniciales recomendados para la facultad?"
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const headers = await getAuthHeaders(true);
      for (const seed of DEFAULT_SEEDS) {
        await fetch("/api/tutorials", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...seed, userId: user?.id }),
        });
      }
      showToast("Tutoriales iniciales precargados con éxito.");
      fetchTutorials();
    } catch (err) {
      console.error("Error al precargar tutoriales:", err);
      alert("No se pudieron cargar todos los tutoriales iniciales.");
      setIsLoading(false);
    }
  };

  // Categorías presentes en los tutoriales y catálogo dinámico
  const availableCategories = useMemo(() => {
    const set = new Set<string>(["Todos"]);
    // Agregar primero todas las categorías dinámicas configuradas
    categories.forEach((cat) => {
      if (cat.name) set.add(cat.name);
    });
    // Agregar cualquier categoría remanente de tutoriales
    tutorials.forEach((t) => {
      const name = t.tutorial_categories?.name || t.category;
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [categories, tutorials]);

  // Filtrado reactivo de tutoriales
  const filteredTutorials = useMemo(() => {
    return tutorials.filter((t) => {
      const itemCategory = t.tutorial_categories?.name || t.category;
      const matchesCategory =
        selectedCategory === "Todos" || itemCategory === selectedCategory;
      const cleanSearch = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !cleanSearch ||
        t.title.toLowerCase().includes(cleanSearch) ||
        (t.description && t.description.toLowerCase().includes(cleanSearch));
      return matchesCategory && matchesSearch;
    });
  }, [tutorials, selectedCategory, searchTerm]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Principal */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold mb-3">
            <PlayCircle className="h-3.5 w-3.5 text-indigo-600" />
            <span>Capacitación & Guías Paso a Paso</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Video className="h-7 w-7 text-indigo-600" />
            Módulo de Tutoriales
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Videotutoriales y guías interactivas orientadas a la preparación de
            planillas Excel, calibración de plantillas PDF y configuración del
            despacho SMTP institucional.
          </p>
        </div>

        {isSuperadmin && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setCategoryNameInput("");
                setIsCategoryModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Tag className="h-4 w-4 text-indigo-600" />
              <span>Gestionar Categorías</span>
            </button>

            {tutorials.length === 0 && (
              <button
                type="button"
                onClick={handleSeedDefaults}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span>Precargar Ejemplos</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Tutorial</span>
            </button>
          </div>
        )}
      </div>

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-xs shadow-2xs">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Barra de Filtros y Buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por título o contenido del tutorial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium shadow-2xs"
          />
        </div>

        {/* Contador */}
        <div className="text-xs text-slate-500 font-semibold flex items-center gap-2 self-end sm:self-auto">
          <span>{filteredTutorials.length} tutorial(es) disponible(s)</span>
        </div>
      </div>

      {/* Píldoras de Categorías */}
      <div className="flex flex-wrap items-center gap-2 pb-1 overflow-x-auto">
        {availableCategories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs font-bold"
                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid de Tutoriales */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-6 border border-slate-200 animate-pulse space-y-4"
            >
              <div className="h-44 bg-slate-100 rounded-2xl" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredTutorials.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-xs space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Video className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No se encontraron tutoriales
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm || selectedCategory !== "Todos"
              ? "Prueba cambiando el término de búsqueda o seleccionando otra categoría."
              : isSuperadmin
              ? "Aún no has creado ningún tutorial. Puedes hacer clic en 'Nuevo Tutorial' o 'Precargar Ejemplos' arriba."
              : "Actualmente no hay tutoriales publicados. Consulta más adelante."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {filteredTutorials.map((item) => {
            const hasVideo = Boolean(item.video_url && item.video_url.trim());
            const embedUrl = hasVideo ? getEmbedUrl(item.video_url) : null;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl overflow-hidden border transition-all duration-200 shadow-xs flex flex-col justify-between hover:shadow-md ${
                  !item.is_published
                    ? "border-amber-300/80 bg-amber-50/20"
                    : "border-slate-200/90 hover:border-indigo-200"
                }`}
              >
                {/* 1. Zona de Video (Renderizado Condicional: solo si tiene video_url válido) */}
                {hasVideo && (
                  <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title={item.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    ) : item.video_url ? (
                      <a
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 text-indigo-300 hover:text-white transition-colors p-4 text-center"
                      >
                        <PlayCircle className="h-12 w-12 text-indigo-400" />
                        <span className="text-xs font-semibold flex items-center gap-1">
                          Ver recurso externo <ExternalLink className="h-3 w-3" />
                        </span>
                      </a>
                    ) : null}

                    {/* Badges Flotantes sobre el Video */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/80 backdrop-blur-md text-white border border-white/10 shadow-xs">
                        {item.tutorial_categories?.name || item.category}
                      </span>
                      {isSuperadmin && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs ${
                            item.is_published
                              ? "bg-emerald-500 text-white"
                              : "bg-amber-500 text-white"
                          }`}
                        >
                          {item.is_published ? "Publicado" : "Oculto"}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3 z-10 pointer-events-none">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-900/80 backdrop-blur-md text-indigo-300 border border-white/10 shadow-xs">
                        #{item.order_index}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Contenido de la Tarjeta */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {/* Badges superiores limpios para manuales sin video */}
                    {!hasVideo && (
                      <div className="flex items-center justify-between gap-2 pb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
                            {item.tutorial_categories?.name || item.category}
                          </span>
                          {isSuperadmin && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-2xs ${
                                item.is_published
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {item.is_published ? "Publicado" : "Oculto"}
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200/60">
                          #{item.order_index}
                        </span>
                      </div>
                    )}

                    <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                      {item.title}
                    </h3>

                    {item.description && (
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Botón para Leer Guía Completa */}
                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setReadingTutorial(item)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/70 transition-all cursor-pointer hover:shadow-2xs active:scale-[0.99]"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Leer Guía Completa</span>
                    </button>

                    {/* Acciones de Superadmin */}
                    {isSuperadmin && (
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                            item.is_published
                              ? "text-slate-600 hover:bg-slate-100"
                              : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          }`}
                          title={
                            item.is_published
                              ? "Ocultar a docentes"
                              : "Publicar para docentes"
                          }
                        >
                          {item.is_published ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>Ocultar</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>Publicar</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Editar tutorial"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteTutorial(item.id, item.title)
                            }
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Eliminar tutorial"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CREACIÓN / EDICIÓN (SOLO SUPERADMIN) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Encabezado del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingItem ? "Editar Tutorial" : "Nuevo Tutorial"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Gestión directa de contenido educativo para la facultad
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveTutorial} className="p-6 space-y-4 overflow-y-auto">
              {/* Título */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Título del Tutorial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carga de Plantilla PDF y Ajuste de Tipografía"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                />
              </div>

              {/* Categoría y Orden */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Categoría *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryNameInput("");
                        setIsCategoryModalOpen(true);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      <span>Gestionar</span>
                    </button>
                  </div>
                  <select
                    value={formCategoryId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFormCategoryId(id);
                      const c = categories.find((cat) => cat.id === id);
                      if (c) setFormCategory(c.name);
                    }}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  >
                    {categories.length === 0 ? (
                      <option value="">Cargando categorías...</option>
                    ) : (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Orden de Visualización
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* URL del Video */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Enlace del Video (YouTube / Vimeo / MP4)
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formVideoUrl}
                  onChange={(e) => setFormVideoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                />
                <p className="text-[10px] text-slate-400">
                  Acepta enlaces estándar de YouTube, youtu.be, Vimeo o URLs directas de video.
                </p>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Descripción o Instrucciones
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe los pasos clave o el objetivo del tutorial..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium resize-none"
                />
              </div>

              {/* Checkbox Publicado */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  id="is_published"
                  type="checkbox"
                  checked={formIsPublished}
                  onChange={(e) => setFormIsPublished(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                />
                <label
                  htmlFor="is_published"
                  className="text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Publicar inmediatamente para todos los docentes de la facultad
                </label>
              </div>

              {/* Botones del Modal */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : "Guardar Tutorial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE GESTIÓN DE CATEGORÍAS (SUPERADMIN) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Encabezado */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Gestión de Categorías
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Crea y administra las categorías temáticas de tutoriales
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  handleCancelEditCategory();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario Crear / Editar */}
            <div className="p-6 border-b border-slate-100 bg-white">
              <form onSubmit={handleSaveCategory} className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {editingCategory ? "Editar Nombre de Categoría" : "Nueva Categoría"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carga de Planillas, Plantillas y Firmas..."
                    value={categoryNameInput}
                    onChange={(e) => setCategoryNameInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isSavingCategory}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {isSavingCategory ? (
                      "Guardando..."
                    ) : editingCategory ? (
                      "Actualizar"
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar</span>
                      </>
                    )}
                  </button>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={handleCancelEditCategory}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Listado de Categorías Existentes */}
            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Categorías Registradas ({categories.length})
              </div>

              {categories.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No hay categorías registradas en la base de datos.
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const isBeingEdited = editingCategory?.id === cat.id;
                    const tutorialsCount = tutorials.filter(
                      (t) => (t.category_id === cat.id) || (t.category === cat.name)
                    ).length;

                    return (
                      <div
                        key={cat.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                          isBeingEdited
                            ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/30"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Tag className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {cat.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                            {tutorialsCount} manual(es)
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditCategory(cat)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Editar nombre"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pie del modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  handleCancelEditCategory();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LECTURA DE GUÍA COMPLETA */}
      {readingTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Encabezado */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/80 gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200/80">
                    {readingTutorial.tutorial_categories?.name || readingTutorial.category}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Guía #{readingTutorial.order_index}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                  {readingTutorial.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setReadingTutorial(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenido formateado con whitespace-pre-wrap */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-5">
              {readingTutorial.video_url && getEmbedUrl(readingTutorial.video_url) && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                  <iframe
                    src={getEmbedUrl(readingTutorial.video_url)!}
                    title={readingTutorial.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              )}

              <div className="bg-slate-50/70 p-5 sm:p-6 rounded-2xl border border-slate-200/80">
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans break-words">
                  {readingTutorial.description || "Esta guía no cuenta con descripción detallada registrada."}
                </div>
              </div>
            </div>

            {/* Pie del modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                CertiSender • Capacitación y Documentación
              </span>
              <button
                type="button"
                onClick={() => setReadingTutorial(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
              >
                Cerrar Guía
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
