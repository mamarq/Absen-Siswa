@echo off
title "Aplikasi Absen Siswa & Jurnal Mengajar - SMKN 1 Bantaeng"
echo ====================================================================
echo   MEMULAI SISTEM INFORMASI ABSENSI ^& JURNAL MENGAJAR GURU MAPEL
echo   UPT SMKN 1 BANTAENG
echo ====================================================================
echo.
echo Server berjalan di: http://localhost:8085
echo Menghubungkan browser...
echo.
echo Tekan CTRL + C untuk menghentikan server.
echo.

start "" "http://localhost:8085"
python server.py
