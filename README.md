# Waypoint Optimizer

A web application that can optimize the order of waypoints in Google Maps routes.

###  [Live Demo](https://rennecke.org/route)

## Installation and Setup

```bash
git clone git@github.com:paulrennecke/route-optimizer.git
cd Route
```

2. **Generate Google API Key:**
 - Open the [Google Cloud Console](https://console.cloud.google.com)
 - Create a new project or select an existing one
 - Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Directions API
 - Create the required API key

3. **Configure Environment Variables:**
```bash
# Copy the template
copy .env.example .env
```
Edit the `.env` file and enter your generated API key:
```env
# Google Maps API Configuration
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```


## Usage

1. Open the application in your browser
2. Enter start and end points as well as optional waypoints
3. Choose optimization preference (shortest distance or fastest time)
4. Click "Optimize Route"
5. The optimized route will be displayed on the map, along with a list of stops

## License

This project is licensed under the MIT License.