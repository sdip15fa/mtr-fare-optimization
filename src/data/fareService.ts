import Papa from 'papaparse';
import { MTR_LINES } from './mtrLines';

// Get East Rail Line stations dynamically from MTR line data
const EAST_RAIL_STATIONS = new Set(
  MTR_LINES.find(line => line.id === 'EAL')?.stations || []
);

// Check if both stations are on East Rail Line
function isEastRailRoute(srcStation: string, destStation: string): boolean {
  return EAST_RAIL_STATIONS.has(srcStation) && EAST_RAIL_STATIONS.has(destStation);
}

// Define the structure of a fare record (as it appears in CSV)
export interface FareRecord {
  SRC_STATION_NAME: string;
  SRC_STATION_ID: string;
  DEST_STATION_NAME: string;
  DEST_STATION_ID: string;
  OCT_ADT_FARE: number; // Adult Octopus
  OCT_STD_FARE: number; // Student Octopus
  OCT_JOYYOU_SIXTY_FARE: number; // JoyYou (60+) Octopus
  SINGLE_ADT_FARE: number; // Adult Single Journey
  OCT_CON_CHILD_FARE: number; // Child Octopus
  OCT_CON_ELDERLY_FARE: number; // Elderly Octopus
  OCT_CON_PWD_FARE: number; // PWD Octopus
  SINGLE_CON_CHILD_FARE: number; // Child Single Journey
  SINGLE_CON_ELDERLY_FARE: number; // Elderly Single Journey
}

// Define payment method types
export type PaymentMethod =
  | 'OCT_ADT_FARE'
  | 'OCT_STD_FARE'
  | 'OCT_JOYYOU_SIXTY_FARE'
  | 'SINGLE_ADT_FARE'
  | 'OCT_CON_CHILD_FARE'
  | 'OCT_CON_ELDERLY_FARE'
  | 'OCT_CON_PWD_FARE'
  | 'SINGLE_CON_CHILD_FARE'
  | 'SINGLE_CON_ELDERLY_FARE'
  | 'OCT_ADT_FIRST_FARE'
  | 'OCT_STD_FIRST_FARE'
  | 'OCT_JOYYOU_SIXTY_FIRST_FARE'
  | 'SINGLE_ADT_FIRST_FARE';

// Store the parsed data
let fareData: FareRecord[] = [];
let stationList: string[] = [];
let stationIdToNameMap: Map<string, string> = new Map(); // Map ID to Name
let fareMap: Map<string, number> = new Map(); // Key: "SRC_ID-DEST_ID-PAYMENT_METHOD", Value: Fare

