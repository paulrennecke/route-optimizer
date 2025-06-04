// route-optimizer.js - Route optimization algorithms

const RouteOptimizer = (() => {
    // Private Methoden
      // Calculate distance matrix between all points
    const calculateDistanceMatrix = async (locations, travelMode = 'DRIVING') => {
        return new Promise((resolve, reject) => {
            const service = new google.maps.DistanceMatrixService();
            
            const origins = locations.map(loc => loc.location);
            const destinations = [...origins];
            
            service.getDistanceMatrix({
                origins,
                destinations,
                travelMode: google.maps.TravelMode[travelMode],
                unitSystem: google.maps.UnitSystem.METRIC,
                avoidHighways: false,
                avoidTolls: false,
            }, (response, status) => {
                if (status === google.maps.DistanceMatrixStatus.OK) {
                    resolve(response);
                } else {
                    reject(`Error calculating distances: ${status}`);
                }
            });
        });
    };
      // Implementation of "Nearest Neighbor" algorithm for route optimization
    // A simple heuristic for the Travelling Salesman Problem
    const nearestNeighborAlgorithm = (distanceMatrix, preference) => {
        const n = distanceMatrix.rows.length;
        const visited = new Array(n).fill(false);
        const route = [0]; // Start with index 0 (starting point)
        visited[0] = true;
        
        // Iteratively find the next nearest unvisited point
        while (route.length < n - 1) { // n-1, because we handle destination separately
            const current = route[route.length - 1];
            let best = -1;
            let bestValue = Infinity;
            
            for (let i = 1; i < n - 1; i++) { // Ignore start and destination (0 and n-1)
                if (!visited[i]) {
                    // Choose either distance or time based on preference
                    const value = preference === 'distance'
                        ? distanceMatrix.rows[current].elements[i].distance.value
                        : distanceMatrix.rows[current].elements[i].duration.value;
                        
                    if (value < bestValue) {
                        bestValue = value;
                        best = i;
                    }
                }
            }
            
            if (best !== -1) {
                route.push(best);
                visited[best] = true;
            } else {
                break; // If no further point was found
            }
        }
        
        route.push(n - 1); // Add destination
        
        return route;
    };
    
    // Funktion zur Formatierung der Dauer in Stunden und Minuten
    const formatDuration = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
    };    // Formats travel mode for display
    const formatTravelMode = (travelMode) => {
        const modes = {
            'DRIVING': 'by car',
            'BICYCLING': 'by bicycle',
            'WALKING': 'on foot'
        };
        return modes[travelMode] || '';
    };    // Public methods
    return {
        optimizeRoute: async function(locationData, preference = 'time', travelMode = 'DRIVING') {
            try {
                // Combine all locations in one list
                const allLocations = [
                    locationData.start,
                    ...locationData.waypoints,
                    locationData.end
                ];
                
                // Calculate distance matrix
                const distanceMatrix = await calculateDistanceMatrix(allLocations, travelMode);
                
                // Calculate optimal order with Nearest Neighbor
                const optimizedIndices = nearestNeighborAlgorithm(distanceMatrix, preference);
                
                // Create optimized route
                const optimizedStops = optimizedIndices.map(index => allLocations[index]);
                
                // Calculate total distance and duration
                let totalDistance = 0;
                let totalDuration = 0;
                
                for (let i = 0; i < optimizedIndices.length - 1; i++) {
                    const from = optimizedIndices[i];
                    const to = optimizedIndices[i + 1];
                    totalDistance += distanceMatrix.rows[from].elements[to].distance.value;
                    totalDuration += distanceMatrix.rows[from].elements[to].duration.value;
                }
                
                return {
                    stops: optimizedStops,
                    totalDistance: `${(totalDistance / 1000).toFixed(1)} km`,
                    totalDuration: formatDuration(totalDuration),
                    travelMode: formatTravelMode(travelMode),
                    rawData: {
                        distance: totalDistance,
                        duration: totalDuration,
                        travelModeValue: travelMode
                    }
                };
            } catch (error) {
                throw new Error(`Route optimization error: ${error}`);
            }
        },
          // Alternative implementation with Google Directions API Waypoint Optimization
        optimizeRouteWithDirectionsApi: async function(locationData, travelMode = 'DRIVING') {
            return new Promise((resolve, reject) => {
                try {
                    const directionsService = new google.maps.DirectionsService();
                    
                    // Create waypoints from intermediate destinations
                    const waypoints = locationData.waypoints.map(wp => ({
                        location: wp.location,
                        stopover: true
                    }));
                    
                    // Request to Directions API
                    directionsService.route({
                        origin: locationData.start.location,
                        destination: locationData.end.location,
                        waypoints: waypoints,
                        optimizeWaypoints: true, // Google optimizes the order
                        travelMode: google.maps.TravelMode[travelMode]
                    }, (response, status) => {
                        if (status === google.maps.DirectionsStatus.OK) {
                            // Extract optimized order
                            const optimizedOrder = response.routes[0].waypoint_order;
                            
                            // Create optimized stops
                            const optimizedStops = [locationData.start];
                            
                            // Add waypoints in optimized order
                            optimizedOrder.forEach(index => {
                                optimizedStops.push(locationData.waypoints[index]);
                            });
                            
                            // Add destination
                            optimizedStops.push(locationData.end);
                            
                            // Calculate total distance and time from route
                            const route = response.routes[0];
                            let totalDistance = 0;
                            let totalDuration = 0;
                            
                            route.legs.forEach(leg => {
                                totalDistance += leg.distance.value;
                                totalDuration += leg.duration.value;
                            });
                            
                            resolve({
                                stops: optimizedStops,
                                totalDistance: `${(totalDistance / 1000).toFixed(1)} km`,
                                totalDuration: formatDuration(totalDuration),
                                travelMode: formatTravelMode(travelMode),
                                rawData: {
                                    distance: totalDistance,
                                    duration: totalDuration,
                                    directionsResult: response,
                                    travelModeValue: travelMode
                                }
                            });
                        } else {
                            reject(`Route optimization error: ${status}`);
                        }
                    });
                } catch (error) {
                    reject(`Route optimization error: ${error.message}`);
                }
            });
        }
    };
})();