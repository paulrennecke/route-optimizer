// route-optimizer.js - Route optimization algorithms

const RouteOptimizer = (() => {
    // Distance Matrix with Google API
    const calculateDistanceMatrix = (locations, travelMode = 'DRIVING') => new Promise((resolve, reject) => {
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
            status === google.maps.DistanceMatrixStatus.OK ? resolve(response) : reject(`Error calculating distances: ${status}`);
        });
    });

    // Nearest Neighbor Algorithm
    const nearestNeighborAlgorithm = (distanceMatrix, preference) => {
        const n = distanceMatrix.rows.length;
        const visited = Array(n).fill(false);
        const route = [0];
        visited[0] = true;
        while (route.length < n - 1) {
            const current = route[route.length - 1];
            let best = -1, bestValue = Infinity;
            for (let i = 1; i < n - 1; i++) {
                if (!visited[i]) {
                    const row = distanceMatrix.rows[current];
                    if (!row || !row.elements || !row.elements[i]) {
                        throw new Error('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
                    }
                    const element = row.elements[i];
                    if (element.status && element.status !== 'OK') {
                        throw new Error('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
                    }
                    if (!element.distance || !element.duration || typeof element.distance.value !== 'number' || typeof element.duration.value !== 'number') {
                        throw new Error('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
                    }
                    const value = preference === 'distance'
                        ? element.distance.value
                        : element.duration.value;
                    if (value < bestValue) {
                        bestValue = value;
                        best = i;
                    }
                }
            }
            if (best !== -1) {
                route.push(best);
                visited[best] = true;
            } else break;
        }
        route.push(n - 1);
        return route;
    };

    const formatDuration = seconds => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        let result = '';
        if (days > 0) result += days + 'd ';
        if (hours > 0) result += hours + 'h ';
        if (minutes > 0 || (!days && !hours)) result += minutes + 'min';
        return result.trim();
    };
    const formatTravelMode = travelMode => ({
        'DRIVING': 'by car',
        'BICYCLING': 'by bicycle',
        'WALKING': 'on foot'
    })[travelMode] || '';

    return {
        optimizeRoute: async (locationData, preference = 'time', travelMode = 'DRIVING') => {
            try {
                const allLocations = [locationData.start, ...locationData.waypoints, locationData.end];
                const distanceMatrix = await calculateDistanceMatrix(allLocations, travelMode);
                const optimizedIndices = nearestNeighborAlgorithm(distanceMatrix, preference);
                const optimizedStops = optimizedIndices.map(index => allLocations[index]);
                let totalDistance = 0, totalDuration = 0;
                const legs = [];
                for (let i = 0; i < optimizedIndices.length - 1; i++) {
                    const from = optimizedIndices[i], to = optimizedIndices[i + 1];
                    const fromRow = distanceMatrix.rows[from];
                    if (!fromRow || !fromRow.elements || !fromRow.elements[to]) {
                        throw new Error('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
                    }
                    const element = fromRow.elements[to];
                    if (element.status && element.status !== 'OK') {
                        throw new Error('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
                    }
                    if (!element.distance || !element.duration || typeof element.distance.value !== 'number' || typeof element.duration.value !== 'number') {
                        throw new Error('Route calculation not possible: No connection between at least two points (e.g. no road between islands).');
                    }
                    totalDistance += element.distance.value;
                    totalDuration += element.duration.value;
                    legs.push({
                        distance: element.distance,
                        duration: element.duration
                    });
                }
                return {
                    stops: optimizedStops,
                    totalDistance: `${(totalDistance / 1000).toFixed(1)} km`,
                    totalDuration: formatDuration(totalDuration),
                    travelMode: formatTravelMode(travelMode),
                    legs
                };
            } catch (error) {
                throw error;
            }
        },
        optimizeRouteWithDirectionsApi: (locationData, travelMode = 'DRIVING') => new Promise((resolve, reject) => {
            try {
                const directionsService = new google.maps.DirectionsService();
                const waypoints = locationData.waypoints.map(wp => ({ location: wp.location, stopover: true }));
                directionsService.route({
                    origin: locationData.start.location,
                    destination: locationData.end.location,
                    waypoints,
                    optimizeWaypoints: true,
                    travelMode: google.maps.TravelMode[travelMode]
                }, (response, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        const optimizedOrder = response.routes[0].waypoint_order;
                        const optimizedStops = [locationData.start];
                        optimizedOrder.forEach(index => optimizedStops.push(locationData.waypoints[index]));
                        optimizedStops.push(locationData.end);
                        const route = response.routes[0];
                        let totalDistance = 0, totalDuration = 0;
                        const legs = [];
                        route.legs.forEach(leg => {
                            totalDistance += leg.distance.value;
                            totalDuration += leg.duration.value;
                            legs.push({
                                distance: leg.distance,
                                duration: leg.duration
                            });
                        });
                        resolve({
                            stops: optimizedStops,
                            totalDistance: `${(totalDistance / 1000).toFixed(1)} km`,
                            totalDuration: formatDuration(totalDuration),
                            travelMode: formatTravelMode(travelMode),
                            legs
                        });
                    } else {
                        reject(`Route optimization error: ${status}`);
                    }
                });
            } catch (error) {
                reject(`Route optimization error: ${error.message}`);
            }
        })
    };
})();