// Function to load and parse the CSV data
export async function loadFareData(): Promise<void> {
  if (fareData.length > 0) {
    // Already loaded
    return;
  }

  try {
    const response = await fetch('/mtr_lines_fares.csv'); // Fetch from public folder
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse<any>(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // Automatically convert numbers
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('CSV Parsing Errors:', results.errors);
            reject(new Error('Failed to parse CSV data.'));
            return;
          }

          fareData = results.data as FareRecord[];

          // Extract unique station names
          const stations = new Set<string>();
          fareData.forEach(record => {
            stations.add(record.SRC_STATION_NAME);
            stations.add(record.DEST_STATION_NAME);
          });
          stationList = Array.from(stations).sort();

          // Populate station ID to Name map
          fareData.forEach(record => {
            if (!stationIdToNameMap.has(record.SRC_STATION_ID)) {
              stationIdToNameMap.set(record.SRC_STATION_ID, record.SRC_STATION_NAME);
            }
            if (!stationIdToNameMap.has(record.DEST_STATION_ID)) {
              stationIdToNameMap.set(record.DEST_STATION_ID, record.DEST_STATION_NAME);
            }
          });

          // Populate the fare map for quick lookups
          // First, add all standard fares from CSV
          const csvPaymentMethods: (keyof FareRecord)[] = [
            'OCT_ADT_FARE', 'OCT_STD_FARE', 'OCT_JOYYOU_SIXTY_FARE',
            'SINGLE_ADT_FARE', 'OCT_CON_CHILD_FARE', 'OCT_CON_ELDERLY_FARE',
            'OCT_CON_PWD_FARE', 'SINGLE_CON_CHILD_FARE', 'SINGLE_CON_ELDERLY_FARE'
          ];
          fareData.forEach(record => {
            csvPaymentMethods.forEach(method => {
              const key = `${record.SRC_STATION_ID}-${record.DEST_STATION_ID}-${method}`;
              const fare = record[method];
              // Ensure fare is treated as a number, handle potential null/undefined from parsing
              fareMap.set(key, typeof fare === 'number' ? fare : 0);
            });
          });

          // Calculate and add first class fares (2x standard fare for East Rail routes only)
          const firstClassMapping: { first: PaymentMethod; standard: keyof FareRecord }[] = [
            { first: 'OCT_ADT_FIRST_FARE', standard: 'OCT_ADT_FARE' },
            { first: 'OCT_STD_FIRST_FARE', standard: 'OCT_STD_FARE' },
            { first: 'OCT_JOYYOU_SIXTY_FIRST_FARE', standard: 'OCT_JOYYOU_SIXTY_FARE' },
            { first: 'SINGLE_ADT_FIRST_FARE', standard: 'SINGLE_ADT_FARE' }
          ];

          fareData.forEach(record => {
            const isEastRail = isEastRailRoute(record.SRC_STATION_NAME, record.DEST_STATION_NAME);

            firstClassMapping.forEach(({ first, standard }) => {
              const key = `${record.SRC_STATION_ID}-${record.DEST_STATION_ID}-${first}`;
              const standardFare = record[standard];

              if (isEastRail && typeof standardFare === 'number') {
                // First class = 2x standard fare for East Rail routes
                fareMap.set(key, standardFare * 2);
              } else {
                // Not available for non-East Rail routes
                fareMap.set(key, 0);
              }
            });
          });

          console.log(`Loaded ${fareData.length} fare records.`);
          console.log(`Found ${stationList.length} unique stations.`);
          resolve();
        },
        error: (error: Error) => {
          console.error('CSV Parsing Failed:', error);
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Failed to fetch or load fare data:', error);
    throw error; // Re-throw after logging
  }
}

// Function to get the list of stations
export function getStationList(): string[] {
  return stationList;
}

// Function to get the station name from its ID
export function getStationName(stationId: string): string | undefined {
    return stationIdToNameMap.get(stationId);
}

// Function to get the station ID from its name
export function getStationId(stationName: string): string | undefined {
    // Find the first record matching the station name to get its ID
    const record = fareData.find(r => r.SRC_STATION_NAME === stationName || r.DEST_STATION_NAME === stationName);
    // Prefer SRC_STATION_ID if it matches, otherwise use DEST_STATION_ID
    if (record?.SRC_STATION_NAME === stationName) return record.SRC_STATION_ID;
    if (record?.DEST_STATION_NAME === stationName) return record.DEST_STATION_ID;
    return undefined;
}


// Mapping from first class to standard fare payment methods
const firstClassToStandardMap: Record<string, PaymentMethod> = {
  'OCT_ADT_FIRST_FARE': 'OCT_ADT_FARE',
  'OCT_STD_FIRST_FARE': 'OCT_STD_FARE',
  'OCT_JOYYOU_SIXTY_FIRST_FARE': 'OCT_JOYYOU_SIXTY_FARE',
  'SINGLE_ADT_FIRST_FARE': 'SINGLE_ADT_FARE'
};

// Function to get the fare between two stations for a specific payment method
// For first class payment methods: uses first class fare if available (East Rail Line),
// otherwise falls back to corresponding standard fare for non-EAL segments
export function getFare(
  startStationId: string,
  destStationId: string,
  paymentMethod: PaymentMethod
): number | undefined {
  const key = `${startStationId}-${destStationId}-${paymentMethod}`;
  const fare = fareMap.get(key);

  // If first class payment method is selected but fare is 0 (not available on this segment),
  // fall back to the corresponding standard fare
  const isFirstClass = paymentMethod.includes('FIRST');
  if (isFirstClass && fare === 0) {
    const standardMethod = firstClassToStandardMap[paymentMethod];
    if (standardMethod) {
      const standardKey = `${startStationId}-${destStationId}-${standardMethod}`;
      return fareMap.get(standardKey);
    }
  }

  return fare;
}

// Function to get all fare records (useful for brute-force)
export function getAllFareRecords(): FareRecord[] {
    return fareData;
}
