# SEMAIN - Asistente de Outlook (Python Tray App)

Este programa corre en tu computadora (Windows) en segundo plano. Prepara los
correos de evaluación de proveedores automáticamente: descarga el PDF y la
gráfica, los guarda en la carpeta correcta, y abre Outlook con todo listo.

## Instalación (una sola vez)

1. Instala Python 3.10+ desde https://python.org
   - **IMPORTANTE**: Marca la casilla "Add Python to PATH" al instalar

2. Descarga estos 5 archivos y ponlos en una carpeta (por ejemplo `C:\SEMAIN\`):
   - `semain_tray.py`
   - `instalar.bat`
   - `iniciar.vbs` ← arranca silenciosamente (sin ventana)
   - `iniciar.bat` ← alternativa que llama al VBS
   - `LEEME.md` (este archivo)

3. Haz **doble clic en `instalar.bat`**
   - Instala las dependencias (pystray, Pillow, requests, pywin32)
   - Crea un acceso directo en el Escritorio

## Uso diario

1. **Inicia el programa**: Doble clic en el acceso directo "SEMAIN - Asistente"
   del Escritorio, o doble clic en `iniciar.vbs`
   - **NO abre ninguna ventana** — todo es en segundo plano
   - Aparece un icono verde con "S" en la bandeja del sistema
   - Aparece un icono verde con "S" en la bandeja del sistema (junto al reloj)

2. **Abre la página web**: https://my-project-mu-tan.vercel.app/

3. **Pulsa "Correo"** en cualquier proveedor → pestaña "Outlook (app local)"
   → botón "Preparar en Outlook"

4. El programa:
   - Descarga el PDF y la gráfica
   - Los guarda en `C:\Users\Equipo 39\Desktop\WALTER\ALMACEN\EVALUACION DE PROVEDORES\2026\Julio\`
   - Abre Outlook con el correo listo (destinatario, asunto, mensaje, adjuntos)
   - Solo presionas **Enviar** en Outlook

## ¿Dónde se guardan los archivos?

```
C:\Users\Equipo 39\Desktop\WALTER\ALMACEN\EVALUACION DE PROVEDORES\
├── 2026\
│   ├── Enero\
│   ├── Febrero\
│   ├── ...
│   └── Julio\
│       ├── Evaluacion-SERVIACERO.pdf
│       ├── Grafica-comparativa-SERVIACERO.png
│       ├── Evaluacion-HEMACHISA_HERRAMIENTAS.pdf
│       └── Grafica-comparativa-HEMACHISA_HERRAMIENTAS.png
├── 2027\
│   └── Enero\
│   └── ...
```

Las carpetas de año y mes se crean automáticamente si no existen.

## Cerrar el programa

Clic derecho en el icono verde con "S" en la bandeja del sistema → **Salir**

## Solución de problemas

**El botón "Preparar en Outlook" no aparece en la web**
- Verifica que el programa esté corriendo (icono verde en la bandeja)
- Cierra y vuelve a abrir el navegador
- Si usas un bloqueador de anuncios o antivirus, pueden bloquear las
  peticiones a localhost

**Outlook no se abre**
- Verifica que Microsoft Outlook esté instalado y configurado
- Abre Outlook manualmente una vez antes de usar el programa
- Ejecuta `instalar.bat` de nuevo para reinstalar pywin32

**Error de permisos al guardar archivos**
- Verifica que tienes permisos de escritura en el Escritorio
- Ejecuta `iniciar.bat` como administrador (clic derecho → Ejecutar como administrador)

**El icono no aparece en la bandeja**
- Windows puede ocultar iconos. Pulsa la flecha "^" junto al reloj para ver todos
- Arrastra el icono de SEMAIN a la zona visible de la bandeja

## Detalles técnicos

- El programa escucha en `http://127.0.0.1:8765`
- La página web (HTTPS) puede comunicarse con localhost (HTTP) porque los
  navegadores consideran localhost como un origen seguro
- No se envían datos fuera de tu computadora
- El correo NO se envía automáticamente — siempre se abre para que lo revises
