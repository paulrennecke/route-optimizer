// api-service.js - Kommunikation mit dem Backend (falls implementiert)

const APIService = (() => {
    // Basis-URL für API-Anfragen
    const API_URL = '/api'; // Anpassen je nach Backend-Setup
    
    // Private Methoden
    const handleResponse = async (response) => {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API-Fehler: ${response.status}`);
        }
        return response.json();
    };
    
    // Öffentliche Methoden
    return {
        // Methode zum Optimieren einer Route über das Backend
        optimizeRouteApi: async function(locations, preference) {
            try {
                const response = await fetch(`${API_URL}/optimize-route`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        locations,
                        preference
                    })
                });
                
                return handleResponse(response);
            } catch (error) {
                // Wenn kein Backend verfügbar ist oder es einen Fehler gibt, 
                // stattdessen die Client-seitige Optimierung verwenden
                console.warn('Backend-Optimierung fehlgeschlagen, verwende Client-seitige Optimierung', error);
                return RouteOptimizer.optimizeRoute(locations, preference);
            }
        },
        
        // Methode zum Speichern einer Route im Backend
        saveRoute: async function(routeData, name) {
            try {
                const response = await fetch(`${API_URL}/routes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name,
                        data: routeData
                    })
                });
                
                return handleResponse(response);
            } catch (error) {
                // Falls kein Backend verfügbar, lokale Speicherung verwenden
                console.warn('Backend-Speicherung fehlgeschlagen, verwende lokale Speicherung', error);
                
                // Hole gespeicherte Routen oder initialisiere leeres Array
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                
                // Füge neue Route hinzu
                const newRoute = {
                    id: Date.now().toString(),
                    name,
                    date: new Date().toISOString(),
                    data: routeData
                };
                
                savedRoutes.push(newRoute);
                
                // Speichere zurück ins localStorage
                localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
                
                return newRoute;
            }
        },
        
        // Methode zum Abrufen gespeicherter Routen
        getSavedRoutes: async function() {
            try {
                const response = await fetch(`${API_URL}/routes`);
                return handleResponse(response);
            } catch (error) {
                // Falls kein Backend verfügbar, lokale Speicherung verwenden
                console.warn('Backend-Abruf fehlgeschlagen, verwende lokale Speicherung', error);
                
                // Hole gespeicherte Routen aus localStorage
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                return savedRoutes;
            }
        },
        
        // Methode zum Löschen einer gespeicherten Route
        deleteRoute: async function(routeId) {
            try {
                const response = await fetch(`${API_URL}/routes/${routeId}`, {
                    method: 'DELETE'
                });
                
                if (response.status === 204) {
                    return true; // Erfolgreich gelöscht
                }
                
                return handleResponse(response);
            } catch (error) {
                // Falls kein Backend verfügbar, lokale Speicherung verwenden
                console.warn('Backend-Löschung fehlgeschlagen, verwende lokale Speicherung', error);
                
                // Hole gespeicherte Routen aus localStorage
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                
                // Filter die zu löschende Route
                const updatedRoutes = savedRoutes.filter(route => route.id !== routeId);
                
                // Speichere zurück ins localStorage
                localStorage.setItem('savedRoutes', JSON.stringify(updatedRoutes));
                
                return true;
            }
        }
    };
})();