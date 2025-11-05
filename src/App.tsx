import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import {
  Container,
  Typography,
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
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Stack,
  Card,
  CardContent,
  Fade,
  Slide,
  IconButton,
} from '@mui/material';
import SavingsPage from './components/SavingsPage';
import StationSelector from './components/StationSelector';
import {
  loadFareData,
  getStationList,
  getStationId,
  getFare,
  PaymentMethod,
} from './data/fareService';
import { getLinesForStation, loadStationData } from './data/mtrLines';
import './App.css';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DirectionsIcon from '@mui/icons-material/Directions';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

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
  const [currentPage, setCurrentPage] = useState<'calculator' | 'savings'>('calculator');
  const [startStation, setStartStation] = useState<string | null>(null);
  const [destStation, setDestStation] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(paymentMethodOptions[0].value);
  const [loading, setLoading] = useState<boolean>(true);
  const [calculating, setCalculating] = useState<boolean>(false);

  type RouteResult = {
    station: string | null;
    fare: number;
    isCheapest?: boolean;
    isDirect?: boolean;
  };
  const [results, setResults] = useState<RouteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t, i18n } = useTranslation();


  // Load fare and station data on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        setError(null);
        setLoading(true);
        await Promise.all([loadFareData(), loadStationData()]);
      } catch (err) {
        console.error(t('errorLoadingData'), err);
        setError(t('errorLoadingData'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [t]);

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
    if (!startStation || !destStation || !paymentMethod) {
      setError(t('errorSelectStations'));
      return;
    }
    if (startStation === destStation) {
      setError(t('errorSameStation'));
      return;
    }

    setError(null);
    setCalculating(true);
    setResults(null);

    const startId = getStationId(startStation);
    const destId = getStationId(destStation);

    if (!startId || !destId) {
      setError(t('errorStationId'));
      setCalculating(false);
      return;
    }

    // Get Direct Fare
    const directFare = getFare(startId, destId, paymentMethod);
    const directFareValue = directFare === undefined ? Infinity : directFare;

    // Find Cheaper Intermediate Routes
    const allStations = getStationList();
    const cheaperOptions: { station: string; fare: number }[] = [];

    for (const intermediateStation of allStations) {
      if (intermediateStation === startStation || intermediateStation === destStation) {
        continue;
      }

      const intermediateId = getStationId(intermediateStation);
      if (!intermediateId) continue;

      const fare1 = getFare(startId, intermediateId, paymentMethod);
      const fare2 = getFare(intermediateId, destId, paymentMethod);

      if (fare1 !== undefined && fare2 !== undefined) {
        const totalFare = fare1 + fare2;
        if (totalFare < directFareValue) {
          cheaperOptions.push({ station: intermediateStation, fare: totalFare });
        }
      }
    }

    // Build results
    const directRoute: RouteResult | null = directFare !== undefined
      ? { station: null, fare: directFare, isDirect: true }
      : null;

    const intermediateRoutes: RouteResult[] = cheaperOptions.map(opt => ({
      station: opt.station,
      fare: opt.fare,
    }));

    let combinedOptions: RouteResult[] = [...intermediateRoutes];
    if (directRoute) {
      combinedOptions.push(directRoute);
    }
    combinedOptions.sort((a, b) => a.fare - b.fare);

    const cheapestRoute = combinedOptions.length > 0 ? combinedOptions[0] : null;
    if (cheapestRoute) {
      cheapestRoute.isCheapest = true;
    }

    let finalResults: RouteResult[] = [];
    const otherIntermediateRoutes = intermediateRoutes
      .filter(route => route !== cheapestRoute)
      .sort((a, b) => a.fare - b.fare);

    if (cheapestRoute) {
      finalResults.push(cheapestRoute);
    }

    let directAdded = false;
    if (directRoute && directRoute !== cheapestRoute && finalResults.length < 5) {
      finalResults.push(directRoute);
      directAdded = true;
    }

    for (const route of otherIntermediateRoutes) {
      if (finalResults.length >= 5) break;
      if (!directAdded || route.station !== directRoute?.station) {
        if (!finalResults.some(fr => fr.station === route.station && fr.fare === route.fare)) {
          finalResults.push(route);
        }
      }
    }

    if (finalResults.length === 0) {
      setError(t('errorNoRoutes'));
    } else {
      setResults(finalResults);
    }

    setCalculating(false);
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
    <>
      <Helmet key={i18n.language}>
        <html lang={i18n.language.split('-')[0]} />
        <meta name="description" content={t('metaDescription')} />
      </Helmet>

      {/* Modern gradient background */}
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          py: 4,
        }}
      >
        <Container maxWidth="lg">
          {/* Header with language toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography
              variant="h4"
              sx={{
                color: 'white',
                fontWeight: 700,
                textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              {currentPage === 'calculator' ? t('appTitle') : t('savingsPageTitle')}
            </Typography>
            <ToggleButtonGroup
              value={currentLanguage}
              exclusive
              onChange={handleLanguageChange}
              aria-label="language selection"
              size="small"
              sx={{
                backgroundColor: 'white',
                '& .MuiToggleButton-root': {
                  color: '#667eea',
                  borderColor: 'rgba(102, 126, 234, 0.3)',
                  '&.Mui-selected': {
                    backgroundColor: '#667eea',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#5568d3',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="en" aria-label="English">
                EN
              </ToggleButton>
              <ToggleButton value="zh-Hant" aria-label="Traditional Chinese">
                繁
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Navigation */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            {currentPage === 'calculator' ? (
              <Button
                variant="contained"
                onClick={navigateToSavings}
                startIcon={<TrendingDownIcon />}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {t('viewSavingsPageLink', 'View All Routes with Savings')}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={navigateToCalculator}
                startIcon={<DirectionsIcon />}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {t('backToCalculatorLink', 'Back to Fare Calculator')}
              </Button>
            )}
          </Box>

          {/* Calculator UI */}
          {currentPage === 'calculator' && (
            <Fade in timeout={500}>
              <Paper
                elevation={8}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  background: 'white',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}
              >
                {error && (
                  <Slide direction="down" in mountOnEnter unmountOnExit>
                    <Box
                      sx={{
                        mb: 3,
                        p: 2,
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: 2,
                        color: '#856404',
                      }}
                    >
                      <Typography align="center">{error}</Typography>
                    </Box>
                  </Slide>
                )}

                <Grid container spacing={3}>
                  {/* Station Selectors */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <StationSelector
                      value={startStation}
                      onChange={setStartStation}
                      label={t('startStationLabel')}
                      excludeStation={destStation}
                    />
                  </Grid>

                  <Grid
                    size={{ xs: 12, md: 6 }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {/* Swap button for mobile/desktop */}
                    <IconButton
                      onClick={() => {
                        const temp = startStation;
                        setStartStation(destStation);
                        setDestStation(temp);
                      }}
                      sx={{
                        position: { xs: 'static', md: 'absolute' },
                        left: { md: '-50%' },
                        transform: { xs: 'rotate(90deg)', md: 'translateX(-50%)' },
                        backgroundColor: 'white',
                        border: '2px solid #667eea',
                        color: '#667eea',
                        '&:hover': {
                          backgroundColor: '#667eea',
                          color: 'white',
                        },
                        mb: { xs: 2, md: 0 },
                      }}
                    >
                      <SwapHorizIcon />
                    </IconButton>
                    <Box sx={{ width: '100%', display: { xs: 'none', md: 'block' } }}>
                      <StationSelector
                        value={destStation}
                        onChange={setDestStation}
                        label={t('destStationLabel')}
                        excludeStation={startStation}
                      />
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }} sx={{ display: { xs: 'block', md: 'none' } }}>
                    <StationSelector
                      value={destStation}
                      onChange={setDestStation}
                      label={t('destStationLabel')}
                      excludeStation={startStation}
                    />
                  </Grid>

                  {/* Payment Method */}
                  <Grid size={{ xs: 12, md: 8 }}>
                    <FormControl fullWidth>
                      <InputLabel id="payment-method-label">{t('paymentMethodLabel')}</InputLabel>
                      <Select
                        labelId="payment-method-label"
                        value={paymentMethod}
                        onChange={handlePaymentMethodChange}
                        label={t('paymentMethodLabel')}
                      >
                        {paymentMethodOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {t(`paymentMethods.${option.value}`, option.label)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Calculate Button */}
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Button
                      variant="contained"
                      onClick={handleCalculate}
                      disabled={calculating || !startStation || !destStation}
                      fullWidth
                      size="large"
                      sx={{
                        height: '56px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        fontWeight: 600,
                        fontSize: '1rem',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5568d3 0%, #653a8b 100%)',
                        },
                      }}
                    >
                      {calculating ? <CircularProgress size={24} sx={{ color: 'white' }} /> : t('calculateButton')}
                    </Button>
                  </Grid>
                </Grid>

                {/* Results Display */}
                {results && results.length > 0 && (
                  <Fade in timeout={500}>
                    <Box sx={{ mt: 4 }}>
                      <Typography
                        variant="h5"
                        gutterBottom
                        sx={{
                          fontWeight: 600,
                          color: '#333',
                          mb: 3,
                        }}
                      >
                        {t('resultsTitle')}
                      </Typography>
                      <Stack spacing={2}>
                        {results.map((route, index) => {
                          const isDirect = route.station === null;
                          const displayStationName = route.station ? t(`stations.${route.station}`, route.station) : '';
                          const stationLines = route.station ? getLinesForStation(route.station) : [];

                          return (
                            <Slide key={index} direction="up" in timeout={300 + index * 100}>
                              <Card
                                elevation={route.isCheapest ? 4 : 2}
                                sx={{
                                  border: route.isCheapest ? '3px solid #4caf50' : '1px solid rgba(0,0,0,0.12)',
                                  position: 'relative',
                                  overflow: 'visible',
                                  transition: 'all 0.3s',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                                  },
                                }}
                              >
                                {route.isCheapest && (
                                  <Chip
                                    label={t('cheapestOptionLabel')}
                                    color="success"
                                    size="small"
                                    icon={<TrendingDownIcon />}
                                    sx={{
                                      position: 'absolute',
                                      top: -12,
                                      right: 16,
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                                <CardContent>
                                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                                        {isDirect ? (
                                          <Stack direction="row" alignItems="center" spacing={1}>
                                            <DirectionsIcon color="primary" />
                                            <span>{t('directRouteLabel')}</span>
                                          </Stack>
                                        ) : (
                                          <>
                                            {t('viaLabel')} {displayStationName}
                                          </>
                                        )}
                                      </Typography>
                                      {!isDirect && stationLines.length > 0 && (
                                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                                          {stationLines.map(line => (
                                            <Chip
                                              key={line.id}
                                              label={i18n.language.startsWith('zh') ? line.nameZh : line.nameEn}
                                              size="small"
                                              sx={{
                                                backgroundColor: line.color,
                                                color: line.textColor,
                                                fontWeight: 600,
                                                fontSize: '0.7rem',
                                                height: '20px',
                                              }}
                                            />
                                          ))}
                                        </Stack>
                                      )}
                                    </Box>
                                    <Typography
                                      variant="h4"
                                      sx={{
                                        fontWeight: 700,
                                        color: route.isCheapest ? '#4caf50' : isDirect ? '#1976d2' : '#666',
                                      }}
                                    >
                                      ${route.fare.toFixed(2)}
                                    </Typography>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Slide>
                          );
                        })}
                      </Stack>
                    </Box>
                  </Fade>
                )}
              </Paper>
            </Fade>
          )}

          {/* Savings Page */}
          {currentPage === 'savings' && <SavingsPage />}

          {/* Footer */}
          <Box sx={{ mt: 4, textAlign: 'center', color: 'white', opacity: 0.8 }}>
            <Typography variant="caption" display="block" gutterBottom>
              <a
                href="https://www.flaticon.com/free-icons/savings"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                Savings icons created by Freepik - Flaticon
              </a>
            </Typography>
            <Typography variant="caption" display="block">
              <a
                href="https://github.com/sdip15fa/mtr-fare-optimization"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                View on GitHub
              </a>
            </Typography>
          </Box>
        </Container>
      </Box>
    </>
  );
}

export default App;
