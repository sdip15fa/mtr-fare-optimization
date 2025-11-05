// MTR Lines Data Structure with Official Colors and Station Organization
// Station data is loaded from official MTR open data CSV

import Papa from 'papaparse';

export interface MTRLine {
  id: string;
  nameEn: string;
  nameZh: string;
  color: string;
  textColor: string; // For contrast on colored backgrounds
  stations: string[]; // Station names in order (main line)
  branches?: Branch[]; // Optional: divergent route branches
}

export interface Branch {
  name: string; // Branch name (e.g., "Lo Wu", "Lok Ma Chau")
  nameZh: string; // Chinese name
  branchPoint: string; // Station where branch diverges
  stations: string[]; // Stations unique to this branch (excluding common stations)
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
    textColor: '#FFFFFF',
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
      let branches: Branch[] | undefined;

      if (lineDirections) {
        // Identify divergent route patterns (e.g., "LMC-DT" for Lok Ma Chau branch)
        const baseDirections = new Set(['DT', 'UT']); // Standard directions
        const divergentDirections: string[] = [];

        lineDirections.forEach((_, direction) => {
          if (!baseDirections.has(direction) && direction.includes('-')) {
            // This is a divergent direction (e.g., "LMC-DT", "TKS-DT")
            const baseDir = direction.split('-')[1]; // Get "DT" from "LMC-DT"
            if (baseDir === 'DT') { // Only process downtrack directions
              divergentDirections.push(direction);
            }
          }
        });

        // Get base direction stations (use DT if available, otherwise first available)
        const baseDirStations = lineDirections.get('DT') || Array.from(lineDirections.values())[0];

        if (baseDirStations) {
          // Collect all stations from base direction
          const stationSequenceMap = new Map<string, number>();
          baseDirStations.forEach(({ station, sequence }) => {
            stationSequenceMap.set(station, sequence);
          });
          stations = Array.from(stationSequenceMap.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([station]) => station);
        }

        // Process divergent routes
        if (divergentDirections.length > 0 && lineDirections.has('DT')) {
          const tempBranches: Branch[] = [];
          const baseStationSet = new Set(baseDirStations?.map(s => s.station) || []);

          divergentDirections.forEach(divDir => {
            const divStations = lineDirections.get(divDir);
            if (!divStations) return;

            // Find stations unique to this branch
            const uniqueStations = divStations
              .filter(({ station }) => !baseStationSet.has(station))
              .sort((a, b) => a.sequence - b.sequence)
              .map(({ station }) => station);

            if (uniqueStations.length > 0) {
              // Find the branch point (last common station before divergence)
              const allDivStations = divStations.map(s => s.station);
              let branchPoint = '';

              for (let i = 0; i < allDivStations.length; i++) {
                if (baseStationSet.has(allDivStations[i])) {
                  branchPoint = allDivStations[i];
                  // Check if next station is unique - if so, this is the branch point
                  if (i + 1 < allDivStations.length && !baseStationSet.has(allDivStations[i + 1])) {
                    break;
                  }
                }
              }

              // Get branch name from the unique endpoint station
              const branchName = uniqueStations[0]; // First unique station is usually the endpoint

              // Try to get Chinese name from the CSV data
              const chineseNameRow = parseResult.data.find(
                row => row['English Name'] === branchName && row['Line Code'] === lineId
              );

              tempBranches.push({
                name: branchName,
                nameZh: chineseNameRow?.['Chinese Name'] || branchName,
                branchPoint,
                stations: uniqueStations,
              });
            }
          });

          // Add all branch stations to the main stations array for backwards compatibility
          tempBranches.forEach(branch => {
            branch.stations.forEach(station => {
              if (!stations.includes(station)) {
                stations.push(station);
              }
            });
          });

          branches = tempBranches.length > 0 ? tempBranches : undefined;
        }
      }

      return {
        ...metadata,
        stations,
        branches: branches && branches.length > 0 ? branches : undefined,
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
