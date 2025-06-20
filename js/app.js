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
            if (typeof error.message === 'string' && error.message.includes('NO_ROUTE') || error.message.includes('ZERO_RESULTS')) {
                UIController.showError('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
            } else {
                UIController.showError(error.message);
            }
            console.error('Route calculation error:', error);
        } finally {
            UIController.setLoadingState(false);
        }
    });
    const params = new URLSearchParams(window.location.search);
    const start = params.get('start');
    const end = params.get('end');
    const waypoints = params.get('waypoints');
    const opt = params.get('opt');
    const mode = params.get('mode');
    if (start && end) {
        document.getElementById('start').value = start;
        document.getElementById('end').value = end;
        const waypointsContainer = document.getElementById('waypoints-container');
        waypointsContainer.innerHTML = '';
        if (waypoints) {
            const wpArr = waypoints.split('|');
            for (let i = 0; i < wpArr.length; i++) {
                const wrapper = UIController.createWaypointElement(i + 1);
                waypointsContainer.appendChild(wrapper);
                const input = wrapper.querySelector('.address-autocomplete');
                input.value = wpArr[i];
                UIController.setupCombinedAutocomplete(input);
            }
        }
        if (opt) {
            const optSelect = document.getElementById('optimization-preference');
            if (optSelect) optSelect.value = opt;
        }
        if (mode) {
            const travelSelect = document.getElementById('travel-mode');
            if (travelSelect) travelSelect.value = mode;
        }
        setTimeout(() => {
            document.getElementById('calculate-route').click();
        }, 500);
    }
    (async () => {
        try {
            const savedRoutes = await APIService.getSavedRoutes();
            if (savedRoutes?.length > 0) {
                console.log(`${savedRoutes.length} saved routes found:`, savedRoutes);
            }
        } catch (error) {
            console.warn('Error loading saved routes:', error);
        }
    })();
});