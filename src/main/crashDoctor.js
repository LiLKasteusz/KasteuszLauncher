/**
 * KasteuszLauncher — Diagnoza i Naprawa Błędów Gry (Mod Conflict Resolver)
 * Diagnoza crash-reports, analizator logów Fabric/Minecraft,
 * wykrywanie zduplikowanych i gryzących się modów oraz naprawa 1-kliknięciem.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { shell, clipboard } = require('electron');
const profiles = require('./profiles');
const config = require('./config');
const mods = require('./mods');

function formatTimestamp(d) {
  if (!d) return 'Nieznana data';
  return new Date(d).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Pobiera katalog instancji dla wskazanego lub aktywnego profilu
 */
function resolveInstanceDir(profileId) {
  if (profileId && profileId !== 'active') {
    const all = profiles.getAllProfiles ? profiles.getAllProfiles() : [];
    const found = all.find(p => p.id === profileId);
    if (found) {
      return profiles.getInstanceDirectory(found);
    }
  }
  return profiles.getActiveInstanceDirectory
    ? profiles.getActiveInstanceDirectory()
    : path.join(os.homedir(), '.kasteuszlauncher', 'minecraft');
}

/**
 * Szuka najnowszego pliku crash-report
 */
function findLatestCrashReport(instanceDir) {
  const crashDir = path.join(instanceDir, 'crash-reports');
  if (!fs.existsSync(crashDir)) return null;

  try {
    const files = fs.readdirSync(crashDir)
      .filter(f => f.startsWith('crash-') && f.endsWith('.txt'))
      .map(name => {
        const fullPath = path.join(crashDir, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          fullPath,
          timestamp: stat.mtimeMs || stat.ctimeMs || 0
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    if (files.length === 0) return null;
    const latest = files[0];
    const content = fs.readFileSync(latest.fullPath, 'utf8');

    return {
      filePath: latest.fullPath,
      fileName: latest.name,
      timestamp: latest.timestamp,
      dateFormatted: formatTimestamp(latest.timestamp),
      content
    };
  } catch (err) {
    console.warn('[CrashDoctor] Błąd odczytu crash-reports:', err.message);
    return null;
  }
}

/**
 * Czyta końcówkę pliku logs/latest.log
 */
function readLatestLogTail(instanceDir, maxLines = 160) {
  const logPath = path.join(instanceDir, 'logs', 'latest.log');
  if (!fs.existsSync(logPath)) return null;

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const tail = lines.slice(-maxLines).join('\n');
    return {
      filePath: logPath,
      content: tail,
      fullLinesCount: lines.length
    };
  } catch (err) {
    console.warn('[CrashDoctor] Błąd odczytu logs/latest.log:', err.message);
    return null;
  }
}

/**
 * Wyszukuje zduplikowane mody w katalogu mods/
 */
function scanDuplicateMods(instanceDir) {
  const modsDir = path.join(instanceDir, 'mods');
  if (!fs.existsSync(modsDir)) return [];

  const jarFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar') && !f.endsWith('.disabled'));
  const groups = new Map();

  for (const file of jarFiles) {
    // Uproszczona normalizacja nazwy: usuwamy wersję i platformę
    // np. "sodium-fabric-0.5.8+mc1.20.4.jar" -> "sodium"
    // "fabric-api-0.129.0+1.21.8.jar" -> "fabric-api"
    let base = file.toLowerCase()
      .replace(/\.jar$/, '')
      .replace(/[-_]?(fabric|quilt|forge|neoforge)[-_]?/g, '')
      .replace(/[-_]v?\d+[\d\.\-_+a-z]*$/i, '')
      .replace(/[-_]mc\d+[\d\.]*/i, '')
      .trim();

    if (!base) base = file;

    if (!groups.has(base)) {
      groups.set(base, []);
    }
    const stat = fs.statSync(path.join(modsDir, file));
    groups.get(base).push({ file, size: stat.size, mtime: stat.mtimeMs });
  }

  const duplicates = [];
  for (const [baseName, list] of groups.entries()) {
    if (list.length > 1) {
      // Posortuj od najnowszego mtime
      list.sort((a, b) => b.mtime - a.mtime);
      duplicates.push({
        baseName,
        files: list.map(item => item.file),
        newestFile: list[0].file,
        olderFiles: list.slice(1).map(item => item.file)
      });
    }
  }

  return duplicates;
}

/**
 * Szuka pliku moda w folderze mods/ na podstawie identyfikatora modId lub nazwy klasy
 */
function findModFileByModId(instanceDir, modId) {
  if (!modId) return null;
  const modsDir = path.join(instanceDir, 'mods');
  if (!fs.existsSync(modsDir)) return null;

  const files = fs.readdirSync(modsDir);
  const cleanId = modId.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Dokładne lub częściowe dopasowanie nazwy pliku
  for (const f of files) {
    const cleanFileName = f.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanFileName.includes(cleanId)) {
      return f;
    }
  }

  return null;
}

/**
 * Główna funkcja diagnostyczna
 */
async function diagnose(profileId = 'active') {
  const instanceDir = resolveInstanceDir(profileId);
  const activeProfile = profiles.getActiveProfile ? profiles.getActiveProfile() : null;

  const crashReport = findLatestCrashReport(instanceDir);
  const logTail = readLatestLogTail(instanceDir);
  const duplicates = scanDuplicateMods(instanceDir);

  const combinedText = [
    crashReport?.content || '',
    logTail?.content || ''
  ].join('\n');

  if (!crashReport && !logTail && duplicates.length === 0) {
    return {
      hasCrash: false,
      title: 'Brak zarejestrowanych błędów',
      summary: 'Wszystkie logi są czyste, a w folderze gry nie znaleziono żadnego raportu o błędzie.',
      duplicates: []
    };
  }

  // Obiekt wynikowy diagnozy
  let diagnosis = {
    hasCrash: !!crashReport || /Exception|Error|FATAL/i.test(combinedText),
    crashTime: crashReport ? crashReport.dateFormatted : (logTail ? 'Ostatnia sesja' : 'Brak'),
    reportPath: crashReport ? crashReport.filePath : (logTail ? logTail.filePath : null),
    reportFileName: crashReport ? crashReport.fileName : 'latest.log',
    errorType: 'UNKNOWN',
    severity: 'critical',
    title: 'Nierozpoznany błąd gry',
    summary: 'Gra wyłączyła się nieoczekiwanie. Przeanalizuj poniższy zrzut błędu.',
    culpritMod: null,
    culpritFile: null,
    culpritClass: null,
    solution: 'Sprawdź logi gry lub spróbuj wyłączyć ostatnio dodane mody.',
    suggestedActions: [],
    rawReport: crashReport?.content || logTail?.content || '',
    duplicates
  };

  // --- REGUŁA 1: Zduplikowane mody w folderze mods/ ---
  if (duplicates.length > 0) {
    const dupNames = duplicates.map(d => `${d.baseName} (${d.files.join(', ')})`).join('; ');
    diagnosis.hasCrash = true;
    diagnosis.errorType = 'DUPLICATE_MODS';
    diagnosis.severity = 'critical';
    diagnosis.title = 'Wykryto zduplikowane pliki modów';
    diagnosis.summary = `W folderze mods/ znajdują się zduplikowane wersje tych samych modyfikacji: ${dupNames}. Fabric nie może załadować dwóch wersji tej samej biblioteki jednocześnie!`;
    diagnosis.solution = 'Pozostaw tylko najnowszą wersję każdego moda i wyłącz starsze duplikaty.';

    const olderFilesToDisable = duplicates.flatMap(d => d.olderFiles);
    if (olderFilesToDisable.length > 0) {
      diagnosis.suggestedActions.push({
        id: 'disable_duplicates',
        label: `Wyłącz starsze duplikaty (${olderFilesToDisable.length} plików)`,
        type: 'danger',
        payload: { files: olderFilesToDisable }
      });
    }
  }

  // --- REGUŁA 2: Błąd wykonania etapu Entrypoint w Fabric (np. smartfpsbooster) ---
  const entrypointMatch = combinedText.match(/Could not execute entrypoint stage '(?<stage>[^']+)' due to errors, provided by '(?<modId>[^']+)' at '(?<entrypoint>[^']+)'/i);
  if (entrypointMatch) {
    const { stage, modId, entrypoint } = entrypointMatch.groups;
    const culpritFile = findModFileByModId(instanceDir, modId);

    // Szukamy przyczyny: np. NoSuchMethodError, ClassNotFoundException
    let causeReason = 'Błąd w kodzie moda';
    const noSuchMethod = combinedText.match(/Caused by: java\.lang\.NoSuchMethodError:\s*'(?<sig>[^']+)'/i);
    const classNotFound = combinedText.match(/Caused by: java\.lang\.ClassNotFoundException:\s*(?<cls>[^\s\r\n]+)/i);

    if (noSuchMethod) {
      causeReason = `Odwołanie do nieistniejącej metody (${noSuchMethod.groups.sig}). Mod jest przeznaczony dla innej wersji Minecrafta!`;
    } else if (classNotFound) {
      causeReason = `Brakująca klasa (${classNotFound.groups.cls}). Brakująca zależność lub konflikt wersji.`;
    }

    diagnosis.errorType = 'ENTRYPOINT_FAILURE';
    diagnosis.severity = 'critical';
    diagnosis.title = `Błąd inicjalizacji moda: ${modId}`;
    diagnosis.summary = `Mod '${modId}' wywołał błąd krytyczny podczas etapu startu klienta (${stage}). Powód: ${causeReason}`;
    diagnosis.culpritMod = modId;
    diagnosis.culpritClass = entrypoint;
    diagnosis.culpritFile = culpritFile;
    diagnosis.solution = `Mod '${modId}' jest niekompatybilny z Minecraft 1.21.11. Wyłącz go lub zaktualizuj do nowszej wersji.`;

    if (culpritFile) {
      diagnosis.suggestedActions.unshift({
        id: 'disable_mod',
        label: `Wyłącz mod: ${culpritFile}`,
        type: 'danger',
        payload: { filename: culpritFile }
      });
    }
  }

  // --- REGUŁA 3: Brakujące zależności lub niekompatybilność Fabric Loader ---
  if (/Incompatible mods found!|net\.fabricmc\.loader\.impl\.FormattedException/i.test(combinedText)) {
    const missingMods = new Set();
    const solutionMatches = combinedText.matchAll(/-\s*Install\s+([a-zA-Z0-9_\-]+)/gi);
    for (const m of solutionMatches) {
      const name = m[1].toLowerCase().trim();
      if (name && name !== 'any' && name !== 'version' && name !== 'later' && name !== 'or') {
        missingMods.add(name);
      }
    }
    const detailMatches = combinedText.matchAll(/requires\s+(?:version\s+[^\s]+\s+or\s+later\s+of|any\s+version\s+of)\s+([a-zA-Z0-9_\-]+),\s+which is missing!/gi);
    for (const m of detailMatches) {
      const name = m[1].toLowerCase().trim();
      if (name) missingMods.add(name);
    }

    if (missingMods.size > 0) {
      const missingList = [...missingMods];
      diagnosis.hasCrash = true;
      diagnosis.errorType = 'MISSING_DEPENDENCIES';
      diagnosis.severity = 'critical';
      diagnosis.title = `Brakujące biblioteki Fabric (${missingList.length} modów)`;
      diagnosis.summary = `Fabric Loader zatrzymał start gry, ponieważ Twoje mody wymagają dodatkowych bibliotek: ${missingList.join(', ')}.`;
      diagnosis.solution = `Zainstaluj brakujące biblioteki (${missingList.join(', ')}) jednym kliknięciem.`;

      diagnosis.suggestedActions.unshift({
        id: 'install_missing_dependencies',
        label: `Zainstaluj brakujące biblioteki (${missingList.join(', ')})`,
        type: 'primary',
        payload: {
          missingMods: missingList,
          mcVersion: activeProfile?.mcVersion || '1.21.11'
        }
      });
    }
  }

  const incompatMatch = combinedText.match(/Mod '(?<mod>[^']+)' \((?<ver>[^)]+)\) requires '(?<req>[^']+)' \((?<reqVer>[^)]+)\), but (?<reason>[^!\r\n]+)/i);
  if (incompatMatch) {
    const { mod, ver, req, reqVer, reason } = incompatMatch.groups;
    const culpritFile = findModFileByModId(instanceDir, mod);

    diagnosis.errorType = 'DEPENDENCY_MISSING';
    diagnosis.severity = 'critical';
    diagnosis.title = `Niezgodność zależności: ${mod} wymaga ${req}`;
    diagnosis.summary = `Mod '${mod}' (${ver}) wymaga modyfikacji '${req}' w wersji ${reqVer}, ale ${reason.trim()}.`;
    diagnosis.culpritMod = mod;
    diagnosis.culpritFile = culpritFile;
    diagnosis.solution = `Zainstaluj wymaganą bibliotekę '${req}' w wersji ${reqVer} lub wyłącz mod '${mod}'.`;

    if (req.toLowerCase().includes('fabric-api') || req.toLowerCase() === 'fabric') {
      diagnosis.suggestedActions.push({
        id: 'install_fabric_api',
        label: 'Zainstaluj najnowszy Fabric API',
        type: 'primary'
      });
    }

    if (culpritFile) {
      diagnosis.suggestedActions.push({
        id: 'disable_mod',
        label: `Wyłącz mod: ${culpritFile}`,
        type: 'danger',
        payload: { filename: culpritFile }
      });
    }
  }

  // --- REGUŁA 4: Brak pamięci RAM (OutOfMemoryError) ---
  if (/java\.lang\.OutOfMemoryError/i.test(combinedText) || /There is insufficient memory for the Java Runtime/i.test(combinedText)) {
    const currentRam = activeProfile?.memoryMax || config.getConfig()?.memoryMax || 4;
    const recommendedRam = Math.min(12, Math.max(6, currentRam + 2));

    diagnosis.errorType = 'OUT_OF_MEMORY';
    diagnosis.severity = 'critical';
    diagnosis.title = 'Brak pamięci RAM (OutOfMemoryError)';
    diagnosis.summary = `Minecraft wyczerpał przydzieloną pamięć operacyjną (Java heap space). Aktualnie przydzielono: ${currentRam} GB RAM. Przy dużej liczbie modów i shaderów gra wymaga więcej pamięci.`;
    diagnosis.solution = `Zwiększ przydział pamięci RAM w ustawieniach launchera do co najmniej ${recommendedRam} GB.`;

    diagnosis.suggestedActions.unshift({
      id: 'increase_ram',
      label: `Zwiększ RAM do ${recommendedRam} GB (1-Click)`,
      type: 'primary',
      payload: { targetRamGb: recommendedRam }
    });
  }

  // --- REGUŁA 5: Niezgodna wersja Javy (UnsupportedClassVersionError) ---
  const javaVersionMatch = combinedText.match(/UnsupportedClassVersionError: .* has been compiled by a more recent version of the Java Runtime \(class file version (?<version>\d+)\), this version of the Java Runtime only recognizes class file versions up to (?<currentVer>\d+)/i);
  if (javaVersionMatch) {
    const requiredClassVer = parseInt(javaVersionMatch.groups.version, 10);
    const requiredJava = requiredClassVer === 65 ? 'Java 21' : requiredClassVer === 61 ? 'Java 17' : 'nowszą Javę';

    diagnosis.errorType = 'JAVA_VERSION_MISMATCH';
    diagnosis.severity = 'critical';
    diagnosis.title = `Niezgodna wersja Javy (wymagana ${requiredJava})`;
    diagnosis.summary = `Minecraft 1.21 oraz Twoje mody zostały skompilowane dla ${requiredJava} (class file ${requiredClassVer}), a launcher uruchomił starszą wersję Javy.`;
    diagnosis.solution = `Przełącz ścieżkę Javy w Launcherze na zainstalowaną wersję Java 21 LTS (Temurin / OpenJDK 21).`;

    diagnosis.suggestedActions.unshift({
      id: 'switch_java_21',
      label: 'Przełącz na Java 21 LTS (Auto-Detect)',
      type: 'primary'
    });
  }

  // --- REGUŁA 6: Uszkodzony plik archiwum .jar (ZipException) ---
  const zipExceptionMatch = combinedText.match(/ZipException: ZipFile invalid (?<hdr>[A-Za-z]+) header/i);
  if (zipExceptionMatch) {
    const failedClass = combinedText.match(/Failed to load class file for '(?<cls>[^']+)'/i);
    const culpritModHint = failedClass ? failedClass.groups.cls.split('.')[0] : null;
    const culpritFile = culpritModHint ? findModFileByModId(instanceDir, culpritModHint) : null;

    diagnosis.errorType = 'CORRUPTED_JAR';
    diagnosis.severity = 'critical';
    diagnosis.title = 'Uszkodzony plik modyfikacji (.jar)';
    diagnosis.summary = `Plik moda został niekompletnie pobrany lub uszkodzony na dysku (${zipExceptionMatch[0]}).`;
    diagnosis.culpritFile = culpritFile;
    diagnosis.solution = 'Usuń uszkodzony plik i pobierz go ponownie.';

    if (culpritFile) {
      diagnosis.suggestedActions.unshift({
        id: 'delete_mod',
        label: `Usuń uszkodzony plik: ${culpritFile}`,
        type: 'danger',
        payload: { filename: culpritFile }
      });
    }
  }

  // --- REGUŁA 7: Błąd kompilacji shaderów Iris ---
  if (/ShaderCompileException|Shader compilation failed|Failed to compile shader/i.test(combinedText)) {
    diagnosis.errorType = 'SHADER_CRASH';
    diagnosis.severity = 'warning';
    diagnosis.title = 'Błąd kompilacji shaderów (Iris / OpenGL)';
    diagnosis.summary = 'Wybrana paczka shaderów zawiera błędy składni GLSL nieobsługiwane przez Twoją kartę graficzną lub sterownik Linuksa.';
    diagnosis.solution = 'Wyłącz aktywną paczkę shaderów w ustawieniach lub wybierz lżejszy profil (np. BSL lub Complementary Reimagined).';

    diagnosis.suggestedActions.unshift({
      id: 'disable_shaders',
      label: 'Wyłącz shadery (Przywróć standardowy render)',
      type: 'primary'
    });
  }

  // Zawsze dodaj akcję Kopiuj do Discorda i Otwórz Folder
  diagnosis.suggestedActions.push({
    id: 'copy_discord',
    label: 'Kopiuj raport dla Discorda',
    type: 'secondary'
  });

  diagnosis.suggestedActions.push({
    id: 'open_crash_folder',
    label: 'Otwórz folder crash-reports',
    type: 'secondary'
  });

  return diagnosis;
}

