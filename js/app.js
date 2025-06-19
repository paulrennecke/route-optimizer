// app.js - Haupteinstiegspunkt der Anwendung

// Globale Variable für die Google Maps API
let googleMapsLoaded = false;

// Initialisiere die Anwendung
const initializeApp = async () => {
    try {
        // Lade Konfiguration
        await Config.load();
        
        const apiKey = Config.get('GOOGLE_MAPS_API_KEY');
        if (!apiKey) {
            throw new Error('Google Maps API Key nicht gefunden. Bitte .env Datei konfigurieren.');
        }
        
        // Lade Google Maps API dynamisch
        await loadGoogleMapsApi(apiKey);
        
        // Initialisiere die Module
        UIController.init();
        MapHandler.init();
        
        console.log('Anwendung erfolgreich initialisiert');
        
    } catch (error) {
        console.error('Fehler bei der Initialisierung:', error);
        alert('Fehler beim Laden der Anwendung: ' + error.message);
    }
};

// Lade Google Maps API dynamisch
const loadGoogleMapsApi = (apiKey) => {
    return new Promise((resolve, reject) => {
        if (googleMapsLoaded) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            googleMapsLoaded = true;
            resolve();
        };
        script.onerror = () => {
            reject(new Error('Fehler beim Laden der Google Maps API'));
        };
        document.head.appendChild(script);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialisiere die Anwendung
    initializeApp();

    // Buttons initial deaktivieren
    UIController.setResultsButtonsState(false);
    UIController.setLoadRouteButtonState(localStorage.getItem('savedRoutes') && JSON.parse(localStorage.getItem('savedRoutes')).length > 0);

    // Event-Listener für den "Route optimieren"-Button
    document.getElementById('calculate-route').addEventListener('click', async () => {
        try {
            // UI aktualisieren
            UIController.setLoadingState(true);
            
            // Adressen sammeln
            const addresses = UIController.collectAddresses();
            
            // Validierung
            if (!addresses.start || !addresses.end) {
                throw new Error('Start- und Zielpunkt müssen angegeben werden.');
            }
            
            // Geokodierung aller Adressen
            const locations = await MapHandler.geocodeAddresses(addresses);
            
            // Optimierungspräferenz holen
            const optimizationPreference = document.getElementById('optimization-preference').value;
            
            // Fortbewegungsmittel holen
            const travelMode = document.querySelector('input[name="travel-mode"]:checked').value;
            
            // Route optimieren
            // Je nach Anzahl der Wegpunkte entscheiden, welche Methode zu verwenden ist
            let optimizedRoute;
            
            if (locations.waypoints.length <= 10) {
                // Bei wenigen Wegpunkten verwende die Google Directions API direkt
                try {
                    optimizedRoute = await RouteOptimizer.optimizeRouteWithDirectionsApi(locations, travelMode);
                } catch (error) {
                    console.warn('Fehler bei der Directions API Optimierung:', error);
                    // Fallback auf unseren eigenen Algorithmus
                    optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
                }
            } else {
                // Bei vielen Wegpunkten eigenen Algorithmus verwenden
                optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
            }
            
            // Ergebnisse anzeigen
            UIController.displayResults(optimizedRoute);
            MapHandler.displayRoute(optimizedRoute, travelMode);
            
        } catch (error) {
            UIController.showError(error.message);
            console.error('Fehler bei der Routenberechnung:', error);
        } finally {
            UIController.setLoadingState(false);
        }
    });
    
    // Demo-Feature: Lade gespeicherte Routen beim Start
    const loadSavedRoutes = async () => {
        try {
            const savedRoutes = await APIService.getSavedRoutes();
            
            if (savedRoutes && savedRoutes.length > 0) {
                console.log(`${savedRoutes.length} gespeicherte Routen gefunden:`, savedRoutes);
                
                // Hier könnte man eine UI für gespeicherte Routen implementieren
                // Zum Beispiel eine Dropdown-Liste oder einen Button zum Anzeigen
            }
        } catch (error) {
            console.warn('Fehler beim Laden gespeicherter Routen:', error);
        }
    };
      // Gespeicherte Routen laden
    loadSavedRoutes();
    
    // Event Delegation für dynamisch hinzugefügte Elemente
    document.addEventListener('click', (event) => {
        // Beispiel für Event Delegation bei dynamisch erstellten Elementen
        // Hier könnten Aktionen für dynamisch erstellte UI-Elemente implementiert werden
    });
});