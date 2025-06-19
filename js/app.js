// Main entry point of the application
let googleMapsLoaded = false;

const initializeApp = async () => {
    try {
        await Config.load();
        const apiKey = Config.get('GOOGLE_MAPS_API_KEY');
        if (!apiKey) {
            throw new Error('Google Maps API key not found. Please configure the .env file.');
        }
        await loadGoogleMapsApi(apiKey);
        UIController.init();
        MapHandler.init();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Error loading the application: ' + error.message);
    }
};

const loadGoogleMapsApi = apiKey => new Promise((resolve, reject) => {
    if (googleMapsLoaded) {
        resolve();
        return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => { googleMapsLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Error loading Google Maps API'));
    document.head.appendChild(script);
});

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    document.getElementById('calculate-route').addEventListener('click', async () => {
        try {
            UIController.setLoadingState(true);
            const addresses = UIController.collectAddresses();
            if (!addresses.start || !addresses.end) {
                throw new Error('Start and destination must be specified.');
            }
            const locations = await MapHandler.geocodeAddresses(addresses);
            // Hole die Werte jetzt aus den Dropdowns statt aus Radio-Buttons
            const optSelect = document.getElementById('optimization-preference');
            if (!optSelect) throw new Error('No optimization preference selected or found!');
            const optimizationPreference = optSelect.value;
            const travelSelect = document.getElementById('travel-mode');
            if (!travelSelect) throw new Error('No travel mode selected or found!');
            const travelMode = travelSelect.value;
            let optimizedRoute;
            if (locations.waypoints.length <= 10) {
                try {
                    optimizedRoute = await RouteOptimizer.optimizeRouteWithDirectionsApi(locations, travelMode);
                } catch (error) {
                    console.warn('Directions API optimization error:', error);
                    optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
                }
            } else {
                optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
            }
            UIController.displayResults(optimizedRoute);
            MapHandler.displayRoute(optimizedRoute, travelMode);
        } catch (error) {
            if (typeof error.message === 'string' && error.message.includes('keine Verbindung') || error.message.includes('NO_ROUTE') || error.message.includes('ZERO_RESULTS')) {
                UIController.showError('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
            } else {
                UIController.showError(error.message);
            }
            console.error('Route calculation error:', error);
        } finally {
            UIController.setLoadingState(false);
        }
    });
    (async () => {
        try {
            const savedRoutes = await APIService.getSavedRoutes();
            if (savedRoutes?.length > 0) {
                console.log(`${savedRoutes.length} saved routes found:`, savedRoutes);
                // Implement UI for saved routes if needed
            }
        } catch (error) {
            console.warn('Error loading saved routes:', error);
        }
    })();
    document.addEventListener('click', event => {
        // Placeholder for event delegation for dynamic elements
    });
});