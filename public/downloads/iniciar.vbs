' ============================================================
' SEMAIN - Iniciador silencioso
' ============================================================
' Este script VBS arranca la app de Python en segundo plano
' SIN abrir ninguna ventana de consola.
' Veras un icono verde con "S" en la bandeja del sistema.
'
' Para cerrar: clic derecho en el icono verde -> Salir
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this VBS file is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
pyScript = scriptDir & "\semain_tray.py"

' CRITICAL: Change working directory to the script folder so all
' relative paths (logs, etc.) resolve correctly
WshShell.CurrentDirectory = scriptDir

' Check if semain_tray.py exists
If Not fso.FileExists(pyScript) Then
    MsgBox "No se encontro el archivo:" & vbCrLf & pyScript & vbCrLf & vbCrLf & "Asegurate de que semain_tray.py este en la misma carpeta que este archivo.", vbCritical, "SEMAIN - Error"
    WScript.Quit 1
End If

' Find pythonw.exe (runs Python without console window)
On Error Resume Next
pythonwPath = WshShell.RegRead("HKLM\SOFTWARE\Python\PythonCore\InstallPath\")
On Error GoTo 0

' Try common pythonw locations
Dim pythonw
pythonw = ""

' Try: pythonw in PATH
If pythonw = "" Then
    On Error Resume Next
    Set exec = WshShell.Exec("cmd /c where pythonw.exe")
    If Err.Number = 0 Then
        out = exec.StdOut.ReadAll()
        If Len(Trim(out)) > 0 Then
            pythonw = Trim(out)
            ' Take first line if multiple
            If InStr(pythonw, vbCrLf) > 0 Then
                pythonw = Left(pythonw, InStr(pythonw, vbCrLf) - 1)
            End If
        End If
    End If
    On Error GoTo 0
End If

' Try common install paths
If pythonw = "" Then
    candidates = Array( _
        "C:\Python311\pythonw.exe", _
        "C:\Python310\pythonw.exe", _
        "C:\Python312\pythonw.exe", _
        "C:\Python313\pythonw.exe", _
        "C:\Program Files\Python311\pythonw.exe", _
        "C:\Program Files\Python310\pythonw.exe", _
        "C:\Program Files\Python312\pythonw.exe", _
        "C:\Program Files\Python313\pythonw.exe", _
        "C:\Program Files (x86)\Python311\pythonw.exe", _
        "C:\Program Files (x86)\Python310\pythonw.exe", _
        "C:\Program Files (x86)\Python312\pythonw.exe", _
        "C:\Program Files (x86)\Python313\pythonw.exe", _
        "C:\Users\" & WshShell.ExpandEnvironmentStrings("%USERNAME%") & "\AppData\Local\Programs\Python\Python311\pythonw.exe", _
        "C:\Users\" & WshShell.ExpandEnvironmentStrings("%USERNAME%") & "\AppData\Local\Programs\Python\Python310\pythonw.exe", _
        "C:\Users\" & WshShell.ExpandEnvironmentStrings("%USERNAME%") & "\AppData\Local\Programs\Python\Python312\pythonw.exe", _
        "C:\Users\" & WshShell.ExpandEnvironmentStrings("%USERNAME%") & "\AppData\Local\Programs\Python\Python313\pythonw.exe" _
    )
    For Each candidate In candidates
        If fso.FileExists(candidate) Then
            pythonw = candidate
            Exit For
        End If
    Next
End If

If pythonw = "" Then
    MsgBox "No se encontro pythonw.exe." & vbCrLf & vbCrLf & _
           "Instala Python 3.10+ desde https://python.org" & vbCrLf & _
           "y marca 'Add Python to PATH' durante la instalacion." & vbCrLf & vbCrLf & _
           "Luego ejecuta instalar.bat de nuevo.", _
           vbCritical, "SEMAIN - Python no encontrado"
    WScript.Quit 1
End If

' Run pythonw.exe with semain_tray.py
' Window style 0 = hidden (no console window at all)
' WaitOnReturn False = don't wait (fire and forget)
WshShell.Run """" & pythonw & """ """ & pyScript & """", 0, False

' VBS script exits immediately, Python runs in background
