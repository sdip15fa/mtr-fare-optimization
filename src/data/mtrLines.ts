// MTR Lines Data Structure with Official Colors and Station Organization
// Station data is loaded from official MTR open data CSV

import Papa from 'papaparse';

export interface MTRLine {
  id: string;
  nameEn: string;
  nameZh: string;
  color: string;
  textColor: string; // For contrast on colored backgrounds
  stations: string[]; // Station names in order
}

interface StationCSVRow {
  'Line Code': string;
  'Direction': string;
  'Station Code': string;
  'Station ID': string;
  'Chinese Name': string;
  'English Name': string;
  'Sequence': string;
}

// Line metadata (colors and names)
const LINE_METADATA: Record<string, Omit<MTRLine, 'stations'>> = {
  ISL: {
    id: 'ISL',
    nameEn: 'Island Line',
    nameZh: '港島綫',
    color: '#0860A8',
    textColor: '#FFFFFF',
  },
  TWL: {
    id: 'TWL',
    nameEn: 'Tsuen Wan Line',
    nameZh: '荃灣綫',
    color: '#E2231A',
    textColor: '#FFFFFF',
  },
  KTL: {
    id: 'KTL',
    nameEn: 'Kwun Tong Line',
    nameZh: '觀塘綫',
    color: '#00A040',
    textColor: '#FFFFFF',
  },
  TKL: {
    id: 'TKL',
    nameEn: 'Tseung Kwan O Line',
    nameZh: '將軍澳綫',
    color: '#7D3F98',
    textColor: '#FFFFFF',
  },
  TML: {
    id: 'TML',
    nameEn: 'Tuen Ma Line',
    nameZh: '屯馬綫',
    color: '#9C5B3F',
    textColor: '#FFFFFF',
  },
  EAL: {
    id: 'EAL',
    nameEn: 'East Rail Line',
    nameZh: '東鐵綫',
    color: '#5EB7E8',
    textColor: '#000000',
  },
  TCL: {
    id: 'TCL',
    nameEn: 'Tung Chung Line',
    nameZh: '東涌綫',
    color: '#F7943E',
    textColor: '#000000',
  },
  SIL: {
    id: 'SIL',
    nameEn: 'South Island Line',
    nameZh: '南港島綫',
    color: '#CBD300',
    textColor: '#000000',
  },
  DRL: {
    id: 'DRL',
    nameEn: 'Disneyland Resort Line',
    nameZh: '迪士尼綫',
    color: '#EB6EA5',
    textColor: '#FFFFFF',
  },
  AEL: {
    id: 'AEL',
    nameEn: 'Airport Express',
    nameZh: '機場快綫',
    color: '#00888E',
    textColor: '#FFFFFF',
  },
};

// Initialize MTR_LINES with metadata and empty stations
export let MTR_LINES: MTRLine[] = Object.values(LINE_METADATA).map(metadata => ({
  ...metadata,
  stations: [],
}));

// Create a map of station to lines for quick lookup
export const stationToLinesMap = new Map<string, MTRLine[]>();

// Track if data has been loaded
let isDataLoaded = false;

// Load station data from CSV
export async function loadStationData(): Promise<void> {
  if (isDataLoaded) {
    return;
  }

  try {
    const response = await fetch('/mtr_lines_and_stations.csv');
    const csvText = await response.text();

    const parseResult = Papa.parse<StationCSVRow>(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    // Group stations by line code and direction
    const lineStationsMap = new Map<string, Map<string, Array<{ station: string; sequence: number }>>>();

    parseResult.data.forEach((row) => {
      const lineCode = row['Line Code'];
      const direction = row['Direction'];
      const stationName = row['English Name'];
      const sequence = parseFloat(row['Sequence']);

      if (!lineStationsMap.has(lineCode)) {
        lineStationsMap.set(lineCode, new Map());
      }

      const lineMap = lineStationsMap.get(lineCode)!;
      if (!lineMap.has(direction)) {
        lineMap.set(direction, []);
      }

      lineMap.get(direction)!.push({ station: stationName, sequence });
    });

    // Build the MTR_LINES array with loaded station data
    MTR_LINES = Object.values(LINE_METADATA).map(metadata => {
      const lineId = metadata.id;
      const lineDirections = lineStationsMap.get(lineId);

      let stations: string[] = [];

      if (lineDirections) {
        // Find the direction with sequence starting from 1 (typically DT or base direction)
        let selectedDirection: Array<{ station: string; sequence: number }> | undefined;

        lineDirections.forEach((stationsData) => {
          if (!selectedDirection) {
            const sortedStations = stationsData.sort((a, b) => a.sequence - b.sequence);
            if (sortedStations.length > 0 && sortedStations[0].sequence === 1) {
              selectedDirection = sortedStations;
            }
          }
        });

        // If no direction starts with sequence 1, just take the first one
        if (!selectedDirection && lineDirections.size > 0) {
          selectedDirection = Array.from(lineDirections.values())[0].sort((a, b) => a.sequence - b.sequence);
        }

        if (selectedDirection) {
          stations = selectedDirection.map(s => s.station);
        }
      }

      return {
        ...metadata,
        stations,
      };
    });

    // Rebuild the station to lines map
    stationToLinesMap.clear();
    MTR_LINES.forEach(line => {
      line.stations.forEach(station => {
        if (!stationToLinesMap.has(station)) {
          stationToLinesMap.set(station, []);
        }
        stationToLinesMap.get(station)!.push(line);
      });
    });

    isDataLoaded = true;
  } catch (error) {
    console.error('Failed to load station data:', error);
    throw error;
  }
}

// Get all unique stations across all lines
export const getAllStations = (): string[] => {
  const uniqueStations = new Set<string>();
  MTR_LINES.forEach(line => {
    line.stations.forEach(station => uniqueStations.add(station));
  });
  return Array.from(uniqueStations).sort();
};

// Get lines for a specific station
export const getLinesForStation = (station: string): MTRLine[] => {
  return stationToLinesMap.get(station) || [];
};
