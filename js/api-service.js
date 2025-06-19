// api-service.js - Communication with the backend (if implemented)

const APIService = (() => {
    const API_URL = '/api';
    const handleResponse = async response => {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API error: ${response.status}`);
        }
        return response.json();
    };
    return {
        optimizeRouteApi: async (locations, preference) => {
            try {
                const response = await fetch(`${API_URL}/optimize-route`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locations, preference })
                });
                return handleResponse(response);
            } catch (error) {
                console.warn('Backend optimization failed, using client-side optimization', error);
                return RouteOptimizer.optimizeRoute(locations, preference);
            }
        },
        saveRoute: async (routeData, name) => {
            try {
                const response = await fetch(`${API_URL}/routes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, data: routeData })
                });
                return handleResponse(response);
            } catch (error) {
                console.warn('Backend save failed, using local storage', error);
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                const newRoute = { id: Date.now().toString(), name, date: new Date().toISOString(), data: routeData };
                savedRoutes.push(newRoute);
                localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
                return newRoute;
            }
        },
        getSavedRoutes: async () => {
            try {
                const response = await fetch(`${API_URL}/routes`);
                return handleResponse(response);
            } catch (error) {
                console.warn('Backend fetch failed, using local storage', error);
                return JSON.parse(localStorage.getItem('savedRoutes') || '[]');
            }
        },
        deleteRoute: async routeId => {
            try {
                const response = await fetch(`${API_URL}/routes/${routeId}`, { method: 'DELETE' });
                if (response.status === 204) return true;
                return handleResponse(response);
            } catch (error) {
                console.warn('Backend delete failed, using local storage', error);
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                const updatedRoutes = savedRoutes.filter(route => route.id !== routeId);
                localStorage.setItem('savedRoutes', JSON.stringify(updatedRoutes));
                return true;
            }
        },
        
        // Google Geocoding API: Adresse formatieren
        geocodeAddress: async function(address) {
            await Config.load();
            const apiKey = Config.get('GOOGLE_MAPS_API_KEY');
            if (!apiKey) throw new Error('Google Maps API Key fehlt!');
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
                return data.results[0].formatted_address;
            } else {
                throw new Error('Adresse konnte nicht formatiert werden');
            }
        },
        
        // Hilfsfunktion: Adressen aus Kontakten normalisieren
        normalizeContactAddresses: async function(addresses) {
            // addresses: Array von Strings
            const formatted = [];
            for (const addr of addresses) {
                try {
                    const formattedAddr = await APIService.geocodeAddress(addr);
                    formatted.push(formattedAddr);
                } catch (e) {
                    formatted.push(addr); // Fallback: Originaladresse
                }
            }
            return formatted;
        },
    };
})();