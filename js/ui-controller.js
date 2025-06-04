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
    
    // Öffentliche Methoden
    return {        init: function() {
            // Event Listener for "Add Waypoint" button
            addWaypointButton.addEventListener('click', () => {
                waypointCounter++;
                const waypointElement = createWaypointElement(waypointCounter);
                waypointsContainer.appendChild(waypointElement);
                
                // Initialize autocomplete for new input field
                const input = waypointElement.querySelector('.address-autocomplete');
                setupAutocomplete(input);
            });
            
            // Initialize autocomplete for start and destination fields
            const addressFields = document.querySelectorAll('.address-autocomplete');
            addressFields.forEach(field => setupAutocomplete(field));
            
            // Event listeners for export and save buttons
            document.getElementById('export-route').addEventListener('click', this.exportRoute);
            document.getElementById('save-route').addEventListener('click', this.saveRoute);
        },
          collectAddresses: function() {
            const startAddress = document.getElementById('start').value.trim();
            const endAddress = document.getElementById('end').value.trim();
            
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
            
            // Display total distance and duration
            document.querySelector('#total-distance span').textContent = optimizedRoute.totalDistance;
            document.querySelector('#total-duration span').textContent = optimizedRoute.totalDuration;
            
            // Display optimized list of stops
            const stopsListElement = document.getElementById('optimized-stops');
            stopsListElement.innerHTML = '';
            
            optimizedRoute.stops.forEach((stop, index) => {
                const li = document.createElement('li');
                
                // Format text based on position in route
                let stopText = stop.address;
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
            try {
                const stops = window.currentOptimizedRoute.stops;
                if (!stops || stops.length < 2) {
                    throw new Error('No valid route available for export');
                }
                
                let url = 'https://www.google.com/maps/dir/?api=1';
                
                // Starting point
                url += `&origin=${encodeURIComponent(stops[0].address)}`;
                
                // Destination
                url += `&destination=${encodeURIComponent(stops[stops.length - 1].address)}`;
                
                // Waypoints
                if (stops.length > 2) {
                    const waypoints = stops.slice(1, -1).map(stop => stop.address);
                    url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
                }
                
                // Open in new tab
                window.open(url, '_blank');
                
            } catch (error) {
                UIController.showError('Route could not be exported: ' + error.message);
            }
        },
          saveRoute: function() {
            // Implementation for saving to localStorage
            try {
                if (!window.currentOptimizedRoute) {
                    throw new Error('No route available to save');
                }
                
                const routeName = prompt('Enter a name for this route:', 'My Route');
                
                if (!routeName) return; // User cancelled
                
                // Get saved routes or initialize empty array
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                
                // Add new route
                savedRoutes.push({
                    name: routeName,
                    date: new Date().toISOString(),
                    route: window.currentOptimizedRoute
                });
                
                // Save back to localStorage
                localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
                
                alert(`Route "${routeName}" has been saved successfully!`);
                
            } catch (error) {
                UIController.showError('Route could not be saved: ' + error.message);
            }
        }
    };
})();