import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Autocomplete,
  TextField,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  Grid,
  CircularProgress,
  Box,
  Paper,
  SelectChangeEvent,
  List, // Added
  ListItem, // Added
  ListItemText, // Added
} from '@mui/material';
import {
  loadFareData,
  getStationList,
  getStationId,
  getFare,
  PaymentMethod,
} from './data/fareService';
import './App.css'; // Keep existing styles if any

// Define payment method options for the dropdown
const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'OCT_ADT_FARE', label: 'Adult Octopus' },
  { value: 'OCT_STD_FARE', label: 'Student Octopus' },
  { value: 'OCT_JOYYOU_SIXTY_FARE', label: 'JoyYou (60+) Octopus' },
  { value: 'SINGLE_ADT_FARE', label: 'Adult Single Journey' },
  { value: 'OCT_CON_CHILD_FARE', label: 'Child Octopus' },
  { value: 'OCT_CON_ELDERLY_FARE', label: 'Elderly Octopus' },
  { value: 'OCT_CON_PWD_FARE', label: 'PWD Octopus' },
  { value: 'SINGLE_CON_CHILD_FARE', label: 'Child Single Journey' },
  { value: 'SINGLE_CON_ELDERLY_FARE', label: 'Elderly Single Journey' },
];

function App() {
  const [stations, setStations] = useState<string[]>([]);
  const [startStation, setStartStation] = useState<string | null>(null);
  const [destStation, setDestStation] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(paymentMethodOptions[0].value); // Default to Adult Octopus
  const [loading, setLoading] = useState<boolean>(true);
  const [calculating, setCalculating] = useState<boolean>(false);
// Store results as an array of objects with type info
type RouteResult = {
  station: string | null; // null indicates direct route
  fare: number;
  isCheapest?: boolean;
  isDirect?: boolean;
};
const [results, setResults] = useState<RouteResult[] | null>(null);
const [error, setError] = useState<string | null>(null);

// Load fare data on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        setError(null);
        setLoading(true);
        await loadFareData();
        setStations(getStationList());
      } catch (err) {
        console.error('Failed to load fare data:', err);
        setError('Failed to load fare data. Please check the console or try refreshing.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []); // Empty dependency array ensures this runs only once

  const handlePaymentMethodChange = (event: SelectChangeEvent<PaymentMethod>) => {
    setPaymentMethod(event.target.value as PaymentMethod);
  };

  const handleCalculate = () => {
    if (!startStation || !destStation || !paymentMethod) {
      setError('Please select start station, destination, and payment method.');
      return;
    }
    if (startStation === destStation) {
        setError('Start and destination stations cannot be the same.');
        return;
    }

    setError(null);
    setCalculating(true);
    setResults(null); // Clear previous results

    // --- Fare Calculation Logic ---
    console.log('Calculating fare for:', startStation, 'to', destStation, 'via', paymentMethod);

    const startId = getStationId(startStation);
    const destId = getStationId(destStation);

    if (!startId || !destId) {
        setError('Could not find station IDs. Data might be inconsistent.');
        setCalculating(false);
        return;
    }

    // 1. Get Direct Fare
    const directFare = getFare(startId, destId, paymentMethod);

    // 2. Find Cheaper Intermediate Routes
    const cheaperOptions: { station: string; fare: number }[] = [];
    const directFareValue = directFare === undefined ? Infinity : directFare;

    for (const intermediateStationName of stations) {
      // Skip if the intermediate is the start or destination
      if (intermediateStationName === startStation || intermediateStationName === destStation) {
        continue;
      }

      const intermediateId = getStationId(intermediateStationName);
      if (!intermediateId) {
        console.warn(`Could not find ID for intermediate station: ${intermediateStationName}`);
        continue; // Skip if ID not found
      }

      const fare1 = getFare(startId, intermediateId, paymentMethod);
      const fare2 = getFare(intermediateId, destId, paymentMethod);

      // Check if both legs of the journey have valid fares
      if (fare1 !== undefined && fare2 !== undefined) {
        const totalIntermediateFare = fare1 + fare2;

        // Only consider routes strictly cheaper than the direct route
        if (totalIntermediateFare < directFareValue) {
          cheaperOptions.push({ station: intermediateStationName, fare: totalIntermediateFare });
        }
      }
    }

    // Add direct route if valid
    const directRoute: RouteResult | null = directFare !== undefined
        ? { station: null, fare: directFare, isDirect: true }
        : null;

    // Add cheaper intermediate routes
    const intermediateRoutes: RouteResult[] = cheaperOptions.map(opt => ({
        station: opt.station,
        fare: opt.fare,
    }));

    // Combine and sort all potential options initially
    let combinedOptions: RouteResult[] = [...intermediateRoutes];
    if (directRoute) {
        combinedOptions.push(directRoute);
    }
    combinedOptions.sort((a, b) => a.fare - b.fare);

    // Identify the absolute cheapest
    const cheapestRoute = combinedOptions.length > 0 ? combinedOptions[0] : null;
    if (cheapestRoute) {
        cheapestRoute.isCheapest = true;
    }

    // Build the final list (max 5)
    let finalResults: RouteResult[] = [];

    // 1. Add the absolute cheapest
    if (cheapestRoute) {
        finalResults.push(cheapestRoute);
    }

    // 2. Add the direct route if it's valid and *not* the cheapest one already added
    if (directRoute && directRoute !== cheapestRoute && finalResults.length < 5) {
        finalResults.push(directRoute);
    }

    // 3. Add remaining cheaper intermediate routes, sorted, avoiding duplicates, up to 5 total
    intermediateRoutes.sort((a, b) => a.fare - b.fare); // Ensure intermediates are sorted
    for (const route of intermediateRoutes) {
        if (finalResults.length >= 5) break;
        // Add if it's not the cheapest (already added) and not the direct route (if direct was added separately)
        if (route !== cheapestRoute && route.station !== directRoute?.station) {
             // Check if it's already in finalResults (covers edge case if direct was an intermediate)
             if (!finalResults.some(fr => fr.station === route.station && fr.fare === route.fare)) {
                 finalResults.push(route);
             }
        }
    }

     // Ensure final list is sorted overall by fare, except direct route might be fixed at #2
     // Re-sort might be complex due to fixed #2. Let's refine the adding logic.

     // --- Refined Final List Building ---
     finalResults = []; // Reset
     const otherIntermediateRoutes = intermediateRoutes
         .filter(route => route !== cheapestRoute) // Exclude the absolute cheapest
         .sort((a, b) => a.fare - b.fare); // Sort remaining intermediates

     // 1. Add cheapest
     if (cheapestRoute) {
         finalResults.push(cheapestRoute);
     }

     // 2. Add direct if valid and not the cheapest
     let directAdded = false;
     if (directRoute && directRoute !== cheapestRoute && finalResults.length < 5) {
         finalResults.push(directRoute);
         directAdded = true;
     }

     // 3. Fill remaining spots with other intermediates
     for (const route of otherIntermediateRoutes) {
         if (finalResults.length >= 5) break;
         // Add if it's not the direct route (which might have been added)
         if (!directAdded || route.station !== directRoute?.station) {
              // Add if not already present (handles edge cases)
             if (!finalResults.some(fr => fr.station === route.station && fr.fare === route.fare)) {
                 finalResults.push(route);
             }
         }
     }
     // --- End Refined Logic ---


    // Update state
    if (finalResults.length === 0) {
        setError("Could not calculate any valid routes.");
    } else {
        setResults(finalResults);
    }

    setCalculating(false);
    // --- End Calculation Logic ---
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 5 }}>
        <CircularProgress />
        <Typography>Loading fare data...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          MTR Fare Optimizer
        </Typography>

        {error && (
          <Typography color="error" align="center" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Grid container spacing={3} alignItems="center">
          {/* Start Station */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={stations}
              value={startStation}
              onChange={(event, newValue) => {
                setStartStation(newValue);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Start Station" variant="outlined" fullWidth />
              )}
            />
          </Grid>

          {/* Destination Station */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={stations}
              value={destStation}
              onChange={(event, newValue) => {
                setDestStation(newValue);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Destination Station" variant="outlined" fullWidth />
              )}
            />
          </Grid>

          {/* Payment Method */}
          <Grid size={{ xs: 12, sm: 8 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="payment-method-label">Payment Method</InputLabel>
              <Select
                labelId="payment-method-label"
                value={paymentMethod}
                onChange={handlePaymentMethodChange}
                label="Payment Method"
              >
                {paymentMethodOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Calculate Button */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCalculate}
              disabled={calculating || !startStation || !destStation}
              fullWidth
              sx={{ height: '56px' }} // Match text field height
            >
              {calculating ? <CircularProgress size={24} /> : 'Calculate Fare'}
            </Button>
          </Grid>
        </Grid>

        {/* Result Display */}
        {results && results.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Fare Options:
            </Typography>
            <List dense>
              {results.map((route, index) => {
                const isDirect = route.station === null;
                const label = isDirect
                  ? `Direct Route: $${route.fare.toFixed(2)}`
                  : `Via ${route.station}: $${route.fare.toFixed(2)}`;

                let style = {};
                let secondaryText = null;

                if (route.isCheapest) {
                  style = { color: 'green', fontWeight: 'bold' };
                  secondaryText = 'Cheapest Option';
                } else if (isDirect) {
                  style = { color: 'darkblue' }; // Style for direct route if not cheapest
                }

                return (
                  <ListItem key={index} disablePadding sx={{ borderBottom: '1px solid #eee' }}>
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{ style: style }}
                      secondary={secondaryText}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
         {/* Message if calculation ran but found nothing */}
         {results && results.length === 0 && (
             <Typography sx={{ mt: 3 }} align="center">{error || "No routes found."}</Typography>
         )}
         {/* Clear specific message about direct being cheapest if list shows it */}
      </Paper>
    </Container>
  );
}

export default App;
