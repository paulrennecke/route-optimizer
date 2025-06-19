// config.js - Configuration and environment variables

const Config = (() => {
    let envVars = {}, isLoaded = false;
    const defaultConfig = { GOOGLE_MAPS_API_KEY: '' };
    const loadEnv = async () => {
        if (isLoaded) return envVars;
        try {
            const response = await fetch('.env');
            if (response.ok) {
                const envContent = await response.text();
                envContent.split('\n').forEach(line => {
                    line = line.trim();
                    if (line && !line.startsWith('#')) {
                        const [key, ...valueParts] = line.split('=');
                        if (key && valueParts.length > 0)
                            envVars[key.trim()] = valueParts.join('=').trim();
                    }
                });
            }
        } catch (error) {
            console.warn('Could not load .env file:', error);
        }
        Object.keys(defaultConfig).forEach(key => {
            if (!envVars[key]) envVars[key] = defaultConfig[key];
        });
        isLoaded = true;
        return envVars;
    };
    return {
        load: loadEnv,
        get: key => envVars[key] || defaultConfig[key] || '',
        isLoaded: () => isLoaded
    };
})();

window.Config = Config;