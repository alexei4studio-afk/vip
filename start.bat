@echo off
echo =========================================
echo Pornire Admin Dashboard - azisunt.vip
echo =========================================

echo 1. Instalare dependente pentru server (daca e cazul)...
pip install flask flask-cors >nul 2>&1

echo 2. Pornire Server Backend (Flask) in fundal...
start /b python server.py

echo 3. Asteptare 2 secunde pentru pornirea serverului...
timeout /t 2 /nobreak >nul

echo 4. Deschiderea browser-ului la panoul de admin...
start http://localhost:5000/

echo.
echo Serverul ruleaza in aceasta fereastra. NU O INCHIDE!
echo Daca inchizi fereastra, dashboard-ul de admin nu va mai functiona.
echo.
echo Pentru oprire: Apasa Ctrl+C de doua ori.
cmd /k
