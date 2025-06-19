// ui-controller.js - User interface and interaction management

const UIController = (() => {
    let waypointCounter = 0;
    const waypointsContainer = document.getElementById('waypoints-container');
    const addWaypointButton = document.getElementById('add-waypoint');
    const resultsSection = document.getElementById('results');
    const contactAddressNameMap = new Map();
    
    // Utility: Create DOM element with classes and attributes
    const createElement = (tag, options = {}) => {
        const el = document.createElement(tag);
        if (options.className) el.className = options.className;
        if (options.attrs) Object.entries(options.attrs).forEach(([k, v]) => el.setAttribute(k, v));
        if (options.text) el.textContent = options.text;
        return el;
    };

    // Waypoint element
    const createWaypointElement = id => {
        const div = createElement('div', { className: 'waypoint-item' });
        const addressInput = createElement('div', { className: 'address-input' });
        const label = createElement('label', { attrs: { for: `waypoint-${id}` }, text: `Waypoint ${id}:` });
        const input = createElement('input', {
            className: 'waypoint address-autocomplete',
            attrs: { type: 'text', id: `waypoint-${id}`, placeholder: 'Enter address' }
        });
        addressInput.append(label, input);
        const removeButton = createElement('button', {
            className: 'remove-waypoint',
            attrs: { type: 'button', 'data-id': id },
            text: '\u00d7'
        });
        removeButton.addEventListener('click', () => removeWaypoint(id));
        div.append(addressInput, removeButton);
        return div;
    };

    const removeWaypoint = id => {
        const el = document.getElementById(`waypoint-${id}`)?.closest('.waypoint-item');
        if (el) el.remove();
    };

    // Autocomplete for address fields (Google + contacts)
    const setupCombinedAutocomplete = input => {
        let dropdown, placesService, sessionToken;
        const removeDropdown = () => { dropdown?.remove(); dropdown = null; };
        const showDropdown = suggestions => {
            removeDropdown();
            if (!suggestions.length) return;
            dropdown = createElement('div', { className: 'custom-autocomplete-dropdown' });
            Object.assign(dropdown.style, {
                position: 'absolute', background: '#fff', border: '1px solid #ccc', zIndex: 10000,
                width: input.offsetWidth + 'px', maxHeight: '220px', overflowY: 'auto',
                left: input.getBoundingClientRect().left + window.scrollX + 'px',
                top: input.getBoundingClientRect().bottom + window.scrollY + 'px'
            });
            suggestions.forEach(s => {
                const item = createElement('div', { className: 'autocomplete-item' });
                Object.assign(item.style, { padding: '0.5em 1em', cursor: 'pointer' });
                item.innerHTML = s.type === 'contact'
                    ? `<span style="color:#2980b9;font-weight:bold;">${s.label}</span> <span style="background:#eaf6ff;color:#2980b9;font-size:0.85em;padding:2px 6px;border-radius:6px;margin-left:8px;">Contact</span>`
                    : s.label;
                item.addEventListener('mousedown', e => {
                    e.preventDefault();
                    input.value = s.value;
                    s.type === 'contact' ? input.setAttribute('data-contact', '1') : input.removeAttribute('data-contact');
                    removeDropdown();
                    input.dispatchEvent(new Event('change'));
                });
                dropdown.appendChild(item);
            });
            document.body.appendChild(dropdown);
        };
        const updateSuggestions = async () => {
            const val = input.value.trim();
            if (!val) return removeDropdown();
            let contactSuggestions = [];
            if (UIController._contacts?.length)
                contactSuggestions = UIController._contacts.filter(c => c.name.toLowerCase().includes(val.toLowerCase()))
                    .map(c => ({ type: 'contact', label: `${c.name} — ${c.address}`, value: c.address }));
            if (!placesService) placesService = new google.maps.places.AutocompleteService();
            if (!sessionToken) sessionToken = new google.maps.places.AutocompleteSessionToken();
            placesService.getPlacePredictions({ input: val, sessionToken }, (predictions, status) => {
                let placeSuggestions = [];
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions)
                    placeSuggestions = predictions.map(p => ({ type: 'place', label: p.description, value: p.description }));
                showDropdown([...contactSuggestions, ...placeSuggestions]);
            });
        };
        input.addEventListener('input', updateSuggestions);
        input.addEventListener('focus', updateSuggestions);
        input.addEventListener('blur', () => setTimeout(removeDropdown, 200));
        input.addEventListener('change', () => {
            const val = input.value.trim();
            const contactMatch = /^(.+)\s+—\s+(.+)$/.exec(val);
            contactMatch ? input.setAttribute('data-contact', '1') : input.removeAttribute('data-contact');
        });
    };
    
    // Öffentliche Methoden
    return {
        init: () => {
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
            document.getElementById('export-route').addEventListener('click', UIController.exportRoute);
            document.getElementById('save-route').addEventListener('click', UIController.saveRoute);
            document.getElementById('load-route').addEventListener('click', UIController.loadRoute);
            
            // Add Google Contacts login handler
            UIController.initGoogleContactsLogin();
        },
        collectAddresses: () => {
            const start = document.getElementById('start').value.trim();
            const end = document.getElementById('end').value.trim();
            const waypoints = Array.from(document.querySelectorAll('.waypoint')).map(w => w.value.trim()).filter(Boolean);
            return { start, waypoints, end };
        },
        setLoadingState: isLoading => {
            const btn = document.getElementById('calculate-route');
            btn.disabled = isLoading;
            btn.innerHTML = isLoading ? '<span class="loading-text">Calculating...</span>' : 'Optimize Route';
        },
        displayResults: optimizedRoute => {
            resultsSection.classList.remove('hidden');
            UIController.setResultsButtonsState(true);
            document.querySelector('#total-distance span').textContent = optimizedRoute.totalDistance;
            document.querySelector('#total-duration span').textContent = optimizedRoute.totalDuration;
            const stopsList = document.getElementById('optimized-stops');
            stopsList.innerHTML = '';
            optimizedRoute.stops.forEach((stop, i) => {
                const li = document.createElement('li');
                let stopText = contactAddressNameMap.has(stop.address)
                    ? `${contactAddressNameMap.get(stop.address)} — ${stop.address}`
                    : stop.address;
                li.textContent = i === 0 ? `Start: ${stopText}` : (i === optimizedRoute.stops.length - 1 ? `Destination: ${stopText}` : stopText);
                stopsList.appendChild(li);
            });
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        },
        showError: msg => alert(`Error: ${msg}`),
        exportRoute: () => {
            function extractAddress(val) {
                const m = /^(.+)\s+—\s+(.+)$/.exec(val);
                return m ? m[2].trim() : val.trim();
            }
            try {
                const stops = window.currentOptimizedRoute.stops;
                if (!stops || stops.length < 2) throw new Error('No valid route available for export');
                let url = 'https://www.google.com/maps/dir/?api=1';
                url += `&origin=${encodeURIComponent(extractAddress(stops[0].address))}`;
                url += `&destination=${encodeURIComponent(extractAddress(stops[stops.length - 1].address))}`;
                if (stops.length > 2) {
                    const waypoints = stops.slice(1, -1).map(s => extractAddress(s.address));
                    url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
                }
                window.open(url, '_blank');
            } catch (e) { UIController.showError('Route could not be exported: ' + e.message); }
        },
        saveRoute: () => {
            try {
                if (!window.currentOptimizedRoute) throw new Error('No route available to save');
                const routeName = prompt('Enter a name for this route:', 'My Route');
                if (!routeName) return;
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                savedRoutes.push({ name: routeName, date: new Date().toISOString(), route: window.currentOptimizedRoute });
                localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
                alert(`Route "${routeName}" has been saved successfully!`);
                UIController.setLoadRouteButtonState(true);
            } catch (e) { UIController.showError('Route could not be saved: ' + e.message); }
        },
        loadRoute: () => {
            const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
            if (!savedRoutes.length) {
                alert('No saved routes found.');
                UIController.setLoadRouteButtonState(false);
                return;
            }
            const names = savedRoutes.map((r, i) => `${i + 1}: ${r.name} (${new Date(r.date).toLocaleString()})`).join('\n');
            const idx = prompt(`Select route to load (number):\n${names}`);
            const routeIdx = parseInt(idx, 10) - 1;
            if (isNaN(routeIdx) || routeIdx < 0 || routeIdx >= savedRoutes.length) return;
            const route = savedRoutes[routeIdx].route;
            document.getElementById('start').value = route.stops[0].address;
            document.getElementById('end').value = route.stops[route.stops.length - 1].address;
            waypointsContainer.innerHTML = '';
            for (let i = 1; i < route.stops.length - 1; i++) {
                waypointCounter++;
                const waypointElement = createWaypointElement(waypointCounter);
                waypointsContainer.appendChild(waypointElement);
                const input = waypointElement.querySelector('.address-autocomplete');
                input.value = route.stops[i].address;
                setupCombinedAutocomplete(input);
            }
            UIController.setResultsButtonsState(true);
        },
        initGoogleContactsLogin: () => {
            const btn = document.getElementById('import-google-contacts');
            if (!btn) return;
            btn.addEventListener('click', async () => {
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
        _initGoogleGISAuth: () => {
            Config.load().then(() => {
                const clientId = Config.get('GOOGLE_CLIENT_ID');
                if (!clientId) return alert('Google Client ID not configured.');
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/contacts.readonly',
                    callback: response => {
                        if (response?.access_token) {
                            const btn = document.getElementById('import-google-contacts');
                            if (btn) {
                                btn.disabled = true;
                                btn.innerHTML = '<span style="color:#2980b9;font-size:1.2em;vertical-align:middle;margin-right:0.5em;">&#x2714;</span>Google Contacts loaded';
                                btn.style.background = '#eaf6ff';
                                btn.style.color = '#2980b9';
                                btn.style.border = '1px solid #2980b9';
                                btn.style.cursor = 'default';
                            }
                            UIController._contacts = [];
                            fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,addresses&pageSize=1000', {
                                headers: { 'Authorization': 'Bearer ' + response.access_token }
                            })
                            .then(res => res.json())
                            .then(data => {
                                UIController._processContactsData(data);
                                if (data.nextPageToken) UIController._fetchAllContacts(response.access_token, data.nextPageToken);
                            })
                            .catch(err => console.error('Error fetching contacts:', err));
                        } else {
                            alert('Google login failed.');
                        }
                    }
                });
                tokenClient.requestAccessToken();
            });
        },
        _fetchAllContacts: (accessToken, pageToken) => {
            fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,addresses&pageSize=1000&pageToken=' + pageToken, {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            })
            .then(res => res.json())
            .then(data => {
                UIController._processContactsData(data);
                if (data.nextPageToken) UIController._fetchAllContacts(accessToken, data.nextPageToken);
            })
            .catch(err => console.error('Error fetching paginated contacts:', err));
        },
        _processContactsData: data => {
            if (data.connections) {
                data.connections.forEach(person => {
                    const name = person.names?.[0]?.displayName;
                    if (name && person.addresses) {
                        person.addresses.forEach(addr => {
                            const address = addr.formattedValue || addr.streetAddress || null;
                            if (address) UIController._contacts.push({ name, address });
                        });
                    }
                });
            }
            if (UIController._contacts) {
                for (const c of UIController._contacts) {
                    if (c.address && c.name) contactAddressNameMap.set(c.address, c.name);
                }
            }
            normalizeAllContactAddresses();
        },
        setResultsButtonsState: enabled => {
            document.getElementById('export-route').disabled = !enabled;
            document.getElementById('save-route').disabled = !enabled;
        },
        setLoadRouteButtonState: enabled => {
            document.getElementById('load-route').disabled = !enabled;
        }
    };
})();

// Silent Auth: Check on load if user is still logged in
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
                        // Show logged-in status
                        const btn = document.getElementById('import-google-contacts');
                        if (btn) {
                            btn.disabled = true;
                            btn.innerHTML = '<span style="color:#2980b9;font-size:1.2em;vertical-align:middle;margin-right:0.5em;">&#x2714;</span>Google Contacts loaded';
                            btn.style.background = '#eaf6ff';
                            btn.style.color = '#2980b9';
                            btn.style.border = '1px solid #2980b9';
                            btn.style.cursor = 'default';
                        }
                        // Load contacts
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

// Helper function: Automatically format addresses from contacts
async function normalizeAllContactAddresses() {
    if (!UIController._contacts || UIController._contacts.length === 0) return;
    for (let c of UIController._contacts) {
        if (c.address) {
            try {
                c.address = await APIService.geocodeAddress(c.address);
            } catch (e) {
                // Ignore error, original address remains
            }
        }
    }
}

// Map from address to contact name for display
// Hook: After loading contacts, update map
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