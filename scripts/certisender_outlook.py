"""
==============================================================================
CertiSender - Despachador Local Automatizado para Microsoft Outlook Desktop
==============================================================================
Requisitos:
  1. Sistema Operativo Windows
  2. Microsoft Outlook (clásico de escritorio) abierto con la cuenta remitente
  3. Python 3.8+ instalado
  4. Librería pywin32: pip install pywin32
==============================================================================
"""

import csv
import os
import sys
import time

try:
    import win32com.client as win32
except ImportError:
    print("\n[ERROR] El módulo 'pywin32' no se encuentra instalado.")
    print("Para solucionarlo, abre tu consola o terminal y ejecuta:")
    print("    pip install pywin32\n")
    input("Presiona ENTER para salir...")
    sys.exit(1)

def despachar():
    if getattr(sys, 'frozen', False):
        # Si se está ejecutando como un empaquetado de PyInstaller (--onefile)
        directorio_base = os.path.dirname(sys.executable)
    else:
        # Si se está ejecutando como un script normal de Python
        directorio_base = os.path.dirname(os.path.abspath(__file__))

    archivo_csv = os.path.join(directorio_base, "relacion.csv")

    print("\n" + "="*60)
    print("      CertiSender - Despachador de Diplomas vía Outlook     ")
    print("="*60)

    if not os.path.exists(archivo_csv):
        print(f"\n[ERROR] No se encontró el archivo de datos: {archivo_csv}")
        print("Asegúrate de descomprimir todo el contenido del archivo ZIP en una carpeta.")
        input("Presiona ENTER para salir...")
        return

    # Conectar con el proceso de Microsoft Outlook
    try:
        outlook = win32.Dispatch("Outlook.Application")
        # Forzar chequeo de la sesión
        _ = outlook.GetNamespace("MAPI")
    except Exception as e:
        print(f"\n[ERROR] No se pudo conectar con Microsoft Outlook: {e}")
        print("Por favor, asegúrate de que Microsoft Outlook esté instalado y en ejecución.")
        input("Presiona ENTER para salir...")
        return

    registros = []
    try:
        with open(archivo_csv, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            registros = list(reader)
    except Exception as e:
        print(f"\n[ERROR] Error al leer relacion.csv: {e}")
        input("Presiona ENTER para salir...")
        return

    total = len(registros)
    if total == 0:
        print("\n[AVISO] El archivo relacion.csv está vacío. No hay destinatarios.")
        input("Presiona ENTER para salir...")
        return

    print(f"\n[*] Se encontraron {total} certificado(s) listos para despacho.")
    confirm = input("¿Deseas iniciar el envío automático desde tu cuenta de Outlook? (s/n): ")
    if confirm.lower() != "s":
        print("[!] Envío cancelado por el usuario.")
        return

    print("\n--- INICIANDO DESPACHO EN SEGUNDO PLANO ---")
    enviados = 0
    fallidos = 0

    for idx, fila in enumerate(registros, start=1):
        correo = fila.get("correo_destino", "").strip()
        nombre = fila.get("nombre_completo", "").strip()
        asunto = fila.get("asunto", "Certificado Oficial").strip()
        cuerpo = fila.get("cuerpo_mensaje", "").strip()
        ruta_pdf_relativa = fila.get("archivo_pdf", "").strip()

        ruta_pdf_absoluta = os.path.normpath(os.path.join(directorio_base, ruta_pdf_relativa))

        if not correo or "@" not in correo:
            print(f"[{idx}/{total}] [SALTADO] Correo inválido: '{correo}' (Participante: {nombre})")
            fallidos += 1
            continue

        if not os.path.exists(ruta_pdf_absoluta):
            print(f"[{idx}/{total}] [ERROR] PDF no encontrado en ruta: {ruta_pdf_absoluta}")
            fallidos += 1
            continue

        try:
            # 0 = olMailItem
            mail = outlook.CreateItem(0)
            mail.To = correo
            mail.Subject = asunto

            # Formatear cuerpo con HTML seguro
            cuerpo_html = cuerpo.replace("\n", "<br>")
            mail.HTMLBody = f"<div style='font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;'>{cuerpo_html}</div>"

            # Adjuntar el archivo PDF
            mail.Attachments.Add(ruta_pdf_absoluta)

            # Despachar mensaje
            mail.Send()
            enviados += 1
            print(f"[{idx}/{total}] [ENVIADO OK] -> {nombre} <{correo}>")

            # Pausa de seguridad para no saturar el spooler de correo de Windows
            time.sleep(1)

        except Exception as ex:
            fallidos += 1
            print(f"[{idx}/{total}] [ERROR AL ENVIAR] -> {correo}: {ex}")

    print("\n" + "="*60)
    print(f" RESUMEN FINAL: {enviados} enviados con éxito | {fallidos} errores.")
    print("="*60)
    input("\nPresiona ENTER para cerrar...")

if __name__ == "__main__":
    despachar()
