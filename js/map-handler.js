// map-handler.js - Google Maps component management

const MapHandler = (() => {
    let map, markers = [], inputMarkers = [], directionsService, directionsRenderer;

    const clearMarkers = () => { markers.forEach(m => m.setMap(null)); markers = []; };
    const clearInputMarkers = () => { inputMarkers.forEach(m => m.setMap(null)); inputMarkers = []; };

    return {
        init: function() {
            map = new google.maps.Map(document.getElementById('map'), {
                center: { lat: 51.1657, lng: 10.4515 }, zoom: 6, mapTypeControl: true, streetViewControl: false,
                mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU }
            });
            directionsService = new google.maps.DirectionsService();
            directionsRenderer = new google.maps.DirectionsRenderer({ map, suppressMarkers: true });
            this.setupAutocompletionListeners();
        },
        setupAutocompletionListeners: function() {
            document.addEventListener('DOMNodeInserted', event => {
                if (event.target.classList?.contains('pac-item')) {
                    setTimeout(() => {
                        document.querySelectorAll('.address-autocomplete').forEach(input => {
                            if (input.value && !input.dataset.geocoded) {
                                this.geocodeAndShowOnMap(input.value, input.id);
                                input.dataset.geocoded = 'true';
                                input.addEventListener('input', () => input.dataset.geocoded = 'false');
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
        geocodeAndShowOnMap: function(address, inputId) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address }, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK) {
                    const location = results[0].geometry.location;
                    let icon, label = '';
                    if (inputId === 'start') {
                        icon = { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#4CAF50", fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" };
                        label = 'S';
                    } else if (inputId === 'end') {
                        icon = { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#F44336", fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" };
                        label = 'E';
                    } else {
                        const waypointMatch = inputId.match(/waypoint-(\d+)/);
                        const waypointNum = waypointMatch ? waypointMatch[1] : '?';
                        icon = { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#3498db", fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" };
                        label = waypointNum;
                    }
                    const existingMarkerIndex = inputMarkers.findIndex(m => m.inputId === inputId);
                    if (existingMarkerIndex !== -1) {
                        inputMarkers[existingMarkerIndex].marker.setMap(null);
                        inputMarkers.splice(existingMarkerIndex, 1);
                    }
                    const marker = new google.maps.Marker({
                        position: location, map, title: address, icon, label: { text: label, color: '#FFFFFF', fontWeight: 'bold' }, animation: google.maps.Animation.DROP
                    });
                    inputMarkers.push({ inputId, marker });
                    const infoWindow = new google.maps.InfoWindow({ content: `<div><strong>${address}</strong></div>` });
                    marker.addListener('click', () => infoWindow.open(map, marker));
                    if (inputMarkers.length === 1) { map.setCenter(location); map.setZoom(13); }
                    else { const bounds = new google.maps.LatLngBounds(); inputMarkers.forEach(m => bounds.extend(m.marker.getPosition())); map.fitBounds(bounds); }
                }
            });
        },
        geocodeAddresses: async function(addresses) {
            function extractAddress(val) {
                const contactMatch = /^(.+)\s+—\s+(.+)$/.exec(val);
                if (contactMatch) {
                    return contactMatch[2].trim();
                }
                return val.trim();
            }
            const cleanAddress = extractAddress;
            const geocodeAddress = (address) => {
                const clean = cleanAddress(address);
                return new Promise((resolve, reject) => {
                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ address: clean }, (results, status) => {
                        if (status === google.maps.GeocoderStatus.OK) {
                            resolve({
                                address,
                                location: results[0].geometry.location,
                                placeId: results[0].place_id
                            });
                        } else {
                            reject(`Could not find address: ${address}`);
                        }
                    });
                });
            };
            try {
                const startLocation = await geocodeAddress(addresses.start);
                const endLocation = await geocodeAddress(addresses.end);
                const waypointLocations = await Promise.all(addresses.waypoints.map(geocodeAddress));
                return { start: startLocation, waypoints: waypointLocations, end: endLocation };
            } catch (error) { throw new Error(`Geocoding error: ${error}`); }
        },
        displayRoute: function(optimizedRoute) {
            clearMarkers();
            clearInputMarkers();
            directionsRenderer.setDirections({ routes: [] });
            const waypoints = optimizedRoute.stops.slice(1, -1).map(stop => ({ location: stop.location, stopover: true }));
            const routeRequest = {
                origin: optimizedRoute.stops[0].location,
                destination: optimizedRoute.stops[optimizedRoute.stops.length - 1].location,
                waypoints,
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING
            };
            directionsService.route(routeRequest, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    directionsRenderer.setDirections(result);
                    this.addMarkersToMap(optimizedRoute.stops);
                    const bounds = new google.maps.LatLngBounds();
                    optimizedRoute.stops.forEach(stop => bounds.extend(stop.location));
                    map.fitBounds(bounds);
                } else {
                    UIController.showError(`Error displaying route: ${status}`);
                }
            });
            window.currentOptimizedRoute = optimizedRoute;
        },
        addMarkersToMap: function(stops) {
            stops.forEach((stop, index) => {
                let icon, label = '';
                if (index === 0) {
                    icon = { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#4CAF50", fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" };
                    label = 'S';
                } else if (index === stops.length - 1) {
                    icon = { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#F44336", fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" };
                    label = 'E';
                } else {
                    icon = { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#3498db", fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" };
                    label = index.toString();
                }
                const markerOptions = {
                    position: stop.location, map, title: stop.address, icon, animation: google.maps.Animation.DROP,
                    label: { text: label, color: "#ffffff", fontWeight: "bold", fontSize: "14px" },
                    zIndex: index === 0 || index === stops.length - 1 ? 100 : 10
                };
                const marker = new google.maps.Marker(markerOptions);
                markers.push(marker);
                const infoContent = index === 0 ? 'Start' : (index === stops.length - 1 ? 'End' : `Stop ${index}`);
                const infoWindow = new google.maps.InfoWindow({ content: `<div class="info-window"><strong>${infoContent}</strong><p>${stop.address}</p></div>` });
                marker.addListener('click', () => infoWindow.open(map, marker));
            });
        }
    };
})();