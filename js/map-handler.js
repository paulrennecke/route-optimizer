// map-handler.js - Verwaltung der Google Maps Kartenkomponente

const MapHandler = (() => {
    // Private Variablen
    let map;
    let markers = [];
    let inputMarkers = []; // Variable für Eingabe-Marker
    let directionsService;
    let directionsRenderer;
    
    // Private Methoden
    const clearMarkers = () => {
        markers.forEach(marker => marker.setMap(null));
        markers = [];
    };
    
    const clearInputMarkers = () => {
        inputMarkers.forEach(marker => marker.setMap(null));
        inputMarkers = [];
    };
    
    const createCustomMarker = (position, icon, title) => {
        return new google.maps.Marker({
            position,
            map,
            title,
            icon,
            animation: google.maps.Animation.DROP
        });
    };
    
    // Öffentliche Methoden
    return {
        init: function() {
            // Google Maps initialisieren
            map = new google.maps.Map(document.getElementById('map'), {
                center: { lat: 51.1657, lng: 10.4515 }, // Mittelpunkt von Deutschland
                zoom: 6,
                mapTypeControl: true,
                streetViewControl: false,
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
                }
            });
            
            // Directions Service für Routenberechnung initialisieren
            directionsService = new google.maps.DirectionsService();
            directionsRenderer = new google.maps.DirectionsRenderer({
                map: map,
                suppressMarkers: true // Wir verwenden eigene Marker
            });
            
            // Event-Listener für Autocomplete-Events (falls benötigt)
            this.setupAutocompletionListeners();
        },
        
        // Methode für Autocomplete-Listener (kann je nach Anforderung angepasst werden)
        setupAutocompletionListeners: function() {
            // Listen auf Änderungen an den Eingabefeldern
            document.addEventListener('DOMNodeInserted', (event) => {
                // Prüfen, ob ein Autocomplete-Listenpunkt eingefügt wurde
                if (event.target.classList && 
                    event.target.classList.contains('pac-item')) {
                    // Warte auf Auswahl aus der Autocomplete-Liste
                    setTimeout(() => {
                        const inputs = document.querySelectorAll('.address-autocomplete');
                        inputs.forEach(input => {
                            if (input.value && !input.dataset.geocoded) {
                                this.geocodeAndShowOnMap(input.value, input.id);
                                input.dataset.geocoded = 'true';
                                
                                input.addEventListener('input', () => {
                                    input.dataset.geocoded = 'false';
                                });
                                
                                input.addEventListener('change', () => {
                                    if (input.value && input.dataset.geocoded === 'false') {
                                        this.geocodeAndShowOnMap(input.value, input.id);
                                        input.dataset.geocoded = 'true';
                                    }
                                });
                            }
                        });
                    }, 300);
                }
            });
        },
        
        // Methode zur Geokodierung und Anzeige auf der Karte
        geocodeAndShowOnMap: function(address, inputId) {
            const geocoder = new google.maps.Geocoder();
            
            geocoder.geocode({ address }, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK) {
                    const location = results[0].geometry.location;
                    
                    // Bestimme Marker-Typ basierend auf Input-ID
                    let icon;
                    let label = '';
                    
                    if (inputId === 'start') {
                        icon = {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: "#4CAF50",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#fff"
                        };
                        label = 'S';
                    } else if (inputId === 'end') {
                        icon = {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: "#F44336",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#fff"
                        };
                        label = 'Z';
                    } else {
                        // Extrahiere Nummer aus waypoint-ID
                        const waypointMatch = inputId.match(/waypoint-(\d+)/);
                        const waypointNum = waypointMatch ? waypointMatch[1] : '?';
                        
                        icon = {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: "#3498db",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#fff"
                        };
                        label = waypointNum;
                    }
                    
                    // Lösche vorhandene Marker mit dieser ID
                    const existingMarkerIndex = inputMarkers.findIndex(m => m.inputId === inputId);
                    if (existingMarkerIndex !== -1) {
                        inputMarkers[existingMarkerIndex].marker.setMap(null);
                        inputMarkers.splice(existingMarkerIndex, 1);
                    }
                    
                    // Erstelle neuen Marker
                    const marker = new google.maps.Marker({
                        position: location,
                        map: map,
                        title: address,
                        icon: icon,
                        label: {
                            text: label,
                            color: '#FFFFFF',
                            fontWeight: 'bold'
                        },
                        animation: google.maps.Animation.DROP
                    });
                    
                    // Speichere Marker mit Input-ID
                    inputMarkers.push({
                        inputId: inputId,
                        marker: marker
                    });
                    
                    // InfoWindow für den Marker
                    const infoWindow = new google.maps.InfoWindow({
                        content: `<div><strong>${address}</strong></div>`
                    });
                    
                    marker.addListener('click', () => {
                        infoWindow.open(map, marker);
                    });
                    
                    // Passe Kartenansicht an
                    if (inputMarkers.length === 1) {
                        map.setCenter(location);
                        map.setZoom(13);
                    } else {
                        const bounds = new google.maps.LatLngBounds();
                        inputMarkers.forEach(m => bounds.extend(m.marker.getPosition()));
                        map.fitBounds(bounds);
                    }
                }
            });
        },
        
        geocodeAddresses: async function(addresses) {
            const geocoder = new google.maps.Geocoder();
            
            // Funktion zum Geokodieren einer einzelnen Adresse
            const geocodeAddress = (address) => {
                return new Promise((resolve, reject) => {
                    geocoder.geocode({ address }, (results, status) => {
                        if (status === google.maps.GeocoderStatus.OK) {
                            resolve({
                                address,
                                location: results[0].geometry.location,
                                placeId: results[0].place_id
                            });
                        } else {
                            reject(`Konnte Adresse nicht finden: ${address}`);
                        }
                    });
                });
            };
            
            try {
                // Geokodiere Start, Ziel und Zwischenstopps parallel
                const startLocation = await geocodeAddress(addresses.start);
                const endLocation = await geocodeAddress(addresses.end);
                
                const waypointLocations = await Promise.all(
                    addresses.waypoints.map(address => geocodeAddress(address))
                );
                
                return {
                    start: startLocation,
                    waypoints: waypointLocations,
                    end: endLocation
                };
            } catch (error) {
                throw new Error(`Geokodierungs-Fehler: ${error}`);
            }
        },
        
        displayRoute: function(optimizedRoute) {
            // Vorherige Marker und Routen löschen
            clearMarkers();
            clearInputMarkers(); // Auch die Eingabe-Marker löschen
            directionsRenderer.setDirections({ routes: [] });
            
            // Wegpunkte für die Directions API vorbereiten
            const waypoints = optimizedRoute.stops
                .slice(1, -1) // Erstes und letztes Element ausschließen (Start und Ziel)
                .map(stop => ({
                    location: stop.location,
                    stopover: true
                }));
            
            // Routenoptionen
            const routeRequest = {
                origin: optimizedRoute.stops[0].location,
                destination: optimizedRoute.stops[optimizedRoute.stops.length - 1].location,
                waypoints: waypoints,
                optimizeWaypoints: false, // Bereits optimiert
                travelMode: google.maps.TravelMode.DRIVING
            };
            
            // Route auf der Karte anzeigen
            directionsService.route(routeRequest, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    directionsRenderer.setDirections(result);
                    
                    // Marker für Start, Ziel und Zwischenstopps hinzufügen
                    this.addMarkersToMap(optimizedRoute.stops);
                    
                    // Karte an die Route anpassen
                    const bounds = new google.maps.LatLngBounds();
                    optimizedRoute.stops.forEach(stop => {
                        bounds.extend(stop.location);
                    });
                    map.fitBounds(bounds);
                } else {
                    UIController.showError(`Fehler beim Anzeigen der Route: ${status}`);
                }
            });
            
            // Speichere die aktuelle optimierte Route global für den Export und das Speichern
            window.currentOptimizedRoute = optimizedRoute;
        },
        
        addMarkersToMap: function(stops) {
            stops.forEach((stop, index) => {
                let icon;
                let label = '';
                
                // Spezielle Icons für Start, Ziel und nummerierte Zwischenstopps
                if (index === 0) {
                    // Start-Icon (grüner Marker)
                    icon = {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: "#4CAF50",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#fff"
                    };
                    label = 'S';
                } else if (index === stops.length - 1) {
                    // Ziel-Icon (roter Marker)
                    icon = {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: "#F44336",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#fff"
                    };
                    label = 'Z';
                } else {
                    // Nummerierter Marker für Zwischenstopps (statt externer Chart-API)
                    icon = {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: "#3498db",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#fff"
                    };
                    label = index.toString(); // Nummer des Zwischenstopps als Label
                }
                
                // Marker mit deutlicher Beschriftung erstellen
                const markerOptions = {
                    position: stop.location,
                    map: map,
                    title: stop.address,
                    icon: icon,
                    animation: google.maps.Animation.DROP,
                    label: {
                        text: label,
                        color: "#ffffff",
                        fontWeight: "bold",
                        fontSize: "14px"
                    },
                    zIndex: index === 0 || index === stops.length - 1 ? 100 : 10 // Start und Ziel höher stapeln
                };
                
                const marker = new google.maps.Marker(markerOptions);
                markers.push(marker);
                
                // Info-Fenster mit Details hinzufügen
                const infoContent = index === 0 ? 'Start' : 
                                    index === stops.length - 1 ? 'Ziel' : 
                                    `Zwischenstopp ${index}`;
                
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div class="info-window">
                              <strong>${infoContent}</strong>
                              <p>${stop.address}</p>
                              </div>`
                });
                
                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });
            });
        },
        
        centerMapOnAddress: function(address) {
            const geocoder = new google.maps.Geocoder();
            
            geocoder.geocode({ address }, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK) {
                    map.setCenter(results[0].geometry.location);
                    map.setZoom(13);
                }
            });
        }
    };
})();