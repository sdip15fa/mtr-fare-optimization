// MTR Lines Data Structure with Official Colors and Station Organization
// Station data is loaded from official MTR open data CSV

import Papa from 'papaparse';

export interface MTRLine {
  id: string;
  nameEn: string;
  nameZh: string;
  color: string;
  textColor: string; // For contrast on colored backgrounds
  stations: string[]; // All stations (trunk + all branch stations)
  branches?: BranchStructure; // Optional: divergent route branches
}

export interface BranchStructure {
  branchPoint: string; // Station where line splits
  trunk: string[]; // Common stations before branch point (including branch point)
  branches: Branch[]; // All branches from the branch point
}

export interface Branch {
  name: string; // Branch endpoint name (e.g., "Lo Wu", "Lok Ma Chau")
  nameZh: string; // Chinese name
  stations: string[]; // Stations on this branch (after branch point)
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
      let branchStructure: BranchStructure | undefined;

      if (lineDirections) {
        // Identify all DT (downtrack) directions
        const dtDirections: string[] = [];
        lineDirections.forEach((_, direction) => {
          if (direction === 'DT' || direction.endsWith('-DT')) {
            dtDirections.push(direction);
          }
        });

        // If there are multiple DT directions, this line has branches
        if (dtDirections.length > 1) {
          // Get all station sets for each direction
          const directionStationSets = dtDirections.map(dir => {
            const dirStations = lineDirections.get(dir)!;
            return {
              direction: dir,
              stations: dirStations.sort((a, b) => a.sequence - b.sequence).map(s => s.station),
              stationSet: new Set(dirStations.map(s => s.station))
            };
          });

          // Find common stations (intersection of all directions)
          const commonStationSet = new Set(directionStationSets[0].stations);
          directionStationSets.slice(1).forEach(({ stationSet }) => {
            commonStationSet.forEach(station => {
              if (!stationSet.has(station)) {
                commonStationSet.delete(station);
              }
            });
          });

          // Find branch point (first common station where routes converge)
          // The branches are before this point, trunk is after
          let branchPointStation = '';
          const firstDirStations = directionStationSets[0].stations;

          // Find first common station (where divergent routes merge into trunk)
          for (let i = 0; i < firstDirStations.length; i++) {
            if (commonStationSet.has(firstDirStations[i])) {
              branchPointStation = firstDirStations[i];
              break;
            }
          }

          if (branchPointStation) {
            // Build trunk (common stations from branch point onwards)
            const branchPointIndex = firstDirStations.indexOf(branchPointStation);
            const trunk: string[] = firstDirStations.slice(branchPointIndex);

            // Build branches (unique stations BEFORE branch point for each direction)
            const branches: Branch[] = [];

            directionStationSets.forEach(({ direction, stations: dirStations }) => {
              const dirBranchIndex = dirStations.indexOf(branchPointStation);
              if (dirBranchIndex > 0) {
                // Get stations before the branch point (these are unique to this branch)
                const branchStations = dirStations.slice(0, dirBranchIndex);

                // Get the endpoint (first station) as the branch name
                const branchEndpoint = branchStations[0];
                const chineseNameRow = parseResult.data.find(
                  row => row['English Name'] === branchEndpoint && row['Line Code'] === lineId
                );

                branches.push({
                  name: branchEndpoint,
                  nameZh: chineseNameRow?.['Chinese Name'] || branchEndpoint,
                  stations: branchStations,
                });
              }
            });

            if (branches.length > 0) {
              branchStructure = {
                branchPoint: branchPointStation,
                trunk: trunk,
                branches: branches,
              };

              // For stations array, include trunk + all unique branch stations
              const stationSet = new Set(trunk);
              branches.forEach(branch => {
                branch.stations.forEach(s => stationSet.add(s));
              });
              stations = Array.from(stationSet);
            }
          }
        } else {
          // No branches, just use the regular DT direction
          const baseDirStations = lineDirections.get('DT') || Array.from(lineDirections.values())[0];
          if (baseDirStations) {
            stations = baseDirStations
              .sort((a, b) => a.sequence - b.sequence)
              .map(({ station }) => station);
          }
        }
      }

      return {
        ...metadata,
        stations,
        branches: branchStructure,
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
