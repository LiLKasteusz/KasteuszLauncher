# KasteuszLauncher

Nowoczesny, szybki i minimalistyczny launcher **Minecraft: Java Edition** z pełną obsługą kont **Microsoft Premium** oraz interaktywnym podglądem skórek gracza w 3D.

Interfejs użytkownika został zaprojektowany w oparciu o ciemny, elegancki styl graficzny w języku polskim.

---

## 🚀 Główne Funkcje

1. **Oficjalne Logowanie Microsoft Premium**:
   - Bezpieczne uwierzytelnianie przez oficjalne okno Microsoft OAuth 2.0 / Xbox Live.
   - Weryfikacja licencji gry Minecraft Java Edition w usłudze Mojang / Microsoft Services.
   - Automatyczne pobieranie profilu gracza (UUID, nick, aktywna skórka).
   - Bezgłośne odświeżanie tokenów sesji (`refresh_token`) bez konieczności ponownego logowania.
   - Wymuszenie zalogowania przed uruchomieniem gry (zgodnie z wymaganiem).
   - Opcjonalny tryb testowy offline dla celów deweloperskich.

2. **Interaktywny Model Skórki 3D**:
   - Trójwymiarowy model postaci renderowany w czasie rzeczywistym przy użyciu silnika `skinview3d` (Three.js WebGL).
   - Pełna swoboda obracania postaci myszką (360°).
   - Naturalna animacja oddychania (*Idle Animation*).
   - Renderowanie warstw dodatkowych (korony, kurtki, rękawy, spodnie 3D).
   - Domyślna stylizowana skórka z koroną i numerem 15.

3. **Uruchamianie Minecraft**:
   - Obsługa oficjalnych wydań Minecraft (np. 1.21.4, 1.21.1, 1.20.4, 1.16.5, 1.12.2, 1.8.9 i innych).
   - Automatyczne pobieranie brakujących plików klienta, bibliotek oraz natywnych bibliotek systemowych Linux / Windows.
   - Weryfikacja sum kontrolnych pobieranych plików.
   - Pasek postępu pobierania na żywo bezpośrednio na przycisku akcji.
   - Podgląd konsoli gry w zakładce *Parametry*.

4. **Konfiguracja i Parametry**:
   - Płynny suwak przydziału pamięci RAM (od 2 GB do 16 GB).
   - Automatyczne wykrywanie środowiska Java (OpenJDK 21 / Java 17).
   - Wybór własnego folderu z plikami gry (`~/.kasteuszlauncher/minecraft`).
   - Opcja automatycznego zamykania launchera po uruchomieniu gry w celu oszczędzania zasobów komputera.

---

## 🛠️ Uruchomienie

Aby uruchomić launcher, przejdź do folderu projektu i wykonaj:

```bash
./start.sh
```

lub za pomocą npm:

```bash
npm start
```

---

## 📂 Struktura Projektu

```
KasteuszLauncher/
├── package.json               # Konfiguracja projektu i zależności Node/Electron
├── start.sh                   # Skrypt startowy launchera
├── src/
│   ├── main/
│   │   ├── main.js            # Proces główny Electron, IPC, okno aplikacji
│   │   ├── auth.js            # Autoryzacja Microsoft OAuth, Xbox Live, XSTS, Minecraft API
│   │   ├── launcher.js        # Silnik pobierania i startu Minecraft (MCLC)
│   │   ├── config.js          # Zarządzanie konfiguracją i zapisanymi kontami
│   │   ├── mojang.js          # Pobieranie manifestu oficjalnych wersji Minecraft
│   │   └── preload.js         # Bezpieczny mostek ContextBridge IPC
│   └── renderer/
│       ├── index.html         # Struktura interfejsu użytkownika w języku polskim
│       ├── css/
│       │   └── style.css      # Ciemny motyw dopasowany do wzoru graficznego
│       ├── js/
│       │   ├── renderer.js    # Logika UI, obsługa zdarzeń, przełączanie zakładek
│       │   └── skinview3d.bundle.js # Silnik podglądu 3D skórek Minecraft
│       └── assets/
│           ├── logo.svg       # Fioletowe świecące logo KasteuszLauncher
│           └── default-skin.png # Tekstura skórki gracza z koroną i numerem 15
└── README.md
```