/**
 * Wykonuje automatyczną naprawę 1-kliknięciem
 */
async function executeFix(actionId, payload = {}) {
  const instanceDir = resolveInstanceDir(payload.profileId || 'active');

  try {
    switch (actionId) {
      case 'disable_mod': {
        if (!payload.filename) throw new Error('Brak nazwy pliku moda.');
        const res = mods.toggleMod(payload.filename);
        return {
          success: true,
          message: `Pomyślnie wyłączono mod "${payload.filename}". Możesz spróbować uruchomić grę ponownie!`,
          details: res
        };
      }

      case 'delete_mod': {
        if (!payload.filename) throw new Error('Brak nazwy pliku moda.');
        const res = mods.deleteMod(payload.filename);
        return {
          success: true,
          message: `Pomyślnie usunięto uszkodzony plik moda "${payload.filename}".`,
          details: res
        };
      }

      case 'install_missing_dependencies': {
        const missing = payload.missingMods || [];
        const installed = [];
        const mcVer = payload.mcVersion || '1.21.11';
        const targetDir = path.join(instanceDir, 'mods');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        for (const modSlug of missing) {
          try {
            const slug = modSlug === 'fabric' ? 'fabric-api' : modSlug;
            // 1. Sprawdź czy mod jest w folderze współdzielonym
            const sharedMods = path.join(os.homedir(), '.kasteuszlauncher', 'minecraft', 'mods');
            const files = fs.existsSync(sharedMods) ? fs.readdirSync(sharedMods) : [];
            const foundShared = files.find(f => f.toLowerCase().includes(slug.replace(/[^a-z0-9]/g, '')) && f.endsWith('.jar'));
            if (foundShared && !fs.existsSync(path.join(targetDir, foundShared))) {
              fs.copyFileSync(path.join(sharedMods, foundShared), path.join(targetDir, foundShared));
              installed.push(foundShared);
              continue;
            }

            // 2. Jeśli nie ma w shared, pobierz z Modrinth
            const res = await fetch(`https://api.modrinth.com/v2/project/${slug}/version?loaders=["fabric"]&game_versions=["${mcVer}"]`, {
              headers: { 'User-Agent': 'KasteuszLauncher/1.0.0' }
            });
            if (res.ok) {
              const versions = await res.json();
              if (versions.length > 0) {
                const target = versions.find(v => v.game_versions.includes(mcVer)) || versions[0];
                const file = target.files.find(f => f.primary) || target.files[0];
                if (file) {
                  const fRes = await fetch(file.url);
                  if (fRes.ok) {
                    const buf = Buffer.from(await fRes.arrayBuffer());
                    fs.writeFileSync(path.join(targetDir, file.filename), buf);
                    installed.push(file.filename);
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`[CrashDoctor] Błąd pobierania ${modSlug}:`, e.message);
          }
        }
        return {
          success: true,
          message: `Pomyślnie zainstalowano ${installed.length} brakujących bibliotek (${installed.join(', ')})!`
        };
      }

      case 'disable_duplicates': {
        const files = payload.files || [];
        let disabledCount = 0;
        for (const f of files) {
          try {
            mods.toggleMod(f);
            disabledCount++;
          } catch (_) {}
        }
        return {
          success: true,
          message: `Pomyślnie wyłączono ${disabledCount} starszych duplikatów modów!`
        };
      }

      case 'increase_ram': {
        const targetGb = payload.targetRamGb || 6;
        // Zapisz w konfiguracji ogólnej oraz profilu
        config.saveConfig({ memoryMax: targetGb });
        const activeProfile = profiles.getActiveProfile ? profiles.getActiveProfile() : null;
        if (activeProfile && profiles.updateProfile) {
          profiles.updateProfile(activeProfile.id, { memoryMax: targetGb });
        }
        return {
          success: true,
          message: `Zwiększono przydział pamięci RAM do ${targetGb} GB!`
        };
      }

      case 'switch_java_21': {
        const candidates = [
          path.join(os.homedir(), '.jdks', 'jdk-21.0.6+7', 'bin', 'java'),
          '/usr/lib/jvm/java-21-openjdk-amd64/bin/java'
        ];
        let foundJava = null;
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            foundJava = c;
            break;
          }
        }
        if (foundJava) {
          config.saveConfig({ javaPath: foundJava });
          return {
            success: true,
            message: `Ustawiono Java 21 LTS (${foundJava}) jako domyślne środowisko!`
          };
        } else {
          return {
            success: false,
            error: 'Nie znaleziono automatycznie pliku Java 21. Wybierz go ręcznie w Ustawieniach.'
          };
        }
      }

      case 'disable_shaders': {
        const optionsIrisPath = path.join(instanceDir, 'optionsiris.txt');
        try {
          fs.writeFileSync(optionsIrisPath, 'enabled=false\nshaderPack=\n', 'utf8');
          return {
            success: true,
            message: 'Wyłączono shadery Iris! Gra wystartuje ze standardowym renderowaniem.'
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'copy_discord': {
        const diag = await diagnose(payload.profileId || 'active');
        const snippet = [
          '**Raport Błędów — KasteuszLauncher**',
          `> **Błąd:** ${diag.title}`,
          `> **Data:** ${diag.crashTime}`,
          `> **Konfliktujący plik:** ${diag.culpritMod || diag.culpritFile || 'Nieokreślony'}`,
          `> **Opis:** ${diag.summary}`,
          `> **Zalecenie:** ${diag.solution}`,
          '```',
          diag.rawReport.slice(0, 1500),
          '```'
        ].join('\n');

        if (clipboard && typeof clipboard.writeText === 'function') {
          clipboard.writeText(snippet);
        }
        return {
          success: true,
          snippet,
          message: 'Sformatowany raport błędu został skopiowany do schowka! Wklej go na Discordzie (Ctrl+V).'
        };
      }

      case 'open_crash_folder': {
        const crashDir = path.join(instanceDir, 'crash-reports');
        if (!fs.existsSync(crashDir)) {
          fs.mkdirSync(crashDir, { recursive: true });
        }
        await shell.openPath(crashDir);
        return { success: true };
      }

      default:
        throw new Error(`Nieznana akcja naprawcza: ${actionId}`);
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  diagnose,
  executeFix,
  findLatestCrashReport,
  readLatestLogTail,
  scanDuplicateMods
};
