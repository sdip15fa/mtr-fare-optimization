import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react'; // Added useMemo
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { Helmet } from 'react-helmet'; // Import Helmet
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
  ToggleButton, // Added for language switcher
  ToggleButtonGroup, // Added for language switcher
  Divider, // Added for visual separation
  Link, // Added for navigation
} from '@mui/material';
import SavingsPage from './components/SavingsPage'; // Import the new component
import {
  loadFareData,
  getStationList,
  getStationId,
  getFare,
  PaymentMethod,
  calculateFirstClassFare,
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

// Update RouteResult type to include first class fare
type RouteResult = {
  station: string | null; // null indicates direct route
  fare: number;
  firstClassFare?: number;
  isCheapest?: boolean;
  isDirect?: boolean;
};

function App() {
  const [currentPage, setCurrentPage] = useState<'calculator' | 'savings'>('calculator'); // State for page view
  const [startStation, setStartStation] = useState<string | null>(null);
  const [destStation, setDestStation] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(paymentMethodOptions[0].value); // Default to Adult Octopus
  const [loading, setLoading] = useState<boolean>(true);
  const [calculating, setCalculating] = useState<boolean>(false);
  // Store results as an array of objects with type info
  const [results, setResults] = useState<RouteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t, i18n } = useTranslation(); // Get translation function and i18n instance

  // --- Station Name Translation ---
  // Store original English names internally, display translated names
  const [originalStations, setOriginalStations] = useState<string[]>([]);

  // Memoize mapping from original English name to translated name
  const stationEnToLocaleMap = useMemo(() => {
    const map = new Map<string, string>();
    originalStations.forEach(station => {
      map.set(station, t(`stations.${station}`, station)); // Fallback to original if translation missing
    });
    return map;
  }, [originalStations, t]); // Recompute if stations load or language changes

  // Memoize mapping from translated name back to original English name
  const stationLocaleToEnMap = useMemo(() => {
    const map = new Map<string, string>();
    stationEnToLocaleMap.forEach((localeName, enName) => {
      map.set(localeName, enName);
    });
    return map;
  }, [stationEnToLocaleMap]);

  // Memoize the list of translated station names for Autocomplete options
  const translatedStationOptions = useMemo(() => {
    return Array.from(stationEnToLocaleMap.values()).sort((a, b) => a.localeCompare(b)); // Sort translated names
  }, [stationEnToLocaleMap]);
  // --- End Station Name Translation ---


  // Load fare data on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        setError(null);
        setLoading(true);
        await loadFareData();
        // Store the original English names from the service
        const originalList = getStationList();
        setOriginalStations(originalList);
        // setStations is no longer needed directly, use translatedStationOptions
      } catch (err) {
        console.error(t('errorLoadingData'), err);
        setError(t('errorLoadingData'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]); // Add t to dependency array to reload stations if language changes? Maybe not needed if map recomputes. Let's omit for now.

  const handlePaymentMethodChange = (event: SelectChangeEvent<PaymentMethod>) => {
    setPaymentMethod(event.target.value as PaymentMethod);
  };

  const handleLanguageChange = (
    event: React.MouseEvent<HTMLElement>,
    newLanguage: string | null,
  ) => {
    if (newLanguage !== null) {
      i18n.changeLanguage(newLanguage);
      // Clear results when language changes as station names in results need re-translation
      setResults(null);
      setError(null);
    }
  };

  const handleCalculate = () => {
    // startStation and destStation now store the original English names
    if (!startStation || !destStation || !paymentMethod) {
      setError(t('errorSelectStations'));
      return;
    }
    if (startStation === destStation) {
        setError(t('errorSameStation'));
        return;
    }

    setError(null); // Clear previous errors
    setCalculating(true);
    setResults(null); // Clear previous results

    // --- Fare Calculation Logic ---
    console.log('Calculating fare for:', startStation, 'to', destStation, 'via', paymentMethod);

    // Use the stored English names to get IDs
    const startId = getStationId(startStation);
    const destId = getStationId(destStation);

    if (!startId || !destId) {
        setError(t('errorStationId'));
        setCalculating(false);
        return;
    }

    // 1. Get Direct Fare
    const directFare = getFare(startId, destId, paymentMethod);
    const directFirstClassFare = calculateFirstClassFare(startStation, destStation, paymentMethod);

    // 2. Find Cheaper Intermediate Routes
    const cheaperOptions: { station: string; fare: number }[] = []; // station here is original English name
    const directFareValue = directFare === undefined ? Infinity : directFare;

    // Iterate using the original English station names
    for (const intermediateEnName of originalStations) {
      // Skip if the intermediate is the start or destination (using English names)
      if (intermediateEnName === startStation || intermediateEnName === destStation) {
        continue;
      }

      const intermediateId = getStationId(intermediateEnName);
      if (!intermediateId) {
        // Use t() for console warning if desired, but keep internal logic simple
        console.warn(`Could not find ID for intermediate station: ${intermediateEnName}`);
        continue; // Skip if ID not found
      }

      const fare1 = getFare(startId, intermediateId, paymentMethod);
      const fare2 = getFare(intermediateId, destId, paymentMethod);

      // Check if both legs of the journey have valid fares
      if (fare1 !== undefined && fare2 !== undefined) {
        const totalIntermediateFare = fare1 + fare2;

        // Only consider routes strictly cheaper than the direct route
        if (totalIntermediateFare < directFareValue) {
          // Store the original English name
          cheaperOptions.push({ station: intermediateEnName, fare: totalIntermediateFare });
        }
      }
    }

    // Add direct route if valid
    const directRoute: RouteResult | null = directFare !== undefined
        ? { 
            station: null, 
            fare: directFare, 
            firstClassFare: directFirstClassFare,
            isDirect: true 
          }
        : null;

    // Add cheaper intermediate routes
    const intermediateRoutes: RouteResult[] = cheaperOptions.map(opt => ({
        station: opt.station,
        fare: opt.fare,
        firstClassFare: calculateFirstClassFare(startStation, opt.station, paymentMethod) + 
                       calculateFirstClassFare(opt.station, destStation, paymentMethod)
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
        // Use translated error message
        setError(t('errorNoRoutes'));
    } else {
        setResults(finalResults);
    }

    setCalculating(false);
    // --- End Calculation Logic ---
  };

  const navigateToSavings = () => setCurrentPage('savings');
  const navigateToCalculator = () => setCurrentPage('calculator');

  useLayoutEffect(() => {
    // Update title based on current page
    document.title = currentPage === 'calculator'
      ? t('htmlTitle')
      : t('savingsPageHtmlTitle', 'MTR Savings Routes'); // Add translation key
  }, [t, currentPage]);

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 5 }}>
        <CircularProgress />
        <Typography>{t('loadingData')}</Typography>
      </Container>
    );
  }

  // Get current language for the toggle button state
  const currentLanguage = i18n.language.startsWith('zh') ? 'zh-Hant' : 'en';

  return (
    <> {/* Wrap content in a fragment */}
      <Helmet key={i18n.language}> {/* Add key prop */}
        <html lang={i18n.language.split('-')[0]} /> {/* Set html lang attribute */}
        {/* Title is now set in useLayoutEffect */}
        <meta name="description" content={t('metaDescription')} />
      </Helmet>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <ToggleButtonGroup
            value={currentLanguage}
            exclusive
            onChange={handleLanguageChange}
            aria-label="language selection"
            size="small"
          >
            <ToggleButton value="en" aria-label="English">
              EN
            </ToggleButton>
            <ToggleButton value="zh-Hant" aria-label="Traditional Chinese">
              繁
            </ToggleButton>
          </ToggleButtonGroup>
       </Box>

      {/* Navigation Links/Buttons */}
      <Box sx={{ mt: 3, mb: 2, textAlign: 'center' }}>
        {currentPage === 'calculator' ? (
          <Link component="button" variant="body1" onClick={navigateToSavings} sx={{ mx: 1 }}>
            {t('viewSavingsPageLink', 'View All Routes with Savings')}
          </Link>
        ) : (
          <Link component="button" variant="body1" onClick={navigateToCalculator} sx={{ mx: 1 }}>
            {t('backToCalculatorLink', 'Back to Fare Calculator')}
          </Link>
        )}
      </Box>
      {/* Conditionally render Calculator UI */}
      <Paper elevation={3} sx={{ p: 3, display: currentPage === 'calculator' ? 'block' : 'none' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          {t('appTitle')} {/* Title for calculator */}
        </Typography>

        {error && currentPage === 'calculator' && ( // Only show calculator errors here
          <Typography color="error" align="center" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Grid container spacing={3} alignItems="center">
          {/* Start Station */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={translatedStationOptions} // Use translated options
              value={startStation ? stationEnToLocaleMap.get(startStation) || null : null} // Display translated value
              onChange={(event, newValue) => {
                // When selection changes, find the original English name and store it
                const originalName = newValue ? stationLocaleToEnMap.get(newValue) || null : null;
                setStartStation(originalName);
              }}
              renderInput={(params) => (
                <TextField {...params} label={t('startStationLabel')} variant="outlined" fullWidth />
              )}
            />
          </Grid>

          {/* Destination Station */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={translatedStationOptions} // Use translated options
              value={destStation ? stationEnToLocaleMap.get(destStation) || null : null} // Display translated value
              onChange={(event, newValue) => {
                 // When selection changes, find the original English name and store it
                const originalName = newValue ? stationLocaleToEnMap.get(newValue) || null : null;
                setDestStation(originalName);
              }}
              renderInput={(params) => (
                <TextField {...params} label={t('destStationLabel')} variant="outlined" fullWidth />
              )}
            />
          </Grid>

          {/* Payment Method */}
          <Grid size={{ xs: 12, sm: 8 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="payment-method-label">{t('paymentMethodLabel')}</InputLabel>
              <Select
                labelId="payment-method-label"
                value={paymentMethod}
                onChange={handlePaymentMethodChange}
                label={t('paymentMethodLabel')} // Ensure label is translated
              >
                {paymentMethodOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {/* Translate payment method labels */}
                    {t(`paymentMethods.${option.value}`, option.label)}
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
              {calculating ? <CircularProgress size={24} /> : t('calculateButton')}
            </Button>
          </Grid>
        </Grid>

        {/* Result Display */}
        {results && results.length > 0 && (
          <Box sx={{ mt: 3 }}>
             <Divider sx={{ my: 2 }} /> {/* Add a divider */}
            <Typography variant="h6" component="h2" gutterBottom>
              {t('resultsTitle')}
            </Typography>
            <List dense>
              {results.map((route, index) => {
                const isDirect = route.station === null;
                 // Translate station name for display, fallback to original English name
                const displayStationName = route.station ? t(`stations.${route.station}`, route.station) : '';

                const label = isDirect
                  ? `${t('directRouteLabel')}: $${route.fare.toFixed(2)}`
                  : `${t('viaLabel')} ${displayStationName}: $${route.fare.toFixed(2)}`;

                let style = {};
                let secondaryText = null;

                if (route.isCheapest) {
                  style = { color: 'green', fontWeight: 'bold' };
                  secondaryText = t('cheapestOptionLabel');
                } else if (isDirect) {
                  style = { color: 'darkblue' }; // Style for direct route if not cheapest
                }

                return (
                  <ListItem key={index} disablePadding sx={{ borderBottom: '1px solid #eee' }}>
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{ style: style }}
                      secondary={
                        <>
                          {secondaryText && <div>{secondaryText}</div>}
                          {route.firstClassFare && (
                            <div style={{ color: '#666' }}>
                              {t('firstClassFareLabel')}: ${route.firstClassFare.toFixed(2)}
                            </div>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
         {/* Message if calculation ran but found nothing */}
         {results && results.length === 0 && !calculating && ( // Only show if not calculating
             <Typography sx={{ mt: 3 }} align="center">{error || t('errorNoRoutes')}</Typography>
         )}
        </Paper>

        {/* Conditionally render Savings Page */}
        {currentPage === 'savings' && <SavingsPage />}

        {/* Icon Attribution */}
        <Box sx={{ mt: 2, textAlign: 'center', fontSize: '0.8rem', color: 'text.secondary' }}>
          <Typography variant="caption" display="block" gutterBottom>
            <span dangerouslySetInnerHTML={{ __html: '<a href="https://www.flaticon.com/free-icons/savings" title="savings icons" target="_blank" rel="noopener noreferrer" style="color: inherit;">Savings icons created by Freepik - Flaticon</a>' }} />
          </Typography>
          {/* GitHub Link */}
          <Typography variant="caption" display="block">
             <a href="https://github.com/sdip15fa/mtr-fare-optimization" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
               View on GitHub
             </a>
          </Typography>
        </Box>
      </Container>
    </>
  );
}

export default App;
