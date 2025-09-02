# Simplified Satellite Tracking System

## Overview

This document describes the simplified satellite tracking system that replaces the complex TLE-based approach with a direct N2YO API integration. The new system is much simpler, more reliable, and easier to maintain.

## Key Changes

### Before (Complex TLE System)

- ❌ Fetched TLE data from CelesTrak
- ❌ Used Web Workers for SGP4 propagation
- ❌ Required satellite.js library
- ❌ Complex position calculations
- ❌ Large bundle size
- ❌ Potential for calculation errors

### After (Simplified N2YO System)

- ✅ Direct API calls to N2YO
- ✅ No Web Workers needed
- ✅ No satellite.js dependency
- ✅ Pre-calculated positions from N2YO
- ✅ Smaller bundle size
- ✅ More reliable data

## Architecture

```
Frontend (React)
    ↓
useSatellitesSimplified Hook
    ↓
/api/satellites/above (Next.js API Route)
    ↓
N2YO API (/above endpoint)
    ↓
Real-time satellite positions
```

## API Endpoints

### New Simplified Endpoint

- **URL**: `/api/satellites/above`
- **Method**: GET
- **Parameters**:
  - `observerLat`: Observer latitude (required)
  - `observerLon`: Observer longitude (required)
  - `observerAlt`: Observer altitude in meters (default: 0)
  - `searchRadius`: Search radius in degrees (default: 90)
  - `categories`: Comma-separated list of categories (default: "all")

### Example Request

```
GET /api/satellites/above?observerLat=40.7128&observerLon=-74.0060&observerAlt=0&searchRadius=90&categories=starlink,iss,gps
```

### Response Format

```json
{
  "satellites": [
    {
      "name": "STARLINK-1007",
      "noradId": "44713",
      "category": "starlink",
      "position": {
        "lat": 40.1234,
        "lon": -74.5678,
        "alt": 550.5
      },
      "visible": true,
      "launchDate": "2020-01-29",
      "intDesignator": "2020-006A"
    }
  ],
  "count": 150,
  "observer": {
    "lat": 40.7128,
    "lon": -74.006,
    "alt": 0
  },
  "searchRadius": 90,
  "categories": ["starlink", "iss", "gps"],
  "timestamp": 1703123456789
}
```

## N2YO API Rate Limits

The system respects N2YO's rate limits:

| Endpoint      | Limit     | Usage               |
| ------------- | --------- | ------------------- |
| Above         | 100/hour  | Main satellite data |
| Positions     | 1000/hour | Ground tracks       |
| Visual Passes | 100/hour  | Pass predictions    |
| Radio Passes  | 100/hour  | Radio predictions   |
| TLE           | 1000/hour | Orbital elements    |

## Caching Strategy

- **Cache Duration**: 2 minutes for real-time data
- **Cache Key**: Based on observer position, search radius, and categories
- **Cache Storage**: In-memory Map (can be upgraded to Redis for production)

## Available Categories

The system supports all N2YO categories:

- `starlink` - Starlink satellites
- `iss` - International Space Station
- `gps` - GPS constellation
- `weather` - Weather satellites
- `noaa` - NOAA satellites
- `iridium` - Iridium constellation
- `amateur-radio` - Amateur radio satellites
- `military` - Military satellites
- `all` - All satellites (default)

## Usage Examples

### Basic Usage

```typescript
import { useSatellitesSimplified } from "@/app/hooks/useSatellitesSimplified";

function MyComponent() {
  const { satellites, loading, error } = useSatellitesSimplified({
    categories: ["starlink", "iss"],
    updateInterval: 30000, // 30 seconds
    observerPosition: { lat: 40.7128, lon: -74.006, alt: 0 },
    searchRadius: 90,
  });

  return (
    <div>
      {loading && <p>Loading satellites...</p>}
      {error && <p>Error: {error}</p>}
      <p>Found {satellites.length} satellites</p>
    </div>
  );
}
```

### Dynamic Observer Position

```typescript
const { satellites, observerPosition, setObserverPosition } =
  useSatellitesSimplified();

// Update observer position when user moves map
const handleMapMove = (newPosition) => {
  setObserverPosition(newPosition);
};
```

## Performance Benefits

1. **Reduced Bundle Size**: Removed satellite.js (~200KB)
2. **Faster Loading**: No TLE parsing or SGP4 calculations
3. **Better Reliability**: N2YO handles all orbital mechanics
4. **Real-time Data**: Always up-to-date positions
5. **Simplified Code**: Easier to maintain and debug

## Migration Guide

### For Existing Users

1. **Update Imports**:

   ```typescript
   // Old
   import { useSatellites } from "@/app/hooks/useSatellites";

   // New
   import { useSatellitesSimplified } from "@/app/hooks/useSatellitesSimplified";
   ```

2. **Update Component Usage**:

   ```typescript
   // Old
   const { satellites, loading, error } = useSatellites({
     categories: ["active", "starlink"],
     updateInterval: 1000,
   });

   // New
   const { satellites, loading, error } = useSatellitesSimplified({
     categories: ["starlink", "iss"],
     updateInterval: 30000,
     observerPosition: { lat: 0, lon: 0, alt: 0 },
   });
   ```

3. **Update Globe Component**:

   ```typescript
   // Old
   import Globe from "@/components/Globe";

   // New
   import GlobeSimplified from "@/components/GlobeSimplified";
   ```

## Testing

Run the test script to verify the system works:

```bash
# Set your N2YO API key
export N2YO_API_KEY=your_api_key_here

# Run the test
node scripts/test-simplified-api.js
```

## Production Considerations

1. **API Key Management**: Store N2YO API key securely
2. **Rate Limiting**: Monitor usage and implement proper caching
3. **Error Handling**: Graceful fallbacks for API failures
4. **Monitoring**: Track API usage and performance
5. **Scaling**: Consider Redis for distributed caching

## Troubleshooting

### Common Issues

1. **"N2YO API key not configured"**

   - Set the `N2YO_API_KEY` environment variable

2. **"Rate limit exceeded"**

   - Increase cache duration
   - Reduce update frequency
   - Check for multiple simultaneous requests

3. **"No satellites found"**
   - Check observer position coordinates
   - Verify search radius (try 90 degrees)
   - Ensure categories are valid

### Debug Mode

Enable debug logging by setting:

```bash
export DEBUG=satellite-tracker:*
```

## Future Enhancements

1. **Offline Support**: Cache satellite data for offline viewing
2. **Predictive Loading**: Pre-fetch data for likely observer positions
3. **Advanced Filtering**: Filter by altitude, visibility, etc.
4. **Historical Data**: Store and display historical satellite positions
5. **Real-time Updates**: WebSocket integration for live updates

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review N2YO API documentation
3. Test with the provided test script
4. Monitor API rate limits and usage
