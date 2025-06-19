// ui-controller.js - User interface and interaction management

const UIController = (() => {
    // Private Variablen
    let waypointCounter = 0;
    
    // DOM-Elemente
    const waypointsContainer = document.getElementById('waypoints-container');
    const addWaypointButton = document.getElementById('add-waypoint');
    const resultsSection = document.getElementById('results');
    
    // Private Methoden
    const createWaypointElement = (id) => {
        const div = document.createElement('div');
        div.className = 'waypoint-item';
        
        const addressInput = document.createElement('div');
        addressInput.className = 'address-input';
          const label = document.createElement('label');
        label.setAttribute('for', `waypoint-${id}`);
        label.textContent = `Waypoint ${id}:`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `waypoint-${id}`;
        input.className = 'waypoint address-autocomplete';
        input.placeholder = 'Enter address';
        
        addressInput.appendChild(label);
        addressInput.appendChild(input);
        
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-waypoint';
        removeButton.setAttribute('data-id', id);
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            removeWaypoint(id);
        });
        
        div.appendChild(addressInput);
        div.appendChild(removeButton);
        
        return div;
    };
    
    const removeWaypoint = (id) => {
        const element = document.getElementById(`waypoint-${id}`).closest('.waypoint-item');
        element.remove();
    };
    
    const setupAutocomplete = (input) => {
        const autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.setFields(['formatted_address', 'geometry', 'place_id']);
        return autocomplete;
    };

    const setupCombinedAutocomplete = (input) => {
        let dropdown;
        let placesService;
        let sessionToken;

        function removeDropdown() {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
        }

        function showDropdown(suggestions) {
            removeDropdown();
            if (!suggestions.length) return;
            dropdown = document.createElement('div');
            dropdown.className = 'custom-autocomplete-dropdown';
            dropdown.style.position = 'absolute';
            dropdown.style.background = '#fff';
            dropdown.style.border = '1px solid #ccc';
            dropdown.style.zIndex = '10000';
            dropdown.style.width = input.offsetWidth + 'px';
            dropdown.style.maxHeight = '220px';
            dropdown.style.overflowY = 'auto';
            dropdown.style.left = input.getBoundingClientRect().left + window.scrollX + 'px';
            dropdown.style.top = input.getBoundingClientRect().bottom + window.scrollY + 'px';

            suggestions.forEach(s => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.style.padding = '0.5em 1em';
                item.style.cursor = 'pointer';
                if (s.type === 'contact') {
                    item.innerHTML = `<span style="color:#2980b9;font-weight:bold;">${s.label}</span> <span style="background:#eaf6ff;color:#2980b9;font-size:0.85em;padding:2px 6px;border-radius:6px;margin-left:8px;">Kontakt</span>`;
                } else {
                    item.textContent = s.label;
                }
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    if (s.type === 'contact') {
                        input.value = `${s.label}`; // Name und Adresse eintragen
                        input.setAttribute('data-contact', '1');
                    } else if (s.type === 'place') {
                        input.value = s.value;
                        input.removeAttribute('data-contact');
                    }
                    removeDropdown();
                    input.dispatchEvent(new Event('change'));
                });
                dropdown.appendChild(item);
            });
            document.body.appendChild(dropdown);
        }

        async function updateSuggestions() {
            const val = input.value.trim();
            if (!val) {
                removeDropdown();
                return;
            }
            // Kontakte filtern
            let contactSuggestions = [];
            if (UIController._contacts && UIController._contacts.length > 0) {
                contactSuggestions = UIController._contacts
                    .filter(c => c.name.toLowerCase().includes(val.toLowerCase()))
                    .map(c => ({
                        type: 'contact',
                        label: `${c.name} — ${c.address}`,
                        value: c.address
                    }));
            }
            // Google Places Vorschläge holen
            if (!placesService) {
                // Dummy-Map für PlacesService (wird nicht angezeigt)
                const dummyMap = document.createElement('div');
                placesService = new google.maps.places.AutocompleteService();
            }
            if (!sessionToken) {
                sessionToken = new google.maps.places.AutocompleteSessionToken();
            }
            placesService.getPlacePredictions({
                input: val,
                sessionToken: sessionToken
            }, (predictions, status) => {
                let placeSuggestions = [];
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                    placeSuggestions = predictions.map(p => ({
                        type: 'place',
                        label: p.description,
                        value: p.description
                    }));
                }
                // Kombinieren: Kontakte zuerst, dann Google
                showDropdown([...contactSuggestions, ...placeSuggestions]);
            });
        }

        // Event-Listener
        input.addEventListener('input', updateSuggestions);
        input.addEventListener('focus', updateSuggestions);
        input.addEventListener('blur', () => setTimeout(removeDropdown, 200));
        // Wenn Wert exakt Kontaktname, Adresse einfügen
        input.addEventListener('change', function() {
            const val = input.value.trim();
            // Prüfe, ob das Feld im Kontakt-Format ist (Name — Adresse)
            const contactMatch = /^(.+)\s+—\s+(.+)$/.exec(val);
            if (contactMatch) {
                input.value = val; // Name und Adresse stehen schon drin
                input.setAttribute('data-contact', '1');
            } else {
                // Fallback: Nur Adresse anzeigen, data-Attribut entfernen
                input.removeAttribute('data-contact');
            }
        });
    };
    
    // Öffentliche Methoden
    return {
        init: function() {
            // Event Listener for "Add Waypoint" button
            addWaypointButton.addEventListener('click', () => {
                waypointCounter++;
                const waypointElement = createWaypointElement(waypointCounter);
                waypointsContainer.appendChild(waypointElement);
                
                // Initialize combined autocomplete for new input field
                const input = waypointElement.querySelector('.address-autocomplete');
                setupCombinedAutocomplete(input);
            });
            
            // Add combined autocomplete to all address fields
            const addressFields = document.querySelectorAll('.address-autocomplete');
            addressFields.forEach(field => {
                setupCombinedAutocomplete(field);
            });
            
            // Event listeners for export and save buttons
            document.getElementById('export-route').addEventListener('click', this.exportRoute);
            document.getElementById('save-route').addEventListener('click', this.saveRoute);
            document.getElementById('load-route').addEventListener('click', this.loadRoute);
            
            // Add Google Contacts login handler
            this.initGoogleContactsLogin();
        },
          collectAddresses: function() {
            const startInput = document.getElementById('start');
            const endInput = document.getElementById('end');
            const startAddress = startInput.value.trim();
            const endAddress = endInput.value.trim();
            // Collect all waypoints
            const waypointAddresses = [];
            document.querySelectorAll('.waypoint').forEach(waypoint => {
                const address = waypoint.value.trim();
                if (address) {
                    waypointAddresses.push(address);
                }
            });
            return {
                start: startAddress,
                waypoints: waypointAddresses,
                end: endAddress
            };
        },
          setLoadingState: function(isLoading) {
            const calculateButton = document.getElementById('calculate-route');
            
            if (isLoading) {
                calculateButton.disabled = true;
                calculateButton.innerHTML = '<span class="loading-text">Calculating...</span>';
            } else {
                calculateButton.disabled = false;
                calculateButton.textContent = 'Optimize Route';
            }
        },
          displayResults: function(optimizedRoute) {
            // Show results section
            resultsSection.classList.remove('hidden');
            // Buttons aktivieren
            UIController.setResultsButtonsState(true);

            // Display total distance and duration
            document.querySelector('#total-distance span').textContent = optimizedRoute.totalDistance;
            document.querySelector('#total-duration span').textContent = optimizedRoute.totalDuration;

            // Display optimized list of stops
            const stopsListElement = document.getElementById('optimized-stops');
            stopsListElement.innerHTML = '';

            optimizedRoute.stops.forEach((stop, index) => {
                const li = document.createElement('li');
                let stopText = stop.address;
                // Kontaktname anzeigen, falls vorhanden
                if (contactAddressNameMap.has(stop.address)) {
                    stopText = `${contactAddressNameMap.get(stop.address)} — ${stop.address}`;
                }
                if (index === 0) {
                    stopText = `Start: ${stopText}`;
                } else if (index === optimizedRoute.stops.length - 1) {
                    stopText = `Destination: ${stopText}`;
                }
                li.textContent = stopText;
                stopsListElement.appendChild(li);
            });

            // Scroll to results section
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        },
          showError: function(message) {
            alert(`Error: ${message}`);
        },
        
        exportRoute: function() {
            // Create Google Maps URL with optimized route
            function extractAddress(val) {
                const contactMatch = /^(.+)\s+—\s+(.+)$/.exec(val);
                if (contactMatch) {
                    return contactMatch[2].trim();
                }
                return val.trim();
            }
            try {
                const stops = window.currentOptimizedRoute.stops;
                if (!stops || stops.length < 2) {
                    throw new Error('No valid route available for export');
                }
                let url = 'https://www.google.com/maps/dir/?api=1';
                // Starting point
                url += `&origin=${encodeURIComponent(extractAddress(stops[0].address))}`;
                // Destination
                url += `&destination=${encodeURIComponent(extractAddress(stops[stops.length - 1].address))}`;
                // Waypoints
                if (stops.length > 2) {
                    const waypoints = stops.slice(1, -1).map(stop => extractAddress(stop.address));
                    url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
                }
                // Open in new tab
                window.open(url, '_blank');
            } catch (error) {
                UIController.showError('Route could not be exported: ' + error.message);
            }
        },
          saveRoute: function() {
            try {
                if (!window.currentOptimizedRoute) {
                    throw new Error('No route available to save');
                }
                const routeName = prompt('Enter a name for this route:', 'My Route');
                if (!routeName) return; // User cancelled
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                savedRoutes.push({
                    name: routeName,
                    date: new Date().toISOString(),
                    route: window.currentOptimizedRoute
                });
                localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
                alert(`Route "${routeName}" has been saved successfully!`);
                // Nach dem Speichern: Load-Button aktivieren
                UIController.setLoadRouteButtonState(true);
            } catch (error) {
                UIController.showError('Route could not be saved: ' + error.message);
            }
        },
        loadRoute: function() {
            const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
            if (!savedRoutes.length) {
                alert('No saved routes found.');
                UIController.setLoadRouteButtonState(false);
                return;
            }
            // Einfache Auswahl: Prompt mit Namen der gespeicherten Routen
            const names = savedRoutes.map((r, i) => `${i + 1}: ${r.name} (${new Date(r.date).toLocaleString()})`).join('\n');
            const idx = prompt(`Select route to load (number):\n${names}`);
            const routeIdx = parseInt(idx, 10) - 1;
            if (isNaN(routeIdx) || routeIdx < 0 || routeIdx >= savedRoutes.length) return;
            const route = savedRoutes[routeIdx].route;
            // Felder befüllen
            document.getElementById('start').value = route.stops[0].address;
            document.getElementById('end').value = route.stops[route.stops.length - 1].address;
            // Wegpunkte
            const waypointsContainer = document.getElementById('waypoints-container');
            waypointsContainer.innerHTML = '';
            for (let i = 1; i < route.stops.length - 1; i++) {
                waypointCounter++;
                const waypointElement = createWaypointElement(waypointCounter);
                waypointsContainer.appendChild(waypointElement);
                const input = waypointElement.querySelector('.address-autocomplete');
                input.value = route.stops[i].address;
                setupCombinedAutocomplete(input);
            }
            // Nach dem Laden: Buttons aktivieren
            UIController.setResultsButtonsState(true);
        },
        // Add Google Contacts login handler using Google Identity Services (GIS)
        initGoogleContactsLogin: function() {
            const btn = document.getElementById('import-google-contacts');
            if (!btn) return;
            btn.addEventListener('click', async () => {
                // Load GIS library if not already loaded
                if (!window.google || !window.accounts) {
                    const script = document.createElement('script');
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.onload = () => UIController._initGoogleGISAuth();
                    document.head.appendChild(script);
                } else {
                    UIController._initGoogleGISAuth();
                }
            });
        },
        // Internal: Initialize GIS Auth and prompt login
        _initGoogleGISAuth: function() {
            Config.load().then(() => {
                const clientId = Config.get('GOOGLE_CLIENT_ID');
                if (!clientId) {
                    alert('Google Client ID not configured.');
                    return;
                }
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/contacts.readonly',
                    callback: (response) => {
                        if (response && response.access_token) {
                            // Statt alert: Button ersetzen durch Login-Bestätigung
                            const btn = document.getElementById('import-google-contacts');
                            if (btn) {
                                btn.disabled = true;
                                btn.innerHTML = '<span style="color:#2980b9;font-size:1.2em;vertical-align:middle;margin-right:0.5em;">&#x2714;</span>Google Contacts loaded';
                                btn.style.background = '#eaf6ff';
                                btn.style.color = '#2980b9';
                                btn.style.border = '1px solid #2980b9';
                                btn.style.cursor = 'default';
                            }
                            // Fetch all contacts and store for UI
                            UIController._contacts = [];
                            fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,addresses&pageSize=1000', {
                                headers: {
                                    'Authorization': 'Bearer ' + response.access_token
                                }
                            })
                            .then(res => res.json())
                            .then(data => {
                                UIController._processContactsData(data);
                                if (data.nextPageToken) {
                                    UIController._fetchAllContacts(response.access_token, data.nextPageToken);
                                } 
                            })
                            .catch(err => {
                                console.error('Error fetching contacts:', err);
                            });
                        } else {
                            alert('Google login failed.');
                        }
                    }
                });
                tokenClient.requestAccessToken();
            });
        },
        _fetchAllContacts: function(accessToken, pageToken) {
            fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,addresses&pageSize=1000&pageToken=' + pageToken, {
                headers: {
                    'Authorization': 'Bearer ' + accessToken
                }
            })
            .then(res => res.json())
            .then(data => {
                UIController._processContactsData(data);
                if (data.nextPageToken) {
                    UIController._fetchAllContacts(accessToken, data.nextPageToken);
                } 
            })
            .catch(err => {
                console.error('Error fetching paginated contacts:', err);
            });
        },
        _processContactsData: function(data) {
            if (data.connections) {
                data.connections.forEach(person => {
                    const name = person.names && person.names.length > 0 ? person.names[0].displayName : null;
                    if (name && person.addresses) {
                        person.addresses.forEach(addr => {
                            const address = addr.formattedValue || addr.streetAddress || null;
                            if (address) {
                                UIController._contacts.push({ name, address });
                            }
                        });
                    }
                });
            }
        },
        setResultsButtonsState: function(enabled) {
            document.getElementById('export-route').disabled = !enabled;
            document.getElementById('save-route').disabled = !enabled;
        },
        setLoadRouteButtonState: function(enabled) {
            document.getElementById('load-route').disabled = !enabled;
        }
    };
})();

