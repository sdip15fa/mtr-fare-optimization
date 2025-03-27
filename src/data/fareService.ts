import Papa from 'papaparse';

// Define the structure of a fare record
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
  | 'SINGLE_CON_ELDERLY_FARE';

// Store the parsed data
let fareData: FareRecord[] = [];
let stationList: string[] = [];
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

          // Populate the fare map for quick lookups (consider all payment methods)
          const paymentMethods: PaymentMethod[] = [
            'OCT_ADT_FARE', 'OCT_STD_FARE', 'OCT_JOYYOU_SIXTY_FARE',
            'SINGLE_ADT_FARE', 'OCT_CON_CHILD_FARE', 'OCT_CON_ELDERLY_FARE',
            'OCT_CON_PWD_FARE', 'SINGLE_CON_CHILD_FARE', 'SINGLE_CON_ELDERLY_FARE'
          ];
          fareData.forEach(record => {
            paymentMethods.forEach(method => {
              const key = `${record.SRC_STATION_ID}-${record.DEST_STATION_ID}-${method}`;
              const fare = record[method];
              // Ensure fare is treated as a number, handle potential null/undefined from parsing
              fareMap.set(key, typeof fare === 'number' ? fare : 0);
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

// Function to get the station ID from its name
export function getStationId(stationName: string): string | undefined {
    // Find the first record matching the station name to get its ID
    const record = fareData.find(r => r.SRC_STATION_NAME === stationName || r.DEST_STATION_NAME === stationName);
    // Prefer SRC_STATION_ID if it matches, otherwise use DEST_STATION_ID
    if (record?.SRC_STATION_NAME === stationName) return record.SRC_STATION_ID;
    if (record?.DEST_STATION_NAME === stationName) return record.DEST_STATION_ID;
    return undefined;
}


// Function to get the fare between two stations for a specific payment method
export function getFare(
  startStationId: string,
  destStationId: string,
  paymentMethod: PaymentMethod
): number | undefined {
  const key = `${startStationId}-${destStationId}-${paymentMethod}`;
  return fareMap.get(key);
}

// Function to get all fare records (useful for brute-force)
export function getAllFareRecords(): FareRecord[] {
    return fareData;
}
