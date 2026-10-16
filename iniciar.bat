@echo off
chcp 65001 >nul
title FinanzasApp
set "RAIZ=%~dp0"
set "BACKEND=%RAIZ%Parte_3_Backend_Servidor\usuario\Nuevo Archivo WinRAR ZIP"
set "FRONTEND=%RAIZ%Parte_4_Frontend_Vue\usuario\Nuevo Archivo WinRAR ZIP\frontend"

where node >nul 2>nul
if errorlevel 1 (
    echo No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a intentarlo.
    pause
    exit /b 1
)

if not exist "%BACKEND%\node_modules" (
    echo Instalando dependencias del backend...
    pushd "%BACKEND%"
    call npm install
    popd
)

if not exist "%FRONTEND%\node_modules" (
    echo Instalando dependencias del frontend...
    pushd "%FRONTEND%"
    call npm install
    popd
)

echo Iniciando backend en http://localhost:3000 ...
start "FinanzasApp - Backend" /D "%BACKEND%" cmd /k npm start

echo Iniciando frontend en http://localhost:5180 ...
start "FinanzasApp - Frontend" /D "%FRONTEND%" cmd /k npm run dev -- --port 5180 --strictPort

echo Esperando a que arranque...
timeout /t 8 /nobreak >nul
start "" http://localhost:5180

echo.
echo Listo. Se abrieron dos ventanas (backend y frontend).
echo Para detener la aplicacion, cierra esas dos ventanas.
echo.
echo Usuario administrador: admin@finanzas.com  /  Admin123
pause