// Silent Auth: Prüfe beim Laden, ob Nutzer noch eingeloggt ist
document.addEventListener('DOMContentLoaded', function() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        Config.load().then(() => {
            const clientId = Config.get('GOOGLE_CLIENT_ID');
            if (!clientId) return;
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/contacts.readonly',
                prompt: 'none', // Silent
                callback: (response) => {
                    if (response && response.access_token) {
                        // Zeige eingeloggten Status
                        const btn = document.getElementById('import-google-contacts');
                        if (btn) {
                            btn.disabled = true;
                            btn.innerHTML = '<span style="color:#2980b9;font-size:1.2em;vertical-align:middle;margin-right:0.5em;">&#x2714;</span>Google Contacts loaded';
                            btn.style.background = '#eaf6ff';
                            btn.style.color = '#2980b9';
                            btn.style.border = '1px solid #2980b9';
                            btn.style.cursor = 'default';
                        }
                        // Kontakte laden
                        UIController._contacts = [];
                        fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,addresses&pageSize=1000', {
                            headers: {
                                'Authorization': 'Bearer ' + response.access_token
                            }
                        })
                        .then(res => res.json())
                        .then(data => {
                            UIController._processContactsData(data);
                            if (data.nextPageToken) {
                                UIController._fetchAllContacts(response.access_token, data.nextPageToken);
                            }
                        })
                        .catch(err => {
                            console.error('Error fetching contacts:', err);
                        });
                    }
                }
            });
            tokenClient.requestAccessToken();
        });
    }
});

// Hilfsfunktion: Adressen aus Kontakten automatisch formatieren
async function normalizeAllContactAddresses() {
    if (!UIController._contacts || UIController._contacts.length === 0) return;
    for (let c of UIController._contacts) {
        if (c.address) {
            try {
                c.address = await APIService.geocodeAddress(c.address);
            } catch (e) {
                // Fehler ignorieren, Originaladresse bleibt
            }
        }
    }
}

// Mappe von Adresse zu Kontaktname für Anzeige
const contactAddressNameMap = new Map();
// Hook: Nach dem Laden der Kontakte Map aktualisieren
const origProcessContactsData = UIController._processContactsData;
UIController._processContactsData = function(data) {
    origProcessContactsData.call(UIController, data);
    if (UIController._contacts) {
        for (const c of UIController._contacts) {
            if (c.address && c.name) {
                contactAddressNameMap.set(c.address, c.name);
            }
        }
    }
    normalizeAllContactAddresses();
};