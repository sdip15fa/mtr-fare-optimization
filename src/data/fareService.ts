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

// First class fare calculation types and functions
export type StationRegion = 'HK_ISLAND' | 'KOWLOON' | 'NEW_TERRITORIES';

export function getStationRegion(stationName: string): StationRegion {
  if (isHongKongIslandStation(stationName)) {
    return 'HK_ISLAND';
  } else if (isKowloonStation(stationName)) {
    return 'KOWLOON';
  } else {
    return 'NEW_TERRITORIES';
  }
}

export function calculateFirstClassSurcharge(
  startStation: string,
  destStation: string,
  paymentMethod: PaymentMethod
): number {
  const startRegion = getStationRegion(startStation);
  const destRegion = getStationRegion(destStation);
  
  // Get station IDs
  const startId = getStationId(startStation);
  const destId = getStationId(destStation);
  const taiWaiId = getStationId('Tai Wai');
  const hungHomId = getStationId('Hung Hom');
  const admiraltyId = getStationId('Admiralty');
  
  if (!startId || !destId || !taiWaiId || !hungHomId || !admiraltyId) {
    return 0;
  }

  // Rule 1: One end on EAL NT station, other end on non-EAL Kowloon/NT station
  if ((startRegion === 'NEW_TERRITORIES' && destRegion !== 'HK_ISLAND') ||
      (destRegion === 'NEW_TERRITORIES' && startRegion !== 'HK_ISLAND')) {
    // Get fare from NT station to Tai Wai
    const ntStation = startRegion === 'NEW_TERRITORIES' ? startId : destId;
    const surcharge = getFare(ntStation, taiWaiId, 'OCT_ADT_FARE') || 0;
    return surcharge;
  }

  // Rule 2: Both ends in Kowloon/NT, no EAL/TML stations involved
  if (startRegion !== 'HK_ISLAND' && destRegion !== 'HK_ISLAND') {
    return 4.0; // Minimum standard adult Octopus fare
  }

  // Rule 3: One end on HK Island
  if (startRegion === 'HK_ISLAND' || destRegion === 'HK_ISLAND') {
    // Sub-rule 3a: Other end in Kowloon
    if (startRegion === 'KOWLOON' || destRegion === 'KOWLOON') {
      const surcharge = getFare(admiraltyId, hungHomId, 'OCT_ADT_FARE') || 0;
      return surcharge;
    }
    // Sub-rule 3b: Other end in TML Hin Keng to Wu Kai Sha
    const surcharge = getFare(admiraltyId, taiWaiId, 'OCT_ADT_FARE') || 0;
    return surcharge;
  }

  return 0;
}

// Helper function to check if a journey is entirely on East Rail Line
function isEastRailLineJourney(startStation: string, destStation: string): boolean {
  const eastRailStations = [
    "Admiralty",
    "Exhibition Centre",
    "Hung Hom",
    "Mong Kok East",
    "Kowloon Tong",
    "Tai Wai",
    "Sha Tin",
    "Fo Tan",
    "Racecourse",
    "University",
    "Tai Po Market",
    "Tai Wo",
    "Fanling",
    "Sheung Shui",
    "Lo Wu",
    "Lok Ma Chau"
  ];
  return eastRailStations.includes(startStation) && eastRailStations.includes(destStation);
}

