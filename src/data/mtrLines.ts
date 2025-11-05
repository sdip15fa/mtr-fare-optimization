// MTR Lines Data Structure with Official Colors and Station Organization

export interface MTRLine {
  id: string;
  nameEn: string;
  nameZh: string;
  color: string;
  textColor: string; // For contrast on colored backgrounds
  stations: string[]; // Station names in order
}

export const MTR_LINES: MTRLine[] = [
  {
    id: 'ISL',
    nameEn: 'Island Line',
    nameZh: '港島綫',
    color: '#0860A8',
    textColor: '#FFFFFF',
    stations: [
      'Kennedy Town',
      'HKU',
      'Sai Ying Pun',
      'Sheung Wan',
      'Central',
      'Admiralty',
      'Wan Chai',
      'Causeway Bay',
      'Tin Hau',
      'Fortress Hill',
      'North Point',
      'Quarry Bay',
      'Tai Koo',
      'Sai Wan Ho',
      'Shau Kei Wan',
      'Heng Fa Chuen',
      'Chai Wan',
    ],
  },
  {
    id: 'TWL',
    nameEn: 'Tsuen Wan Line',
    nameZh: '荃灣綫',
    color: '#E2231A',
    textColor: '#FFFFFF',
    stations: [
      'Central',
      'Admiralty',
      'Tsim Sha Tsui',
      'Jordan',
      'Yau Ma Tei',
      'Mong Kok',
      'Prince Edward',
      'Sham Shui Po',
      'Cheung Sha Wan',
      'Lai Chi Kok',
      'Mei Foo',
      'Lai King',
      'Kwai Fong',
      'Kwai Hing',
      'Tai Wo Hau',
      'Tsuen Wan',
    ],
  },
  {
    id: 'KTL',
    nameEn: 'Kwun Tong Line',
    nameZh: '觀塘綫',
    color: '#00A040',
    textColor: '#FFFFFF',
    stations: [
      'Whampoa',
      'Ho Man Tin',
      'Yau Ma Tei',
      'Mong Kok',
      'Prince Edward',
      'Shek Kip Mei',
      'Kowloon Tong',
      'Lok Fu',
      'Wong Tai Sin',
      'Diamond Hill',
      'Choi Hung',
      'Kowloon Bay',
      'Ngau Tau Kok',
      'Kwun Tong',
      'Lam Tin',
      'Yau Tong',
      'Tiu Keng Leng',
    ],
  },
  {
    id: 'TKL',
    nameEn: 'Tseung Kwan O Line',
    nameZh: '將軍澳綫',
    color: '#7D3F98',
    textColor: '#FFFFFF',
    stations: [
      'North Point',
      'Quarry Bay',
      'Yau Tong',
      'Tiu Keng Leng',
      'Tseung Kwan O',
      'Hang Hau',
      'Po Lam',
      'LOHAS Park',
    ],
  },
  {
    id: 'TML',
    nameEn: 'Tuen Ma Line',
    nameZh: '屯馬綫',
    color: '#9C5B3F',
    textColor: '#FFFFFF',
    stations: [
      'Wu Kai Sha',
      'Ma On Shan',
      'Heng On',
      'Tai Shui Hang',
      'Shek Mun',
      'City One',
      'Sha Tin Wai',
      'Che Kung Temple',
      'Tai Wai',
      'Hin Keng',
      'Diamond Hill',
      'Kai Tak',
      'Sung Wong Toi',
      'To Kwa Wan',
      'Ho Man Tin',
      'Hung Hom',
      'East Tsim Sha Tsui',
      'Austin',
      'Nam Cheong',
      'Mei Foo',
      'Tsuen Wan West',
      'Kam Sheung Road',
      'Yuen Long',
      'Long Ping',
      'Tin Shui Wai',
      'Siu Hong',
      'Tuen Mun',
    ],
  },
  {
    id: 'EAL',
    nameEn: 'East Rail Line',
    nameZh: '東鐵綫',
    color: '#5EB7E8',
    textColor: '#000000',
    stations: [
      'Admiralty',
      'Exhibition Centre',
      'Hung Hom',
      'Mong Kok East',
      'Kowloon Tong',
      'Tai Wai',
      'Sha Tin',
      'Fo Tan',
      'Racecourse',
      'University',
      'Tai Po Market',
      'Tai Wo',
      'Fanling',
      'Sheung Shui',
      'Lo Wu',
      'Lok Ma Chau',
    ],
  },
  {
    id: 'TCL',
    nameEn: 'Tung Chung Line',
    nameZh: '東涌綫',
    color: '#F7943E',
    textColor: '#000000',
    stations: [
      'Hong Kong',
      'Kowloon',
      'Olympic',
      'Nam Cheong',
      'Lai King',
      'Tsing Yi',
      'Sunny Bay',
      'Tung Chung',
    ],
  },
  {
    id: 'SIL',
    nameEn: 'South Island Line',
    nameZh: '南港島綫',
    color: '#CBD300',
    textColor: '#000000',
    stations: [
      'Admiralty',
      'Ocean Park',
      'Wong Chuk Hang',
      'Lei Tung',
      'South Horizons',
    ],
  },
  {
    id: 'DRL',
    nameEn: 'Disneyland Resort Line',
    nameZh: '迪士尼綫',
    color: '#EB6EA5',
    textColor: '#FFFFFF',
    stations: [
      'Sunny Bay',
      'Disneyland Resort',
    ],
  },
];

// Create a map of station to lines for quick lookup
export const stationToLinesMap = new Map<string, MTRLine[]>();

MTR_LINES.forEach(line => {
  line.stations.forEach(station => {
    if (!stationToLinesMap.has(station)) {
      stationToLinesMap.set(station, []);
    }
    stationToLinesMap.get(station)!.push(line);
  });
});

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
