// config.js - Konfiguration und Umgebungsvariablen

const Config = (() => {
    let envVars = {};
    let isLoaded = false;    // Fallback-Konfiguration
    const defaultConfig = {
        GOOGLE_MAPS_API_KEY: ''
    };

    // Lade .env Datei
    const loadEnv = async () => {
        if (isLoaded) return envVars;

        try {
            const response = await fetch('.env');
            if (response.ok) {
                const envContent = await response.text();
                const lines = envContent.split('\n');
                
                lines.forEach(line => {
                    line = line.trim();
                    if (line && !line.startsWith('#')) {
                        const [key, ...valueParts] = line.split('=');
                        if (key && valueParts.length > 0) {
                            envVars[key.trim()] = valueParts.join('=').trim();
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('Konnte .env Datei nicht laden:', error);
        }

        // Verwende Fallback für fehlende Werte
        Object.keys(defaultConfig).forEach(key => {
            if (!envVars[key]) {
                envVars[key] = defaultConfig[key];
            }
        });

        isLoaded = true;
        return envVars;
    };

    return {
        load: loadEnv,
        get: (key) => envVars[key] || defaultConfig[key] || '',
        isLoaded: () => isLoaded
    };
})();

window.Config = Config;