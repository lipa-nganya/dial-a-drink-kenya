import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { LocalShipping, ShoppingCart, LocationOn } from '@mui/icons-material';

const RouteMapView = ({
  riderRoutes,
  stops,
  riderLocations,
  mapCenter,
  onMapCenterChange,
  colors,
  isDarkMode,
  formatDateTime,
  getOrderStatusChipProps,
  getPaymentStatusChipProps
}) => {
  const [geocodedOrders, setGeocodedOrders] = useState({});
  const [geocodedStops, setGeocodedStops] = useState({});
  const [routePaths, setRoutePaths] = useState({});
  const [routeDistances, setRouteDistances] = useState({});
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const directionsServiceRef = useRef(null);

  // Initialize geocoder and directions service when map loads
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (window.google) {
      geocoderRef.current = new window.google.maps.Geocoder();
      directionsServiceRef.current = new window.google.maps.DirectionsService();
    }
  }, []);

  // Geocode address using Google Geocoding API
  const geocodeAddress = useCallback((address) => {
    if (!geocoderRef.current || !address || address === 'In-Store Purchase') {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      geocoderRef.current.geocode({ address }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  // Calculate route using Directions API
  const calculateRoute = useCallback(async (waypoints) => {
    if (!directionsServiceRef.current || waypoints.length < 2) {
      return null;
    }

    try {
      return new Promise((resolve) => {
        directionsServiceRef.current.route(
          {
            origin: waypoints[0],
            destination: waypoints[waypoints.length - 1],
            waypoints: waypoints.slice(1, -1).map(wp => ({ location: wp, stopover: true })),
            travelMode: window.google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
          },
          (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK) {
              const path = result.routes[0].overview_path.map(point => ({
                lat: point.lat(),
                lng: point.lng()
              }));
              const leg = result.routes[0].legs[0];
              const distance = leg.distance?.text || '';
              const duration = leg.duration?.text || '';
              resolve({ path, distance, duration, fullResult: result });
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error calculating route:', error);
      return null;
    }
  }, []);

  // Geocode all orders and stops when routes change
  useEffect(() => {
    const geocodeAll = async () => {
      if (!window.google || !geocoderRef.current || geocodingInProgress) return;

      setGeocodingInProgress(true);
      const newOrderCoords = {};

      // Geocode orders
      for (const route of riderRoutes) {
        for (const order of route.orders) {
          if (order.deliveryAddress && !geocodedOrders[order.id]) {
            const coords = await geocodeAddress(order.deliveryAddress);
            if (coords) {
              newOrderCoords[order.id] = coords;
            }
          }
        }

        // Geocode stops
        if (stops[route.rider.id]) {
          stops[route.rider.id].forEach((stopItem, index) => {
            const key = `${route.rider.id}-${index}`;
            const stop = stopItem.stop || stopItem; // Support both old format (stop) and new format ({ stop, insertAfterIndex })
            if (stop.location && !geocodedStops[key]) {
              geocodeAddress(stop.location).then(coords => {
                if (coords) {
                  setGeocodedStops(prev => ({ ...prev, [key]: coords }));
                }
              });
            }
          });
        }
      }

      setGeocodedOrders(prev => ({ ...prev, ...newOrderCoords }));
      setGeocodingInProgress(false);
    };

    if (riderRoutes.length > 0 && window.google) {
      geocodeAll();
    }
  }, [riderRoutes, stops, geocodedOrders, geocodedStops, geocodeAddress, geocodingInProgress]);

  // Calculate routes for each rider
  useEffect(() => {
    const calculateAllRoutes = async () => {
      if (!directionsServiceRef.current || !window.google) return;

      const newPaths = {};
      const newDistances = {};

      for (const route of riderRoutes) {
        const waypoints = [];
        
        // Add rider location if available
        if (riderLocations[route.rider.id]) {
          waypoints.push(riderLocations[route.rider.id]);
        }

        // Add orders in sequence
        route.orders.forEach(order => {
          const coords = geocodedOrders[order.id];
          if (coords) waypoints.push(coords);
        });

        // Add stops in sequence (for simplicity, add them after orders)
        if (stops[route.rider.id]) {
          stops[route.rider.id].forEach((stopItem, index) => {
            const key = `${route.rider.id}-${index}`;
            const coords = geocodedStops[key];
            if (coords) waypoints.push(coords);
          });
        }

        if (waypoints.length >= 2) {
          const routeData = await calculateRoute(waypoints);
          if (routeData) {
            newPaths[route.rider.id] = routeData.path;
            newDistances[route.rider.id] = {
              distance: routeData.distance,
              duration: routeData.duration
            };
          }
        }
      }

      setRoutePaths(newPaths);
      setRouteDistances(newDistances);
    };

    if (riderRoutes.length > 0 && Object.keys(geocodedOrders).length > 0 && window.google) {
      calculateAllRoutes();
    }
  }, [riderRoutes, geocodedOrders, geocodedStops, riderLocations, stops, calculateRoute]);

  // Get all markers for the map
  const getMarkers = () => {
    const markers = [];

    riderRoutes.forEach(route => {
      // Rider marker
      if (riderLocations[route.rider.id]) {
        markers.push({
          id: `rider-${route.rider.id}`,
          position: riderLocations[route.rider.id],
          type: 'rider',
          data: route.rider,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new window.google.maps.Size(40, 40)
          }
        });
      }

      // Order markers
      route.orders.forEach(order => {
        const coords = geocodedOrders[order.id];
        if (coords) {
          markers.push({
            id: `order-${order.id}`,
            position: coords,
            type: 'order',
            data: order
          });
        }
      });

      // Stop markers
      if (stops[route.rider.id]) {
        stops[route.rider.id].forEach((stop, index) => {
          const key = `${route.rider.id}-${index}`;
          const coords = geocodedStops[key];
          if (coords) {
            markers.push({
              id: `stop-${key}`,
              position: coords,
              type: 'stop',
              data: stop,
              icon: {
                url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                scaledSize: new window.google.maps.Size(40, 40)
              }
            });
          }
        });
      }
    });

    return markers;
  };

  const markers = getMarkers();

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={mapCenter}
      zoom={12}
      onLoad={onMapLoad}
      onCenterChanged={() => {
        if (mapRef.current) {
          const center = mapRef.current.getCenter();
          if (center && onMapCenterChange) {
            onMapCenterChange({ lat: center.lat(), lng: center.lng() });
          }
        }
      }}
    >
      {geocodingInProgress && (
        <Paper sx={{ p: 2, position: 'absolute', top: 10, left: 10, zIndex: 1, backgroundColor: colors.paper }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading map data...
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Polylines for routes */}
      {Object.entries(routePaths).map(([riderId, path]) => {
        const distanceData = routeDistances[riderId];
        
        return (
          <React.Fragment key={`polyline-${riderId}`}>
            <Polyline
              path={path}
              options={{
                strokeColor: '#00E0B8',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                geodesic: true,
                icons: [{
                  icon: {
                    path: 'M 0,0 0,0',
                    strokeColor: '#00E0B8',
                    strokeOpacity: 1,
                    strokeWeight: 3
                  },
                  offset: '0',
                  repeat: '20px'
                }]
              }}
            />
            {distanceData && path.length > 0 && (
              <InfoWindow
                position={path[Math.floor(path.length / 2)]}
                onCloseClick={() => {}}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Distance: {distanceData.distance}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Duration: {distanceData.duration}
                  </Typography>
                </Box>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}

      {/* Markers */}
      {markers.map(marker => (
        <React.Fragment key={marker.id}>
          <Marker
            position={marker.position}
            icon={marker.icon}
            onClick={() => setSelectedMarker(marker)}
          />
          {selectedMarker?.id === marker.id && (
            <InfoWindow
              position={marker.position}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <Box sx={{ minWidth: 200, maxWidth: 300 }}>
                {marker.type === 'rider' && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocalShipping fontSize="small" sx={{ color: colors.accentText }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {marker.data.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {marker.data.phoneNumber}
                    </Typography>
                  </>
                )}
                {marker.type === 'order' && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <ShoppingCart fontSize="small" sx={{ color: colors.accentText }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Order #{marker.data.id}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {marker.data.customerName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {marker.data.deliveryAddress}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      KES {parseFloat(marker.data.totalAmount || 0).toFixed(2)}
                    </Typography>
                  </>
                )}
                {marker.type === 'stop' && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocationOn fontSize="small" sx={{ color: '#FFC107' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#FFC107' }}>
                        {marker.data.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {marker.data.location}
                    </Typography>
                    {marker.data.instruction && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {marker.data.instruction}
                      </Typography>
                    )}
                    {marker.data.payment && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Payment: KES {parseFloat(marker.data.payment || 0).toFixed(2)}
                      </Typography>
                    )}
                  </>
                )}
              </Box>
            </InfoWindow>
          )}
        </React.Fragment>
      ))}
    </GoogleMap>
  );
};

export default RouteMapView;

