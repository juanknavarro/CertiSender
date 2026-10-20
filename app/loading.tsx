import React from "react";

export default function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[70vh] bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">
          Cargando CertiSender...
        </p>
      </div>
    </div>
  );
}
