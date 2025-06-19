// app.js - Main entry point of the application

// Global variable for the Google Maps API
let googleMapsLoaded = false;

// Initialize the application
const initializeApp = async () => {
    try {
        // Load configuration
        await Config.load();
        
        const apiKey = Config.get('GOOGLE_MAPS_API_KEY');
        if (!apiKey) {
            throw new Error('Google Maps API key not found. Please configure the .env file.');
        }
        
        // Load Google Maps API dynamically
        await loadGoogleMapsApi(apiKey);
        
        // Initialize modules
        UIController.init();
        MapHandler.init();
        
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Error loading the application: ' + error.message);
    }
};

// Load Google Maps API dynamically
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
    // Initialize the application
    initializeApp();

    // Initially disable buttons
    UIController.setResultsButtonsState(false);
    UIController.setLoadRouteButtonState(localStorage.getItem('savedRoutes') && JSON.parse(localStorage.getItem('savedRoutes')).length > 0);

    // Event listener for the "Optimize Route" button
    document.getElementById('calculate-route').addEventListener('click', async () => {
        try {
            // Update UI to loading state
            UIController.setLoadingState(true);
            
            // Collect addresses
            const addresses = UIController.collectAddresses();
            
            // Validation
            if (!addresses.start || !addresses.end) {
                throw new Error('Start and destination must be specified.');
            }
            
            // Geocode all addresses
            const locations = await MapHandler.geocodeAddresses(addresses);
            
            // Get optimization preference
            const optimizationPreference = document.getElementById('optimization-preference').value;
            
            // Get mode of transport
            const travelMode = document.querySelector('input[name="travel-mode"]:checked').value;
            
            // Optimize route
            // Depending on the number of waypoints, decide which method to use
            let optimizedRoute;
            
            if (locations.waypoints.length <= 10) {
                // For few waypoints, use the Google Directions API directly
                try {
                    optimizedRoute = await RouteOptimizer.optimizeRouteWithDirectionsApi(locations, travelMode);
                } catch (error) {
                    console.warn('Directions API optimization error:', error);
                    // Fallback to our own algorithm
                    optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
                }
            } else {
                // For many waypoints, use our own algorithm
                optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
            }
            
            // Display results
            UIController.displayResults(optimizedRoute);
            MapHandler.displayRoute(optimizedRoute, travelMode);
            
        } catch (error) {
            UIController.showError(error.message);
            console.error('Route calculation error:', error);
        } finally {
            UIController.setLoadingState(false);
        }
    });
    
    // Demo feature: Load saved routes on start
    (async () => {
        try {
            const savedRoutes = await APIService.getSavedRoutes();
            
            if (savedRoutes?.length > 0) {
                console.log(`${savedRoutes.length} saved routes found:`, savedRoutes);
                
                // Here you could implement a UI for saved routes
                // For example, a dropdown list or a button to display
            }
        } catch (error) {
            console.warn('Error loading saved routes:', error);
        }
    })();
    
    // Event delegation for dynamically added elements
    document.addEventListener('click', event => {
        // Placeholder for event delegation for dynamic elements
    });
});