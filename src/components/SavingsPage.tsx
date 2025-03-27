import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { useTranslation } from 'react-i18next'; // Import useTranslation
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
    TableSortLabel // Added for sorting
} from '@mui/material';
import { visuallyHidden } from '@mui/utils'; // Added for sorting accessibility
import {
    loadFareData,
    getFare,
    getStationName,
    getAllFareRecords,
    PaymentMethod,
} from '../data/fareService';

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
        return a[1] - b[1]; // Stabilize by original index if equal
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
    // Handle string comparison
    if (typeof a[orderBy] === 'string' && typeof b[orderBy] === 'string') {
        return (b[orderBy] as string).localeCompare(a[orderBy] as string);
    }
    // Handle number comparison (default)
    if (b[orderBy] < a[orderBy]) {
        return -1;
    }
    if (b[orderBy] > a[orderBy]) {
        return 1;
    }
    return 0;
}


// --- Configuration ---
const PAYMENT_METHOD_TO_ANALYZE: PaymentMethod = 'OCT_ADT_FARE'; // Or allow selection
// ---

const SavingsPage: React.FC = () => {
    const { t } = useTranslation(); // Translation hook
    const [savings, setSavings] = useState<SavingInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [order, setOrder] = useState<Order>('desc'); // Default sort order
    const [orderBy, setOrderBy] = useState<SortableColumn>('saving'); // Default sort column

    useEffect(() => {
        const calculateSavings = async () => {
            setIsLoading(true);
            setError(null); // Reset error on recalculate
            try {
                await loadFareData(); // Ensure data is loaded
                const allRecords = getAllFareRecords();
                if (!allRecords || allRecords.length === 0) {
                    throw new Error("No fare records available after loading.");
                }

                // Get unique station IDs from the loaded data
                const uniqueStationIds = new Set<string>();
                 allRecords.forEach(record => {
                    uniqueStationIds.add(record.SRC_STATION_ID);
                    uniqueStationIds.add(record.DEST_STATION_ID);
                });
                const stationIdList = Array.from(uniqueStationIds);
                // setStationIds(stationIdList); // This line was removed as it caused an error

                console.log(`Calculating savings for ${stationIdList.length} stations...`);

                const calculatedSavings: SavingInfo[] = [];

                // Iterate through all permutations of station pairs
                for (let i = 0; i < stationIdList.length; i++) {
                    for (let j = 0; j < stationIdList.length; j++) {
                        if (i === j) continue; // Skip same start/end station

                        const startStationId = stationIdList[i];
                        const destStationId = stationIdList[j];

                        const directFare = getFare(startStationId, destStationId, PAYMENT_METHOD_TO_ANALYZE);

                        if (directFare === undefined || directFare === 0) { // Skip if no direct fare or free
                            continue;
                        }

                        let minIntermediateFare = Infinity;
                        let optimalIntermediateStationId: string | null = null;

                        // Iterate through potential intermediate stations
                        for (let k = 0; k < stationIdList.length; k++) {
                            if (k === i || k === j) continue; // Skip start/end station

                            const intermediateStationId = stationIdList[k];

                            const fare1 = getFare(startStationId, intermediateStationId, PAYMENT_METHOD_TO_ANALYZE);
                            const fare2 = getFare(intermediateStationId, destStationId, PAYMENT_METHOD_TO_ANALYZE);

                            if (fare1 !== undefined && fare2 !== undefined) {
                                const totalIntermediateFare = fare1 + fare2;
                                if (totalIntermediateFare < minIntermediateFare) {
                                    minIntermediateFare = totalIntermediateFare;
                                    optimalIntermediateStationId = intermediateStationId;
                                }
                            }
                        }

                        // Check if the optimal intermediate route offers savings
                        if (optimalIntermediateStationId !== null && minIntermediateFare < directFare) {
                            const saving = directFare - minIntermediateFare;
                            // Ensure saving is significant (e.g., more than a fraction of a cent)
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
                     // Optional: Log progress
                    // if (i % 10 === 0) {
                    //     console.log(`Processed start station ${i + 1}/${stationIdList.length}`);
                    // }
                }

                // Initial sort is done later using useMemo based on state
                setSavings(calculatedSavings);
                console.log(`Found ${calculatedSavings.length} routes with savings.`);

            } catch (err) {
                console.error("Error calculating savings:", err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setIsLoading(false);
            }
        };

        calculateSavings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]); // Re-run if language changes to potentially reload station names? (Though getStationName should handle it)

    const handleRequestSort = (
        event: React.MouseEvent<unknown>,
        property: SortableColumn,
    ) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    // Memoize the sorted savings data
    const sortedSavings = useMemo(() => {
        return stableSort(savings, getComparator(order, orderBy));
    }, [savings, order, orderBy]);


    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', p: 2 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>{t('savings.calculating', 'Calculating Savings...')}</Typography>
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{t('savings.error', 'Error loading or calculating savings:')} {error}</Alert>;
    }

    // Define table headers
    interface HeadCell {
        id: SortableColumn;
        label: string; // Translation key
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


    return (
        <Box sx={{ p: 2 }}>
            {/* Title is now handled in App.tsx */}
            {/* <Typography variant="h4" gutterBottom>
                {t('savingsPageTitle', 'Routes with Savings')} ({PAYMENT_METHOD_TO_ANALYZE})
            </Typography> */}
            {sortedSavings.length === 0 ? (
                <Typography>{t('savings.noSavingsFound', 'No routes with significant savings found for the selected payment method.')}</Typography>
            ) : (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                    <Table sx={{ minWidth: 750 }} aria-label="savings table" size="small">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                                {headCells.map((headCell) => (
                                    <TableCell
                                        key={headCell.id}
                                        align={headCell.numeric ? 'right' : 'left'}
                                        padding={'normal'}
                                        sortDirection={orderBy === headCell.id ? order : false}
                                        sx={{ fontWeight: 'bold' }}
                                    >
                                        <TableSortLabel
                                            active={orderBy === headCell.id}
                                            direction={orderBy === headCell.id ? order : 'asc'}
                                            onClick={(event) => handleRequestSort(event, headCell.id)}
                                        >
                                            {t(headCell.label, headCell.id)} {/* Translate header */}
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
                            {sortedSavings.map((row, index) => ( // Use sortedSavings
                                <TableRow
                                    hover // Add hover effect
                                    key={`${row.startStationId}-${row.destStationId}-${row.intermediateStationId}-${index}`} // More unique key
                                    sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}
                                >
                                    {/* Translate station names using the 'stations.' prefix */}
                                    <TableCell component="th" scope="row">
                                        {t(`stations.${row.startStationName}`, row.startStationName)}
                                    </TableCell>
                                    <TableCell>{t(`stations.${row.destStationName}`, row.destStationName)}</TableCell>
                                    <TableCell>{t(`stations.${row.intermediateStationName}`, row.intermediateStationName)}</TableCell>
                                    <TableCell align="right">{row.directFare.toFixed(2)}</TableCell>
                                    <TableCell align="right">{row.intermediateFare.toFixed(2)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'green' }}>
                                        {row.saving.toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default SavingsPage;
