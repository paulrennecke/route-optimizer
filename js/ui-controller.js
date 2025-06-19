// ui-controller.js - User interface and interaction management

const UIController = (() => {
    let waypointCounter = 0;
    const waypointsContainer = document.getElementById('waypoints-container');
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

    const renderWaypoints = () => {
        waypointsContainer.innerHTML = '';
        const allWaypoints = Array.from(document.querySelectorAll('.waypoint'));
        allWaypoints.forEach((input, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'waypoint-inline';
            const number = document.createElement('span');
            number.className = 'waypoint-number';
            number.textContent = (idx + 1) + '.';
            wrapper.appendChild(number);
            wrapper.appendChild(input);
            waypointsContainer.appendChild(wrapper);
        });
    };

    const createWaypointElement = id => {
        const wrapper = createElement('div', { className: 'waypoint-inline address-input' });
        const number = createElement('span', { className: 'waypoint-number', text: id + '.' });
        const input = createElement('input', {
            className: 'waypoint address-autocomplete',
            attrs: { type: 'text', id: `waypoint-${id}`, placeholder: 'Enter waypoint address' }
        });
        const removeButton = createElement('button', {
            className: 'remove-waypoint',
            attrs: { type: 'button', 'data-id': id, tabindex: '-1' },
            text: '\u00d7'
        });
        removeButton.addEventListener('click', () => {
            wrapper.remove();
            ensureEmptyWaypointAtEnd();
        });
        wrapper.appendChild(number);
        wrapper.appendChild(input);
        wrapper.appendChild(removeButton);
        return wrapper;
    };

    const updateWaypointNumbers = () => {
        const wrappers = waypointsContainer.querySelectorAll('.waypoint-inline');
        wrappers.forEach((w, idx) => {
            const num = w.querySelector('.waypoint-number');
            if (num) num.textContent = (idx + 1) + '.';
        });
    };

    const removeWaypoint = id => {
        const el = document.getElementById(`waypoint-${id}`)?.closest('.waypoint-item');
        if (el) el.remove();
    };

    // Autocomplete for address fields (Google + contacts)
    const setupCombinedAutocomplete = input => {
        let dropdown, placesService, sessionToken;
        const removeDropdown = () => { dropdown?.remove(); dropdown = null; };
        let selectedIndex = -1;
        let currentSuggestions = [];
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
            currentSuggestions = suggestions;
            // Select the first suggestion by default
            selectedIndex = 0;
            suggestions.forEach((s, idx) => {
                const item = createElement('div', { className: 'autocomplete-item' });
                Object.assign(item.style, { padding: '0.5em 1em', cursor: 'pointer' });
                item.innerHTML = s.type === 'contact'
                    ? `<span style="color:#2980b9;font-weight:bold;">${s.label}</span> <span style="background:#eaf6ff;color:#2980b9;font-size:0.85em;padding:2px 6px;border-radius:6px;margin-left:8px;">Contact</span>`
                    : s.label;
                if (idx === 0) item.classList.add('selected');
                item.addEventListener('mousedown', e => {
                    e.preventDefault();
                    selectSuggestion(idx);
                });
                dropdown.appendChild(item);
            });
            document.body.appendChild(dropdown);
        };
        function selectSuggestion(idx) {
            const s = currentSuggestions[idx];
            if (!s) return;
            if (s.type === 'contact') {
                input.value = `${s.label}`;
                input.setAttribute('data-contact', '1');
            } else if (s.type === 'place') {
                input.value = s.value;
                input.removeAttribute('data-contact');
            }
            removeDropdown();
            input.dispatchEvent(new Event('change'));
            // Move to next input field
            const focusable = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.tabIndex >= 0);
            const idxInput = focusable.indexOf(input);
            if (idxInput !== -1 && idxInput + 1 < focusable.length) {
                focusable[idxInput + 1].focus();
            }
        }
        input.addEventListener('keydown', function(e) {
            if (!dropdown) return;
            const items = dropdown.querySelectorAll('.autocomplete-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                items.forEach((el, i) => el.classList.toggle('selected', i === selectedIndex));
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                items.forEach((el, i) => el.classList.toggle('selected', i === selectedIndex));
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                if (selectedIndex >= 0) {
                    e.preventDefault();
                    selectSuggestion(selectedIndex);
                }
            } else {
                // On any other key, after suggestions update, re-apply selected class
                setTimeout(() => {
                    const items = dropdown?.querySelectorAll('.autocomplete-item');
                    if (items && items.length > 0) {
                        items.forEach((el, i) => el.classList.toggle('selected', i === selectedIndex));
                    }
                }, 0);
            }
        });
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
        input.addEventListener('focus', event => {
            updateSuggestions();
            // Mobile scroll-into-view optimization (faster)
            if (window.innerWidth <= 800) {
                // Use requestAnimationFrame for faster response, no delay
                requestAnimationFrame(() => {
                    const rect = input.getBoundingClientRect();
                    const scrollY = window.scrollY + rect.top - 40; // smaller offset for dropdown
                    window.scrollTo({ top: scrollY, behavior: 'auto' }); // instant scroll
                });
            }
        });
        input.addEventListener('blur', () => setTimeout(removeDropdown, 200));
        input.addEventListener('change', () => {
            const val = input.value.trim();
            // Check if the field is in contact format (Name — Address)
            const contactMatch = /^(.+)\s+—\s+(.+)$/.exec(val);
            if (contactMatch) {
                input.value = val; // Name and address already present
                input.setAttribute('data-contact', '1');
            } else {
                // Fallback: Only show address, remove data attribute
                input.removeAttribute('data-contact');
            }
        });
    };
    
    function ensureEmptyWaypointAtEnd() {
        const wrappers = Array.from(waypointsContainer.querySelectorAll('.waypoint-inline'));
        for (let i = wrappers.length - 1; i > 0; i--) {
            const input = wrappers[i].querySelector('input.waypoint');
            if (input && !input.value.trim()) {
                wrappers[i].remove();
            } else {
                break;
            }
        }
        const last = waypointsContainer.querySelector('.waypoint-inline:last-child input.waypoint');
        if (!last || last.value.trim()) {
            waypointCounter++;
            const wrapper = createWaypointElement(waypointCounter);
            waypointsContainer.appendChild(wrapper);
            const input = wrapper.querySelector('input.waypoint');
            setupCombinedAutocomplete(input);
            input.addEventListener('input', ensureEmptyWaypointAtEnd);
            input.addEventListener('keydown', function(e) {
                if ((e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey) {
                    const allInputs = waypointsContainer.querySelectorAll('input.waypoint');
                    if (allInputs[allInputs.length - 1] === input && input.value.trim()) {
                        e.preventDefault();
                        ensureEmptyWaypointAtEnd();
                    }
                }
            });
        }
        updateWaypointNumbers();
    }

    // Public methods
    return {
        init: () => {
            // Focus start location input on page load (after DOM is ready)
            setTimeout(() => {
                const startInput = document.getElementById('start');
                const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (startInput && !isMobile) startInput.focus();
            }, 0);

            // Initial ein leeres Waypoint-Feld
            ensureEmptyWaypointAtEnd();

            // Add combined autocomplete to all address fields (including start and end)
            const addressFields = document.querySelectorAll('.address-autocomplete');
            addressFields.forEach(field => {
                setupCombinedAutocomplete(field);
            });
            // Event listeners für export, save und load
            document.getElementById('export-route').addEventListener('click', this.exportRoute);
            document.getElementById('save-route').addEventListener('click', () => UIController.saveRoute());
            document.getElementById('load-route').addEventListener('click', () => UIController.loadRoute());
            UIController.setResultsButtonsState(false);
            UIController.setLoadRouteButtonState(localStorage.getItem('savedRoutes') && JSON.parse(localStorage.getItem('savedRoutes')).length > 0);
            UIController.initGoogleContactsLogin();
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
        setLoadingState: isLoading => {
            const btn = document.getElementById('calculate-route');
            btn.disabled = isLoading;
            btn.innerHTML = isLoading ? '<span class="loading-text">Calculating...</span>' : 'Optimize Route';
        },
        displayResults: optimizedRoute => {
            resultsSection.classList.remove('hidden');
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
          showRouteModal: function(html) {
            const modal = document.getElementById('route-modal');
            const body = document.getElementById('route-modal-body');
            body.innerHTML = html;
            modal.style.display = 'flex';
            document.getElementById('route-modal-close').onclick = () => { modal.style.display = 'none'; };
        },
        loadRoute: function() {
            const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
            if (!savedRoutes.length) {
                this.showRouteModal('<div style="padding:1em 0; color:#888;">No saved routes found.</div>');
                return;
            }
            let html = `
                <h3 class="modal-title">Select a saved route</h3>
                <div class="modal-route-list">
            `;
            savedRoutes.forEach((r, i) => {
                const date = new Date(r.date);
                const dateString = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
                    ' – ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                html += `
                <div class="modal-route-entry">
                    <div class="modal-route-info">
                        <div class="modal-route-name">${r.name}</div>
                        <div class="modal-route-date">${dateString}</div>
                    </div>
                    <div class="modal-route-actions">
                        <button class="btn modal-btn modal-btn-delete" title="Delete route" data-delidx="${i}"><span style="font-size:1.1em; vertical-align:middle;">🗑️</span></button>
                        <button class="btn modal-btn modal-btn-load" data-idx="${i}"><span style="font-size:1.1em; vertical-align:middle;">📂</span></button>
                    </div>
                </div>
                `;
            });
            html += '</div>';
            this.showRouteModal(html);
            document.querySelectorAll('#route-modal-body button[data-idx]').forEach(btn => {
                btn.onclick = async () => {
                    const idx = parseInt(btn.getAttribute('data-idx'), 10);
                    const entry = savedRoutes[idx];
                    // Support both 'addresses' and 'route.addresses' for backward compatibility
                    const addresses = entry.addresses || (entry.route && entry.route.addresses);
                    if (!addresses) {
                        UIController.showError('This route is in an old or invalid format and cannot be loaded. Please save it again.');
                        return;
                    }
                    document.getElementById('start').value = addresses.start;
                    document.getElementById('end').value = addresses.end;
                    const waypointsContainer = document.getElementById('waypoints-container');
                    waypointsContainer.innerHTML = '';
                    waypointCounter = 0;
                    for (let i = 0; i < addresses.waypoints.length; i++) {
                        waypointCounter++;
                        const waypointElement = createWaypointElement(waypointCounter);
                        waypointsContainer.appendChild(waypointElement);
                        const input = waypointElement.querySelector('.address-autocomplete');
                        input.value = addresses.waypoints[i];
                        setupCombinedAutocomplete(input);
                    }
                    document.getElementById('route-modal').style.display = 'none';
                    UIController.setResultsButtonsState(true);
                    if (window.optimizeRouteFromUI) {
                        window.optimizeRouteFromUI();
                    }
                };
            });
            document.querySelectorAll('#route-modal-body button[data-delidx]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.getAttribute('data-delidx'), 10);
                    if (!confirm('Delete this route?')) return;
                    savedRoutes.splice(idx, 1);
                    localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
                    UIController.loadRoute();
                };
            });
        },
        saveRoute: function() {
            try {
                if (!window.currentOptimizedRoute) {
                    throw new Error('No route available to save');
                }
                let html = `<h3 class="modal-title">Save current route</h3>
                    <form id="route-save-form" class="modal-form">
                        <label for="route-name-input" class="modal-label">Route name:</label>
                        <input id="route-name-input" type="text" class="modal-input">
                        <button id="route-name-save-btn" class="btn modal-btn"><span style="vertical-align:middle;">💾</span> Save</button>
                    </form>`;
                this.showRouteModal(html);
                document.getElementById('route-name-input').focus();
                // Save sowohl auf Button als auch auf Form-Submit binden
                const saveHandler = (e) => {
                    e.preventDefault();
                    const routeName = document.getElementById('route-name-input').value.trim();
                    if (!routeName) {
                        document.getElementById('route-name-input').focus();
                        return;
                    }
                    const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                    // Nur das neue Format speichern
                    const addresses = {
                        start: document.getElementById('start').value.trim(),
                        end: document.getElementById('end').value.trim(),
                        waypoints: Array.from(document.querySelectorAll('.waypoint')).map(wp => wp.value.trim()).filter(Boolean)
                    };
                    savedRoutes.push({
                        name: routeName,
                        date: new Date().toISOString(),
                        addresses
                    });
                    localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
                    document.getElementById('route-modal').style.display = 'none';
                    UIController.setLoadRouteButtonState(true);
                };
                document.getElementById('route-save-form').onsubmit = saveHandler;
                document.getElementById('route-name-save-btn').onclick = saveHandler;
            } catch (error) {
                UIController.showError('Route could not be saved: ' + error.message);
            }
        },
        // Add Google Contacts login handler using Google Identity Services (GIS)
        initGoogleContactsLogin: function() {
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

// Silent Auth: Check on load if user is still logged in
document.addEventListener('DOMContentLoaded', function() {
    if (window.google && window.accounts && window.google.accounts.oauth2) {
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

// Map from address to contact name for display
const contactAddressNameMap = new Map();
// Hook: After loading contacts, update the map
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

window.optimizeRouteFromUI = async function() {
    try {
        UIController.setLoadingState(true);
        const addresses = UIController.collectAddresses();
        if (!addresses.start || !addresses.end) {
            throw new Error('Start and destination must be specified.');
        }
        const locations = await MapHandler.geocodeAddresses(addresses);
        const optRadio = document.querySelector('input[name="optimization-preference"]:checked');
        if (!optRadio) throw new Error('No optimization preference selected or found!');
        const optimizationPreference = optRadio.value;
        const travelRadio = document.querySelector('input[name="travel-mode"]:checked');
        if (!travelRadio) throw new Error('No travel mode selected or found!');
        const travelMode = travelRadio.value;
        let optimizedRoute;
        if (locations.waypoints.length <= 10) {
            try {
                optimizedRoute = await RouteOptimizer.optimizeRouteWithDirectionsApi(locations, travelMode);
            } catch (error) {
                optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
            }
        } else {
            optimizedRoute = await RouteOptimizer.optimizeRoute(locations, optimizationPreference, travelMode);
        }
        UIController.displayResults(optimizedRoute);
        MapHandler.displayRoute(optimizedRoute, travelMode);
    } catch (error) {
        UIController.showError(error.message);
    } finally {
        UIController.setLoadingState(false);
    }
};

// Ensure UIController.init is called after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (UIController && typeof UIController.init === 'function') UIController.init();
        if (UIController && typeof UIController.initGoogleContactsLogin === 'function') UIController.initGoogleContactsLogin();
    });
} else {
    if (UIController && typeof UIController.init === 'function') UIController.init();
    if (UIController && typeof UIController.initGoogleContactsLogin === 'function') UIController.initGoogleContactsLogin();
}