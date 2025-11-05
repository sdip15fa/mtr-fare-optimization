import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Box,
  Alert,
  TableSortLabel,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Card,
  Fade,
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {
  loadFareData,
  getFare,
  getStationName,
  getAllFareRecords,
  PaymentMethod,
} from '../data/fareService';
import { getLinesForStation } from '../data/mtrLines';

interface SavingInfo {
  startStationId: string;
  startStationName: string;
  destStationId: string;
  destStationName: string;
  intermediateStationId: string;
  intermediateStationName: string;
  directFare: number;
  intermediateFare: number;
  saving: number;
}

type Order = 'asc' | 'desc';
type SortableColumn = keyof SavingInfo;

// Helper function for stable sorting
function stableSort<T>(array: readonly T[], comparator: (a: T, b: T) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) {
      return order;
    }
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (
  a: { [key in Key]: number | string },
  b: { [key in Key]: number | string },
) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (typeof a[orderBy] === 'string' && typeof b[orderBy] === 'string') {
    return (b[orderBy] as string).localeCompare(a[orderBy] as string);
  }
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

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

const SavingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [savings, setSavings] = useState<SavingInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<SortableColumn>('saving');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('OCT_ADT_FARE');

  useEffect(() => {
    const calculateSavings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await loadFareData();
        const allRecords = getAllFareRecords();
        if (!allRecords || allRecords.length === 0) {
          throw new Error('No fare records available after loading.');
        }

        const uniqueStationIds = new Set<string>();
        allRecords.forEach(record => {
          uniqueStationIds.add(record.SRC_STATION_ID);
          uniqueStationIds.add(record.DEST_STATION_ID);
        });
        const stationIdList = Array.from(uniqueStationIds);

        console.log(`Calculating savings for ${stationIdList.length} stations...`);

        const calculatedSavings: SavingInfo[] = [];

        for (let i = 0; i < stationIdList.length; i++) {
          for (let j = 0; j < stationIdList.length; j++) {
            if (i === j) continue;

            const startStationId = stationIdList[i];
            const destStationId = stationIdList[j];

            const directFare = getFare(startStationId, destStationId, paymentMethod);

            if (directFare === undefined || directFare === 0) {
              continue;
            }

            let minIntermediateFare = Infinity;
            let optimalIntermediateStationId: string | null = null;

            for (let k = 0; k < stationIdList.length; k++) {
              if (k === i || k === j) continue;

              const intermediateStationId = stationIdList[k];

              const fare1 = getFare(startStationId, intermediateStationId, paymentMethod);
              const fare2 = getFare(intermediateStationId, destStationId, paymentMethod);

              if (fare1 !== undefined && fare2 !== undefined) {
                const totalIntermediateFare = fare1 + fare2;
                if (totalIntermediateFare < minIntermediateFare) {
                  minIntermediateFare = totalIntermediateFare;
                  optimalIntermediateStationId = intermediateStationId;
                }
              }
            }

            if (optimalIntermediateStationId !== null && minIntermediateFare < directFare) {
              const saving = directFare - minIntermediateFare;
              if (saving > 0.01) {
                const startName = getStationName(startStationId) || `ID: ${startStationId}`;
                const destName = getStationName(destStationId) || `ID: ${destStationId}`;
                const intermediateName = getStationName(optimalIntermediateStationId) || `ID: ${optimalIntermediateStationId}`;

                calculatedSavings.push({
                  startStationId,
                  startStationName: startName,
                  destStationId,
                  destStationName: destName,
                  intermediateStationId: optimalIntermediateStationId,
                  intermediateStationName: intermediateName,
                  directFare: directFare,
                  intermediateFare: minIntermediateFare,
                  saving: saving,
                });
              }
            }
          }
        }

        setSavings(calculatedSavings);
        console.log(`Found ${calculatedSavings.length} routes with savings.`);

      } catch (err) {
        console.error('Error calculating savings:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    calculateSavings();
  }, [paymentMethod]);

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: SortableColumn,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handlePaymentMethodChange = (event: SelectChangeEvent<PaymentMethod>) => {
    setPaymentMethod(event.target.value as PaymentMethod);
  };

  const sortedSavings = useMemo(() => {
    return stableSort(savings, getComparator(order, orderBy));
  }, [savings, order, orderBy]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', p: 2 }}>
        <CircularProgress sx={{ color: 'white' }} />
        <Typography sx={{ ml: 2, color: 'white' }}>
          {t('savings.calculating', 'Calculating Savings...')}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {t('savings.error', 'Error loading or calculating savings:')} {error}
      </Alert>
    );
  }

  interface HeadCell {
    id: SortableColumn;
    label: string;
    numeric: boolean;
  }

  const headCells: readonly HeadCell[] = [
    { id: 'startStationName', numeric: false, label: 'savings.header.from' },
    { id: 'destStationName', numeric: false, label: 'savings.header.to' },
    { id: 'intermediateStationName', numeric: false, label: 'savings.header.via' },
    { id: 'directFare', numeric: true, label: 'savings.header.directFare' },
    { id: 'intermediateFare', numeric: true, label: 'savings.header.splitFare' },
    { id: 'saving', numeric: true, label: 'savings.header.saving' },
  ];

  const currentLanguage = i18n.language.startsWith('zh') ? 'zh' : 'en';

  return (
    <Fade in timeout={500}>
      <Box>
        {/* Payment Method Selector */}
        <Card
          elevation={8}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            background: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TrendingDownIcon sx={{ fontSize: 40, color: '#4caf50' }} />
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                {t('savings.filterTitle', 'Filter by Payment Method')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('savings.totalRoutes', `${sortedSavings.length} routes with savings found`)}
              </Typography>
            </Box>
            <FormControl sx={{ minWidth: 250 }}>
              <InputLabel id="savings-payment-method-label">
                {t('paymentMethodLabel')}
              </InputLabel>
              <Select
                labelId="savings-payment-method-label"
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
          </Stack>
        </Card>

        {/* Savings Table */}
        {sortedSavings.length === 0 ? (
          <Card
            elevation={8}
            sx={{
              p: 4,
              borderRadius: 3,
              background: 'white',
              textAlign: 'center',
            }}
          >
            <Typography color="text.secondary">
              {t('savings.noSavingsFound', 'No routes with significant savings found for the selected payment method.')}
            </Typography>
          </Card>
        ) : (
          <TableContainer
            component={Paper}
            elevation={8}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          >
            <Table sx={{ minWidth: 750 }} aria-label="savings table" size="small">
              <TableHead>
                <TableRow
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                >
                  {headCells.map((headCell) => (
                    <TableCell
                      key={headCell.id}
                      align={headCell.numeric ? 'right' : 'left'}
                      padding="normal"
                      sortDirection={orderBy === headCell.id ? order : false}
                      sx={{
                        fontWeight: 700,
                        color: 'white',
                        fontSize: '0.9rem',
                      }}
                    >
                      <TableSortLabel
                        active={orderBy === headCell.id}
                        direction={orderBy === headCell.id ? order : 'asc'}
                        onClick={(event) => handleRequestSort(event, headCell.id)}
                        sx={{
                          '&.MuiTableSortLabel-root': {
                            color: 'white',
                          },
                          '&.MuiTableSortLabel-root:hover': {
                            color: 'rgba(255, 255, 255, 0.8)',
                          },
                          '&.Mui-active': {
                            color: 'white',
                          },
                          '& .MuiTableSortLabel-icon': {
                            color: 'white !important',
                          },
                        }}
                      >
                        {t(headCell.label, headCell.id)}
                        {orderBy === headCell.id ? (
                          <Box component="span" sx={visuallyHidden}>
                            {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                          </Box>
                        ) : null}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedSavings.map((row, index) => {
                  const startLines = getLinesForStation(row.startStationName);
                  const destLines = getLinesForStation(row.destStationName);
                  const intermediateLines = getLinesForStation(row.intermediateStationName);

                  return (
                    <TableRow
                      hover
                      key={`${row.startStationId}-${row.destStationId}-${row.intermediateStationId}-${index}`}
                      sx={{
                        '&:nth-of-type(odd)': { backgroundColor: 'rgba(102, 126, 234, 0.02)' },
                        '&:hover': {
                          backgroundColor: 'rgba(102, 126, 234, 0.08)',
                          transition: 'background-color 0.2s',
                        },
                      }}
                    >
                      <TableCell component="th" scope="row">
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {t(`stations.${row.startStationName}`, row.startStationName)}
                          </Typography>
                          {startLines.length > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                              {startLines.map(line => (
                                <Chip
                                  key={line.id}
                                  label={currentLanguage === 'zh' ? line.nameZh : line.nameEn}
                                  size="small"
                                  sx={{
                                    backgroundColor: line.color,
                                    color: line.textColor,
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    height: '18px',
                                  }}
                                />
                              ))}
                            </Stack>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {t(`stations.${row.destStationName}`, row.destStationName)}
                          </Typography>
                          {destLines.length > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                              {destLines.map(line => (
                                <Chip
                                  key={line.id}
                                  label={currentLanguage === 'zh' ? line.nameZh : line.nameEn}
                                  size="small"
                                  sx={{
                                    backgroundColor: line.color,
                                    color: line.textColor,
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    height: '18px',
                                  }}
                                />
                              ))}
                            </Stack>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={600} color="primary">
                            {t(`stations.${row.intermediateStationName}`, row.intermediateStationName)}
                          </Typography>
                          {intermediateLines.length > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                              {intermediateLines.map(line => (
                                <Chip
                                  key={line.id}
                                  label={currentLanguage === 'zh' ? line.nameZh : line.nameEn}
                                  size="small"
                                  sx={{
                                    backgroundColor: line.color,
                                    color: line.textColor,
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    height: '18px',
                                  }}
                                />
                              ))}
                            </Stack>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          ${row.directFare.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          ${row.intermediateFare.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          icon={<TrendingDownIcon sx={{ fontSize: '0.9rem' }} />}
                          label={`$${row.saving.toFixed(2)}`}
                          size="small"
                          sx={{
                            backgroundColor: '#4caf50',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Fade>
  );
};

export default SavingsPage;