export function calculateFirstClassFare(
  startStation: string,
  destStation: string,
  paymentMethod: PaymentMethod
): number {
  const baseFare = getFare(getStationId(startStation) || '', getStationId(destStation) || '', paymentMethod) || 0;
  const childFare = getFare(getStationId(startStation) || '', getStationId(destStation) || '', 'OCT_CON_CHILD_FARE') || 0;
  
  // Check if journey is entirely on East Rail Line
  if (isEastRailLineJourney(startStation, destStation)) {
    // For East Rail Line journeys, first class fare is twice the standard fare
    if (paymentMethod === 'OCT_STD_FARE') {
      // Student: Base fare + Adult standard fare surcharge
      return baseFare + baseFare;
    } else if (paymentMethod === 'OCT_JOYYOU_SIXTY_FARE') {
      // JoyYou 60+: $2 + Adult standard fare surcharge
      return 2 + baseFare;
    } else if (paymentMethod === 'OCT_CON_ELDERLY_FARE' || paymentMethod === 'OCT_CON_PWD_FARE') {
      // Elderly/PWD: $2 + Child standard fare surcharge
      return 2 + childFare;
    } else if (paymentMethod === 'OCT_CON_CHILD_FARE' || paymentMethod === 'SINGLE_CON_CHILD_FARE') {
      // Child: Base fare + Child standard fare surcharge
      return baseFare + childFare;
    } else {
      // Regular fare: Base fare + Base fare (double the standard fare)
      return baseFare + baseFare;
    }
  }

  // For non-East Rail Line journeys, use the original surcharge calculation
  const surcharge = calculateFirstClassSurcharge(startStation, destStation, paymentMethod);
  
  // Apply special rules for different passenger categories
  if (paymentMethod === 'OCT_STD_FARE') {
    // Student: Base fare + Adult standard fare surcharge
    return baseFare + surcharge;
  } else if (paymentMethod === 'OCT_JOYYOU_SIXTY_FARE') {
    // JoyYou 60+: $2 + Adult standard fare surcharge
    return 2 + surcharge;
  } else if (paymentMethod === 'OCT_CON_ELDERLY_FARE' || paymentMethod === 'OCT_CON_PWD_FARE') {
    // Elderly/PWD: $2 + Child standard fare surcharge
    return 2 + childFare;
  } else if (paymentMethod === 'OCT_CON_CHILD_FARE' || paymentMethod === 'SINGLE_CON_CHILD_FARE') {
    // Child: Base fare + Child standard fare surcharge
    return baseFare + childFare;
  } else {
    // Regular fare + surcharge
    return baseFare + surcharge;
  }
}

// Station region helper functions
export function isHongKongIslandStation(stationName: string): boolean {
  const hkIslandStations: string[] = [
    // Island Line
    "Kennedy Town", "HKU", "Sai Ying Pun", "Sheung Wan", "Central",
    "Admiralty", "Wan Chai", "Causeway Bay", "Tin Hau", "Fortress Hill",
    "North Point", "Quarry Bay", "Tai Koo", "Sai Wan Ho", "Shau Kei Wan",
    "Heng Fa Chuen", "Chai Wan",
    // South Island Line
    "Ocean Park", "Wong Chuk Hang", "Lei Tung", "South Horizons",
    // Tung Chung Line / Airport Express
    "Hong Kong",
    // East Rail Line
    "Exhibition Centre"
  ];
  return hkIslandStations.includes(stationName);
}

export function isKowloonStation(stationName: string): boolean {
  const kowloonStations: string[] = [
    // Kwun Tong Line
    "Whampoa", "Ho Man Tin", "Yau Ma Tei", "Mong Kok", "Prince Edward",
    "Shek Kip Mei", "Kowloon Tong", "Lok Fu", "Wong Tai Sin",
    "Diamond Hill", "Choi Hung", "Kowloon Bay", "Ngau Tau Kok",
    "Kwun Tong", "Lam Tin", "Yau Tong",
    // Tsuen Wan Line
    "Tsim Sha Tsui", "Jordan", "Sham Shui Po", "Cheung Sha Wan",
    "Lai Chi Kok", "Mei Foo",
    // Tuen Ma Line
    "Kai Tak", "Sung Wong Toi", "To Kwa Wan", "Hung Hom",
    "East Tsim Sha Tsui", "Austin", "Nam Cheong",
    // East Rail Line
    "Mong Kok East",
    // Tung Chung Line / Airport Express
    "Kowloon", "Olympic"
  ];
  return kowloonStations.includes(stationName);
}
